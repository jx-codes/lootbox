// TypeScript type extraction using ts-morph

import {
  FunctionDeclaration,
  InterfaceDeclaration,
  ModuleKind,
  Node,
  ParameterDeclaration,
  Project,
  ScriptTarget,
  SourceFile,
} from "ts-morph";
import type {
  ExtractionError,
  ExtractionResult,
  FunctionSignature,
  InterfaceDefinition,
  InterfaceProperty,
  Parameter,
} from "./types.ts";

export interface TypeExtractorConfig {
  useInMemoryFileSystem?: boolean;
  includePrivateMembers?: boolean;
}

export class TypeExtractor {
  private project: Project;
  private config: Required<TypeExtractorConfig>;

  constructor(config: TypeExtractorConfig = {}) {
    this.config = {
      useInMemoryFileSystem: config.useInMemoryFileSystem ?? false,
      includePrivateMembers: config.includePrivateMembers ?? false,
    };

    this.project = new Project({
      useInMemoryFileSystem: this.config.useInMemoryFileSystem,
      compilerOptions: {
        target: ScriptTarget.ES2022,
        module: ModuleKind.ESNext,
        strict: true,
        declaration: true,
        emitDeclarationOnly: false,
      },
    });
  }

  /**
   * Extract types from source code (useful for testing)
   */
  extractFromSource(sourceCode: string, fileName = "temp.ts"): ExtractionResult {
    try {
      const sourceFile = this.project.createSourceFile(fileName, sourceCode, { overwrite: true });
      return this.processSourceFile(sourceFile);
    } catch (error) {
      return {
        functions: [],
        interfaces: [],
        errors: [{
          file: fileName,
          message: `Failed to parse source: ${
            error instanceof Error ? error.message : String(error)
          }`,
          severity: "error",
        }],
        sourceFile: fileName,
      };
    }
  }

