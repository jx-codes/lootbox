// MCP schema fetching and caching

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface McpToolSchema {
  name: string; // Sanitized name for TypeScript
  originalName: string; // Original name from MCP server
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResourceSchema {
  name: string; // Sanitized name for TypeScript
  originalName: string; // Original name from MCP server
  description?: string;
  uri?: string;
  uriTemplate?: string;
  mimeType?: string;
}

export interface McpServerSchemas {
  serverName: string;
  tools: McpToolSchema[];
  resources: McpResourceSchema[];
}

export class McpSchemaFetcher {
  private cache: Map<string, McpServerSchemas>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Fetch and cache schemas (tools and resources) from an MCP server
   */
  async fetchSchemas(
    client: Client,
    serverName: string
  ): Promise<McpServerSchemas> {
    console.error(`Fetching schemas from MCP server: ${serverName}...`);

    const tools = await this.fetchTools(client, serverName);
    const resources = await this.fetchResources(client, serverName);

    const schemas: McpServerSchemas = {
      serverName,
      tools,
      resources,
    };

    this.cache.set(serverName, schemas);

    console.error(
      `Fetched ${tools.length} tools and ${resources.length} resources from ${serverName}`
    );

    return schemas;
  }

  /**
   * Fetch tools from MCP server
   */
  private async fetchTools(
    client: Client,
    serverName: string
  ): Promise<McpToolSchema[]> {
    try {
      const response = await client.listTools();

      if (!response.tools || !Array.isArray(response.tools)) {
        console.error(
          `No tools array returned from MCP server: ${serverName}`
        );
        return [];
      }

      return response.tools.map((tool) => ({
        name: this.sanitizeIdentifier(tool.name),
        originalName: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));
    } catch (error) {
      console.error(
        `Failed to fetch tools from ${serverName}:`,
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Fetch resources from MCP server
   */
  private async fetchResources(
    client: Client,
    serverName: string
  ): Promise<McpResourceSchema[]> {
    try {
      const response = await client.listResources();

      if (!response.resources || !Array.isArray(response.resources)) {
        console.error(
          `No resources array returned from MCP server: ${serverName}`
        );
        return [];
      }

      return response.resources.map((resource: any) => ({
        name: this.sanitizeIdentifier(resource.name),
        originalName: resource.name,
        description: resource.description,
        uri: resource.uri,
        uriTemplate: resource.uriTemplate as string | undefined,
        mimeType: resource.mimeType,
      }));
    } catch (error) {
      console.error(
        `Failed to fetch resources from ${serverName}:`,
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Get cached schemas for a server
   */
  getCachedSchemas(serverName: string): McpServerSchemas | undefined {
    return this.cache.get(serverName);
  }

  /**
   * Get all cached schemas
   */
  getAllSchemas(): McpServerSchemas[] {
    // return Array.from(this.cache.values());
    return [];
  }

  /**
   * Check if schemas are cached for a server
   */
  hasCachedSchemas(serverName: string): boolean {
    return this.cache.has(serverName);
  }

  /**
   * Sanitize string to be a valid TypeScript identifier
   */
  private sanitizeIdentifier(str: string): string {
    return str.replace(/[^a-zA-Z0-9_]/g, "_");
  }
}