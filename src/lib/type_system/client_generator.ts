// Client code generation from extracted types

import type { ExtractionResult } from "./types.ts";

export interface ClientGeneratorOptions {
  includeInterfaces: boolean;
  clientClassName: string;
  websocketUrl: string;
  timeout: number;
}

export class ClientGenerator {
  private defaultOptions: ClientGeneratorOptions = {
    includeInterfaces: true,
    clientClassName: "RpcClient",
    websocketUrl: "ws://localhost:8080/ws",
    timeout: 10000,
  };

  /**
   * Generate complete RPC client code
   */
  generateFullClient(
    extractionResults: ExtractionResult[],
    options: Partial<ClientGeneratorOptions> = {},
  ): string {
    const opts = { ...this.defaultOptions, ...options };

    let code = this.generateHeader();

    if (opts.includeInterfaces) {
      code += this.generateInterfaces(extractionResults);
    }

    code += this.generateRpcClientInterface(extractionResults);
    code += this.generateClientImplementation(opts);
    code += this.generateTypedProxy(extractionResults);

    return code;
  }

  /**
   * Generate only the TypeScript types
   */
  generateTypesOnly(extractionResults: ExtractionResult[]): string {
    let code = this.generateHeader();
    code += this.generateInterfaces(extractionResults);
    code += this.generateRpcClientInterface(extractionResults);
    code += this.generateRpcMessage();
    return code;
  }

  /**
   * Generate file header
   */
  private generateHeader(): string {
    return `// Auto-generated RPC types and client
// This file is generated automatically - do not edit manually

`;
  }

  /**
   * Generate interface definitions with filename prefixes
   */
  private generateInterfaces(results: ExtractionResult[]): string {
    let code = "";

    for (const result of results) {
      const namespace = this.extractNamespace(result.sourceFile);
      const prefix = this.capitalizeNamespace(namespace);

      for (const iface of result.interfaces) {
        code += `export interface ${prefix}_${iface.name} {\n`;

        for (const prop of iface.properties) {
          const optional = prop.isOptional ? "?" : "";
          const prefixedType = this.prefixTypesInResult(prop.type, result, prefix);
          code += `  ${prop.name}${optional}: ${prefixedType};\n`;
        }

        code += "}\n\n";
      }
    }

    return code;
  }

  /**
   * Capitalize namespace for prefixing
   */
  private capitalizeNamespace(namespace: string): string {
    return namespace.charAt(0).toUpperCase() + namespace.slice(1);
  }