  /**
   * Extract types from file path
   */
  extractFromFile(filePath: string): ExtractionResult {
    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      return this.processSourceFile(sourceFile);
    } catch (error) {
      return {
        functions: [],
        interfaces: [],
        errors: [{
          file: filePath,
          message: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`,
          severity: "error",
        }],
        sourceFile: filePath,
      };
    }
  }

  /**
   * Process a source file and extract type information
   */
  private processSourceFile(sourceFile: SourceFile): ExtractionResult {
    const functions: FunctionSignature[] = [];
    const interfaces: InterfaceDefinition[] = [];
    const errors: ExtractionError[] = [];

    try {
      // Extract exported functions
      sourceFile.getExportedDeclarations().forEach((declarations: Node[], name: string) => {
        declarations.forEach((declaration: Node) => {
          try {
            if (Node.isFunctionDeclaration(declaration)) {
              const signature = this.extractFunctionSignature(declaration);
              if (signature) {
                functions.push(signature);
              }
            }
          } catch (error) {
            errors.push({
              file: sourceFile.getFilePath(),
              line: declaration.getStartLineNumber(),
              message: `Failed to extract ${name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
              severity: "warning",
            });
          }
        });
      });

      // Extract ALL interfaces (exported and non-exported) since they may be referenced by exported functions
      sourceFile.getInterfaces().forEach((interfaceDeclaration) => {
        try {
          const interfaceDef = this.extractInterface(interfaceDeclaration);
          if (interfaceDef) {
            interfaces.push(interfaceDef);
          }
        } catch (error) {
          errors.push({
            file: sourceFile.getFilePath(),
            line: interfaceDeclaration.getStartLineNumber(),
            message: `Failed to extract interface ${interfaceDeclaration.getName()}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            severity: "warning",
          });
        }
      });

      return {
        functions,
        interfaces,
        errors,
        sourceFile: sourceFile.getFilePath(),
      };
    } catch (error) {
      errors.push({
        file: sourceFile.getFilePath(),
        message: `Failed to process file: ${
          error instanceof Error ? error.message : String(error)
        }`,
        severity: "error",
      });

      return {
        functions,
        interfaces,
        errors,
        sourceFile: sourceFile.getFilePath(),
      };
    }
  }

  /**
   * Extract function signature information
   */
  private extractFunctionSignature(func: FunctionDeclaration): FunctionSignature | null {
    const name = func.getName();
    if (!name) {
      return null; // Skip anonymous functions
    }

    try {
      const parameters = func.getParameters().map((param) => this.extractParameter(param));

      // Validate RPC function signature: must have exactly one parameter named 'args'
      this.validateRpcFunctionSignature(func, parameters);

      const returnType = this.extractReturnType(func);
      const isAsync = func.isAsync();

      return {
        name,
        parameters,
        returnType,
        isAsync,
        sourceLocation: {
          line: func.getStartLineNumber(),
          file: func.getSourceFile().getFilePath(),
        },
      };
    } catch (error) {
      console.error(`Failed to extract function ${name}:`, error);
      return null;
    }
  }

  /**
   * Validate that RPC function follows the required signature pattern: args: T
   */
  private validateRpcFunctionSignature(
    func: FunctionDeclaration,
    parameters: Parameter[]
  ): void {
    const funcName = func.getName();
    const filePath = func.getSourceFile().getFilePath();

    // Must have exactly one parameter
    if (parameters.length !== 1) {
      throw new Error(
        `RPC function '${funcName}' in ${filePath}:${func.getStartLineNumber()} must have exactly one parameter named 'args'. ` +
        `Found ${parameters.length} parameters. Required signature: ${funcName}(args: T)`
      );
    }

    const param = parameters[0];

    // Parameter must be named 'args'
    if (param.name !== 'args') {
      throw new Error(
        `RPC function '${funcName}' in ${filePath}:${func.getStartLineNumber()} parameter must be named 'args'. ` +
        `Found parameter name: '${param.name}'. Required signature: ${funcName}(args: T)`
      );
    }
  }

  /**
   * Extract parameter information
   */
  private extractParameter(param: ParameterDeclaration): Parameter {
    const name = param.getName();
    const type = this.getParameterType(param);
    const isOptional = param.hasQuestionToken();
    const hasDefault = !!param.getInitializer();
    const defaultValue = param.getInitializer()?.getText();

    return {
      name,
      type,
      isOptional: isOptional || hasDefault, // Parameters with defaults are effectively optional
      hasDefault,
      defaultValue,
    };
  }

  /**
   * Extract parameter type with better handling
   */
  private getParameterType(param: ParameterDeclaration): string {
    try {
      // Get the type node if explicitly specified
      const typeNode = param.getTypeNode();
      if (typeNode) {
        return typeNode.getText();
      }

      // Try to infer from default value
      const initializer = param.getInitializer();
      if (initializer) {
        const text = initializer.getText();

        // Handle common default value patterns
        if (text === '""' || text.startsWith('"') || text.startsWith("'")) {
          return "string";
        }
        if (text === "[]") {
          return "unknown[]"; // Could be improved with more context
        }
        if (/^\d+$/.test(text)) {
          return "number";
        }
        if (text === "true" || text === "false") {
          return "boolean";
        }
      }

      // Fallback to TypeScript's type inference
      const type = param.getType();
      const typeText = type.getText(param);

      // Clean up common type patterns
      return this.cleanTypeText(typeText);
    } catch (error) {
      console.error(`Failed to get parameter type for ${param.getName()}:`, error);
      return "unknown";
    }
  }

  /**
   * Extract return type information
   */
  private extractReturnType(func: FunctionDeclaration): string {
    try {
      // Check for explicit return type
      const returnTypeNode = func.getReturnTypeNode();
      if (returnTypeNode) {
        return returnTypeNode.getText();
      }

      // Infer return type
      const type = func.getReturnType();
      const typeText = type.getText(func);

      return this.cleanTypeText(typeText);
    } catch (error) {
      console.error(`Failed to extract return type for ${func.getName()}:`, error);
      return "unknown";
    }
  }

  /**
   * Extract interface definition
   */
  private extractInterface(iface: InterfaceDeclaration): InterfaceDefinition | null {
    try {
      const name = iface.getName();
      const properties = iface.getProperties().map((prop) => {
        const propName = prop.getName();
        const propType = prop.getTypeNode()?.getText() || "unknown";
        const isOptional = prop.hasQuestionToken();

        return {
          name: propName,
          type: propType,
          isOptional,
        } as InterfaceProperty;
      });

      return {
        name,
        properties,
        sourceLocation: {
          line: iface.getStartLineNumber(),
          file: iface.getSourceFile().getFilePath(),
        },
      };
    } catch (error) {
      console.error(`Failed to extract interface ${iface.getName()}:`, error);
      return null;
    }
  }

  /**
   * Clean up type text for better readability
   */
  private cleanTypeText(typeText: string): string {
    // Remove extra whitespace
    typeText = typeText.replace(/\s+/g, " ").trim();

    // Handle common patterns
    typeText = typeText.replace(/\bPromise<(.+)>\b/, "Promise<$1>");

    return typeText;
  }

  /**
   * Clear the project cache (useful for testing)
   */
  clearCache(): void {
    this.project = new Project({
      useInMemoryFileSystem: this.config.useInMemoryFileSystem,
      compilerOptions: this.project.getCompilerOptions(),
    });
  }
}
