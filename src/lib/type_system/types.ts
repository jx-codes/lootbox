// Core types for the ts-morph based type extraction system

export interface FunctionDocumentation {
  description?: string;
  paramDescriptions?: Record<string, string>;
  returnDescription?: string;
  examples?: string[];
  deprecated?: string;
  tags?: Record<string, string>;
}

export interface InterfaceDocumentation {
  description?: string;
  propertyDescriptions?: Record<string, string>;
  deprecated?: string;
  tags?: Record<string, string>;
}

export interface FunctionSignature {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
  documentation?: FunctionDocumentation;
  sourceLocation?: {
    line: number;
    file: string;
  };
}

export interface Parameter {
  name: string;
  type: string;
  isOptional: boolean;
  hasDefault: boolean;
  defaultValue?: string;
}

export interface InterfaceDefinition {
  name: string;
  properties: InterfaceProperty[];
  documentation?: InterfaceDocumentation;
  sourceLocation?: {
    line: number;
    file: string;
  };
}

export interface InterfaceProperty {
  name: string;
  type: string;
  isOptional: boolean;
  documentation?: string;
}

export interface ExtractionError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: "error" | "warning";
}

export interface NamespaceMetadata {
  description?: string;
  useWhen?: string;
  tags?: string[];
}

export interface ExtractionResult {
  functions: FunctionSignature[];
  interfaces: InterfaceDefinition[];
  errors: ExtractionError[];
  sourceFile: string;
  meta?: NamespaceMetadata;
}

export interface RpcFileInfo {
  name: string;
  path: string;
  lastModified: Date;
}