  /**
   * Extract namespace from source file path
   */
  private extractNamespace(sourceFile: string): string {
    const filename = sourceFile.split('/').pop() || sourceFile;
    return filename.replace('.ts', '').replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Group functions by namespace
   */
  private groupFunctionsByNamespace(results: ExtractionResult[]): Record<string, ExtractionResult[]> {
    const grouped: Record<string, ExtractionResult[]> = {};

    for (const result of results) {
      const namespace = this.extractNamespace(result.sourceFile);
      if (!grouped[namespace]) {
        grouped[namespace] = [];
      }
      grouped[namespace].push(result);
    }

    return grouped;
  }

  /**
   * Generate RPC client interface with namespaces
   */
  private generateRpcClientInterface(results: ExtractionResult[]): string {
    const grouped = this.groupFunctionsByNamespace(results);
    let code = "export interface RpcClient {\n";

    for (const [namespace, namespaceResults] of Object.entries(grouped)) {
      code += `  ${namespace}: {\n`;

      for (const result of namespaceResults) {
        const prefix = this.capitalizeNamespace(namespace);

        for (const func of result.functions) {
          const paramType = this.prefixTypesInResult(this.extractDataType(func.parameters[0]?.type || "unknown"), result, prefix);
          const returnType = this.prefixTypesInResult(this.formatReturnType(func.returnType, func.isAsync), result, prefix);

          code += `    ${func.name}(args: ${paramType}): ${returnType};\n`;
        }
      }

      code += `  };\n`;
    }

    code += "}\n\n";
    return code;
  }

  /**
   * Prefix interface names from this specific result
   */
  private prefixTypesInResult(typeString: string, result: ExtractionResult, prefix: string): string {
    let updatedType = typeString;

    for (const iface of result.interfaces) {
      const regex = new RegExp(`\\b${iface.name}\\b`, 'g');
      updatedType = updatedType.replace(regex, `${prefix}_${iface.name}`);
    }

    return updatedType;
  }

  /**
   * Extract the args parameter type directly
   */
  private extractDataType(argsType: string): string {
    // The args type should already be in the correct format from validation
    return argsType;
  }

  /**
   * Format return type
   */
  private formatReturnType(returnType: string, isAsync: boolean): string {
    if (isAsync) {
      return returnType; // Already Promise<T>
    }

    if (returnType.startsWith("Promise<")) {
      return returnType; // Already a promise
    }

    return `Promise<${returnType}>`;
  }

  /**
   * Generate client implementation
   */
  private generateClientImplementation(options: ClientGeneratorOptions): string {
    return `export interface RpcClientConfig {
  url?: string;
  timeout?: number;
  autoReconnect?: boolean;
}

class SimpleRpcClient {
  private ws?: WebSocket;
  private pendingCalls = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: number }>();
  private callId = 0;
  private connected = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket("${options.websocketUrl}");

      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };

      this.ws.onerror = () => {
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);

          if (response.type === "welcome") {
            return;
          }

          if (response.id && this.pendingCalls.has(response.id)) {
            const call = this.pendingCalls.get(response.id)!;
            this.pendingCalls.delete(response.id);
            clearTimeout(call.timeout);

            if (response.error) {
              call.reject(new Error(response.error));
            } else {
              call.resolve(response.result);
            }
          }
        } catch (error) {
          console.error("Failed to parse response:", error);
        }
      };
    });
  }

  async call(method: string, args: unknown): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }

    const id = \`call_\${++this.callId}\`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(\`RPC timeout: \${method}\`));
      }, ${options.timeout});

      this.pendingCalls.set(id, { resolve, reject, timeout });

      this.ws!.send(JSON.stringify({
        method,
        args,
        id
      }));
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}

const client = new SimpleRpcClient();

`;
  }

  /**
   * Generate typed proxy with namespaces
   */
  private generateTypedProxy(results: ExtractionResult[]): string {
    const grouped = this.groupFunctionsByNamespace(results);

    return `// Track active calls for auto-disconnect
let activeCalls = 0;
let disconnectTimer: number | null = null;

// Helper function to create RPC call
function createRpcCall(method: string) {
  return async (args: unknown) => {
    activeCalls++;

    // Clear any pending disconnect timer
    if (disconnectTimer !== null) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    try {
      return await client.call(method, args);
    } finally {
      activeCalls--;

      // If no more active calls, schedule disconnect after a short delay
      if (activeCalls === 0) {
        disconnectTimer = setTimeout(() => {
          client.disconnect();
        }, 100); // 100ms delay for quick successive calls
      }
    }
  };
}

// Create namespaced RPC client
export const rpc: RpcClient = {
${Object.entries(grouped).map(([namespace, namespaceResults]) => {
  const functions = namespaceResults.flatMap(result => {
    const prefix = this.capitalizeNamespace(namespace);
    return result.functions.map(func => {
      const paramType = this.prefixTypesInResult(this.extractDataType(func.parameters[0]?.type || "unknown"), result, prefix);
      const returnType = this.prefixTypesInResult(this.formatReturnType(func.returnType, func.isAsync), result, prefix);
      return {
        ...func,
        typedSignature: `(args: ${paramType}) => ${returnType}`
      };
    });
  });
  const functionCalls = functions.map(func =>
    `    ${func.name}: createRpcCall("${namespace}.${func.name}") as ${func.typedSignature}`
  ).join(',\n');

  return `  ${namespace}: {\n${functionCalls}\n  }`;
}).join(',\n')}
};
`;
  }

  /**
   * Generate RPC message types
   */
  private generateRpcMessage(): string {
    return `export interface RpcMessage {
  method: keyof RpcClient;
  args?: unknown[];
  id?: string;
}

export interface RpcResponse {
  result?: unknown;
  error?: string;
  id?: string;
}
`;
  }
}
