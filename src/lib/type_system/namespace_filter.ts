// Namespace-specific type generation using composition

import type { ExtractionResult } from "./types.ts";
import { ClientGenerator } from "./client_generator.ts";

export class NamespaceFilter {
  private generator: ClientGenerator;

  constructor(generator: ClientGenerator) {
    this.generator = generator;
  }

  /**
   * Filter extraction results to only include specified namespaces
   */
  filterByNamespaces(
    results: ExtractionResult[],
    namespaces: string[]
  ): ExtractionResult[] {
    return results.filter((result) => {
      const namespace = this.extractNamespace(result.sourceFile);
      return namespaces.includes(namespace);
    });
  }

  /**
   * Generate types for specific namespaces only
   */
  generateNamespaceTypes(
    rpcResults: ExtractionResult[],
    mcpResults: ExtractionResult[],
    requestedNamespaces: string[],
    port: number
  ): string {
    // Separate RPC and MCP namespaces
    const rpcNamespaces = requestedNamespaces.filter(ns => !ns.startsWith('mcp_'));
    const mcpNamespaces = requestedNamespaces
      .filter(ns => ns.startsWith('mcp_'))
      .map(ns => ns.substring(4)); // Remove mcp_ prefix

    // Filter results
    const filteredRpc = this.filterByNamespaces(rpcResults, rpcNamespaces);
    const filteredMcp = this.filterByNamespaces(mcpResults, mcpNamespaces);

    // Generate types using existing generator
    return this.generator.generateTypesSummary(
      filteredRpc,
      filteredMcp,
      port
    );
  }

  /**
   * Extract namespace from source file path
   */
  private extractNamespace(sourceFile: string): string {
    const filename = sourceFile.split('/').pop() || sourceFile;
    return filename.replace('.ts', '').replace(/[^a-zA-Z0-9]/g, '_');
  }
}
