// MCP client lifecycle management

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"; 
import type { McpServerConfig } from "./mcp_config.ts";
import { VERSION } from "../../version.ts";

export class McpClientManager {
  private clients: Map<string, Client>;
  private connectionStatus: Map<string, "connected" | "failed">;

  constructor() {
    this.clients = new Map();
    this.connectionStatus = new Map();
  }

  /**
   * Initialize all MCP clients from configuration
   */
  async initializeClients(
    configs: Record<string, McpServerConfig>
  ): Promise<void> {
    const promises = Object.entries(configs).map(([serverName, config]) =>
      this.connectClient(serverName, config)
    );

    await Promise.allSettled(promises);

    const connected = this.getConnectedServerNames();
    const failed = Array.from(this.connectionStatus.entries())
      .filter(([_, status]) => status === "failed")
      .map(([name]) => name);

    console.error(
      `MCP Clients initialized: ${connected.length} connected, ${failed.length} failed`
    );
    if (connected.length > 0) {
      console.error(`Connected servers: ${connected.join(", ")}`);
    }
    if (failed.length > 0) {
      console.error(`Failed servers: ${failed.join(", ")}`);
    }
  }

  /**
   * Connect to a single MCP server
   */
  async connectClient(
    serverName: string,
    config: McpServerConfig
  ): Promise<void> {
    try {
      console.error(`Connecting to MCP server: ${serverName}...`);

      const transports = {
        stdio: () =>
          new StdioClientTransport({
            command: config.command,
            args: config.args,
            env: { ...Deno.env.toObject(), ...config.env },
          }),
        streamable_http: () =>
          new StreamableHTTPClientTransport(new URL(config.url)),
        sse: () => new SSEClientTransport(new URL(config.url)),
      };

      const transport = transports[config.transport]?.() ??
        (() => {
          throw new Error("Invalid MCP server config.");
        })();

      const client = new Client(
        {
          name: "lootbox",
          version: VERSION,
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);

      this.clients.set(serverName, client);
      this.connectionStatus.set(serverName, "connected");

      console.error(`Successfully connected to MCP server: ${serverName}`);
    } catch (error) {
      this.connectionStatus.set(serverName, "failed");
      console.error(
        `Failed to connect to MCP server '${serverName}':`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get a connected client by server name
   * Returns undefined if server failed to connect or doesn't exist
   */
  getClient(serverName: string): Client | undefined {
    return this.clients.get(serverName);
  }

  /**
   * Get list of successfully connected server names
   */
  getConnectedServerNames(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get connection status for a specific server
   */
  getConnectionStatus(serverName: string): "connected" | "failed" | "unknown" {
    return this.connectionStatus.get(serverName) || "unknown";
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses(): Record<
    string,
    "connected" | "failed" | "unknown"
  > {
    const statuses: Record<string, "connected" | "failed" | "unknown"> = {};
    for (const [name, status] of this.connectionStatus.entries()) {
      statuses[name] = status;
    }
    return statuses;
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnectAll(): Promise<void> {
    console.error(`Disconnecting ${this.clients.size} MCP clients...`);

    const promises = Array.from(this.clients.entries()).map(
      async ([serverName, client]) => {
        try {
          await client.close();
          console.error(`Disconnected from MCP server: ${serverName}`);
        } catch (error) {
          console.error(
            `Error disconnecting from MCP server '${serverName}':`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    );

    await Promise.allSettled(promises);

    this.clients.clear();
    this.connectionStatus.clear();
  }
}
