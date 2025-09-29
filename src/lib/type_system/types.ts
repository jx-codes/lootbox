// Core types for the ts-morph based type extraction system

export interface FunctionSignature {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
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
  sourceLocation?: {
    line: number;
    file: string;
  };
}

export interface InterfaceProperty {
  name: string;
  type: string;
  isOptional: boolean;
}

export interface ExtractionError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: "error" | "warning";
}

export interface ExtractionResult {
  functions: FunctionSignature[];
  interfaces: InterfaceDefinition[];
  errors: ExtractionError[];
  sourceFile: string;
}

export interface RpcFileInfo {
  name: string;
  path: string;
  lastModified: Date;
}
