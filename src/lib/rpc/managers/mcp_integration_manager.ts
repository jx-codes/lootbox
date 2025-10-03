/**
 * McpIntegrationManager
 *
 * Manages MCP (Model Context Protocol) integration.
 * Handles:
 * - MCP client lifecycle via McpClientManager
 * - Schema fetching via McpSchemaFetcher
 * - MCP tool and resource calls
 * - Providing schemas to type generation
 */

import { McpClientManager } from "../../external-mcps/mcp_client_manager.ts";
import type { McpConfigFile } from "../../external-mcps/mcp_config.ts";
import { McpSchemaFetcher } from "../../external-mcps/mcp_schema_fetcher.ts";
import type { McpServerSchemas } from "../../external-mcps/mcp_schema_fetcher.ts";
import { executeMcpResource, executeMcpTool } from "../execute_mcp.ts";

export class McpIntegrationManager {
  private state: {
    clientManager: McpClientManager;
    schemaFetcher: McpSchemaFetcher;
  } | null = null;

  /**
   * Initialize MCP integration with provided configuration
   */
  async initialize(mcpConfig: McpConfigFile): Promise<void> {
    console.error("Initializing MCP integration...");

    const clientManager = new McpClientManager();
    await clientManager.initializeClients(mcpConfig.mcpServers);

    const schemaFetcher = new McpSchemaFetcher();
    for (const serverName of clientManager.getConnectedServerNames()) {
      const client = clientManager.getClient(serverName);
      if (client) {
        await schemaFetcher.fetchSchemas(client, serverName);
      }
    }

    this.state = { clientManager, schemaFetcher };
    console.error("MCP integration initialized successfully");
  }

  /**
   * Shutdown MCP integration and disconnect all clients
   */
  async shutdown(): Promise<void> {
    if (this.state) {
      await this.state.clientManager.disconnectAll();
      this.state = null;
      console.error("MCP integration shut down");
    }
  }

  /**
   * Handle MCP tool or resource call
   * Method format: mcp_ServerName.operationName
   * Resource operations start with "resource_"
   */
  async handleMcpCall(
    method: string,
    args: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.state) {
      return {
        success: false,
        error: "MCP is not initialized",
      };
    }

    // Parse method: mcp_ServerName.operationName
    const parts = method.split(".");
    if (parts.length !== 2) {
      return {
        success: false,
        error: `Invalid MCP method format: ${method}`,
      };
    }

    const serverNameWithPrefix = parts[0]; // mcp_ServerName
    const operationName = parts[1];

    // Remove mcp_ prefix to get actual server name
    if (!serverNameWithPrefix.startsWith("mcp_")) {
      return {
        success: false,
        error: `Invalid MCP method format: ${method}`,
      };
    }

    const serverName = serverNameWithPrefix.substring(4); // Remove "mcp_"

    // Check if it's a resource call (starts with resource_)
    if (operationName.startsWith("resource_")) {
      const resourceName = operationName.substring(9); // Remove "resource_"
      return await executeMcpResource(
        this.state.clientManager,
        this.state.schemaFetcher,
        serverName,
        resourceName,
        args
      );
    } else {
      // It's a tool call
      return await executeMcpTool(
        this.state.clientManager,
        serverName,
        operationName,
        args
      );
    }
  }

  /**
   * Get all MCP schemas for type generation
   */
  getSchemas(): McpServerSchemas[] {
    if (!this.state) {
      return [];
    }
    return this.state.schemaFetcher.getAllSchemas();
  }

  /**
   * Get list of connected MCP server names
   */
  getConnectedServers(): string[] {
    if (!this.state) {
      return [];
    }
    return this.state.clientManager.getConnectedServerNames();
  }

  /**
   * Check if MCP integration is enabled
   */
  isEnabled(): boolean {
    return this.state !== null;
  }
}
