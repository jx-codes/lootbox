/**
 * TypeGeneratorManager
 *
 * Manages TypeScript type and client code generation.
 * Handles:
 * - Generating TypeScript types from RPC files
 * - Generating RPC client code
 * - Generating namespace-filtered types
 * - Managing type/client code cache
 * - Integrating MCP schemas for generation
 * - Centralizing type extraction logic (eliminates duplication)
 */

import type { RpcCacheManager } from "./rpc_cache_manager.ts";
import type { McpServerSchemas } from "../../external-mcps/mcp_schema_fetcher.ts";
import { convertMcpSchemasToExtractionResults } from "../../external-mcps/parse_mcp_schemas.ts";
import type { RpcFile } from "../load_rpc_files.ts";
import type { ExtractionResult } from "../../type_system/types.ts";

export class TypeGeneratorManager {
  private cachedTypes: string | null = null;
  private cachedClientCode: string | null = null;
  private rpcCacheManager: RpcCacheManager;

  constructor(rpcCacheManager: RpcCacheManager) {
    this.rpcCacheManager = rpcCacheManager;
  }

  /**
   * Centralized type extraction from RPC files
   * This eliminates the duplication found in the original implementation
   */
  private async extractTypesFromFiles(
    files: Map<string, RpcFile>
  ): Promise<ExtractionResult[]> {
    const { TypeExtractor } = await import("../../type_system/type_extractor.ts");
    const extractor = new TypeExtractor();
    const results: ExtractionResult[] = [];

    for (const file of files.values()) {
      try {
        const result = extractor.extractFromFile(file.path);
        results.push(result);
      } catch (err) {
        console.error(`Error extracting types from ${file.name}:`, err);
      }
    }

    return results;
  }

  /**
   * Generate TypeScript type definitions
   */
  async generateTypes(mcpSchemas?: McpServerSchemas[]): Promise<string> {
    const uniqueFiles = this.rpcCacheManager.getUniqueFiles();
    if (uniqueFiles.size === 0 && !mcpSchemas) {
      return "// No RPC files found";
    }

    const { ClientGenerator } = await import(
      "../../type_system/client_generator.ts"
    );
    const { get_config } = await import("../../get_config.ts");

    const config = get_config();

    // Use centralized extraction
    const rpcExtractionResults = await this.extractTypesFromFiles(uniqueFiles);

    // Generate lightweight type summary with MCP integration
    const mcpExtractionResults = mcpSchemas
      ? convertMcpSchemasToExtractionResults(mcpSchemas)
      : [];

    const generator = new ClientGenerator();
    return generator.generateTypesSummary(
      rpcExtractionResults,
      mcpExtractionResults,
      config.port
    );
  }

  /**
   * Generate full RPC client code
   */
  async generateClientCode(
    port: number,
    mcpSchemas?: McpServerSchemas[]
  ): Promise<string> {
    const uniqueFiles = this.rpcCacheManager.getUniqueFiles();

    const { ClientGenerator } = await import(
      "../../type_system/client_generator.ts"
    );

    // Use centralized extraction
    const rpcExtractionResults = await this.extractTypesFromFiles(uniqueFiles);

    const options = {
      websocketUrl: `ws://localhost:${port}/ws`,
      timeout: 10000,
      clientClassName: "RpcClient",
      includeInterfaces: true,
    };

    const generator = new ClientGenerator();

    // Generate client with MCP integration if schemas provided
    if (mcpSchemas) {
      const mcpExtractionResults =
        convertMcpSchemasToExtractionResults(mcpSchemas);
      return generator.generateFullClientWithMcp(
        rpcExtractionResults,
        mcpExtractionResults,
        options
      );
    }

    return generator.generateFullClient(rpcExtractionResults, options);
  }

  /**
   * Generate types for specific namespaces only
   */
  async generateNamespaceTypes(
    namespaces: string[],
    port: number,
    mcpSchemas?: McpServerSchemas[]
  ): Promise<string> {
    const { ClientGenerator } = await import(
      "../../type_system/client_generator.ts"
    );
    const { NamespaceFilter } = await import(
      "../../type_system/namespace_filter.ts"
    );

    const uniqueFiles = this.rpcCacheManager.getUniqueFiles();

    // Use centralized extraction
    const rpcExtractionResults = await this.extractTypesFromFiles(uniqueFiles);

    const mcpExtractionResults = mcpSchemas
      ? convertMcpSchemasToExtractionResults(mcpSchemas)
      : [];

    const generator = new ClientGenerator();
    const filter = new NamespaceFilter(generator);

    return filter.generateNamespaceTypes(
      rpcExtractionResults,
      mcpExtractionResults,
      namespaces,
      port
    );
  }

  /**
   * Get list of available namespaces
   */
  async getAvailableNamespaces(
    mcpSchemas?: McpServerSchemas[]
  ): Promise<{ rpc: string[]; mcp: string[] }> {
    const { ClientGenerator } = await import(
      "../../type_system/client_generator.ts"
    );

    const uniqueFiles = this.rpcCacheManager.getUniqueFiles();

    // Use centralized extraction
    const rpcExtractionResults = await this.extractTypesFromFiles(uniqueFiles);

    const mcpExtractionResults = mcpSchemas
      ? convertMcpSchemasToExtractionResults(mcpSchemas)
      : [];

    const generator = new ClientGenerator();
    return generator.getAvailableNamespaces(
      rpcExtractionResults,
      mcpExtractionResults
    );
  }

  /**
   * Get RPC namespaces with metadata (for LLM discovery)
   */
  async getNamespaceMetadata(
    mcpSchemas?: McpServerSchemas[]
  ): Promise<string> {
    const { ClientGenerator } = await import(
      "../../type_system/client_generator.ts"
    );

    const uniqueFiles = this.rpcCacheManager.getUniqueFiles();

    // Use centralized extraction
    const rpcExtractionResults = await this.extractTypesFromFiles(uniqueFiles);

    const mcpExtractionResults = mcpSchemas
      ? convertMcpSchemasToExtractionResults(mcpSchemas)
      : [];

    const generator = new ClientGenerator();
    const metadata = generator.getNamespaceMetadata(
      rpcExtractionResults,
      mcpExtractionResults
    );

    // Format as text with instruction block
    let output = "Available Namespaces:\n\n";
    output += "<namespaces>\n";

    // Combine RPC and MCP namespaces (MCP namespaces are prefixed with mcp_)
    const allNamespaces = [
      ...metadata.rpc,
      ...metadata.mcp.map((ns) => ({ ...ns, name: `mcp_${ns.name}` })),
    ];

    if (allNamespaces.length > 0) {
      for (const ns of allNamespaces) {
        output += `- ${ns.name} (${ns.functionCount} function${
          ns.functionCount !== 1 ? "s" : ""
        })`;
        if (ns.description) {
          output += ` - ${ns.description}`;
        }
        output += "\n";
        if (ns.useWhen) {
          output += `  Use when: ${ns.useWhen}\n`;
        }
        if (ns.tags.length > 0) {
          output += `  Tags: ${ns.tags.join(", ")}\n`;
        }
        output += "\n";
      }
    } else {
      output += "(none)\n";
    }
    output += "</namespaces>\n\n";

    // Add instruction block
    output += `<on_finish>
IMPORTANT: Before using any namespace, you MUST call get_namespace_types()
with the namespace names you want to use to load their TypeScript definitions.

Example: get_namespace_types(["filedb", "hackernews"])

This loads the type definitions for those specific namespaces without loading
all namespaces at once, which saves context space.
</on_finish>\n`;

    return output;
  }

  /**
   * Invalidate cached types and client code
   * Should be called when RPC files change
   */
  invalidateCache(): void {
    this.cachedTypes = null;
    this.cachedClientCode = null;
  }

  /**
   * Get cached types if available
   */
  getCachedTypes(): string | null {
    return this.cachedTypes;
  }

  /**
   * Get cached client code if available
   */
  getCachedClientCode(): string | null {
    return this.cachedClientCode;
  }

  /**
   * Set cached types
   */
  setCachedTypes(types: string): void {
    this.cachedTypes = types;
  }

  /**
   * Set cached client code
   */
  setCachedClientCode(code: string): void {
    this.cachedClientCode = code;
  }
}
