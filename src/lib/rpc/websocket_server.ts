// Simple WebSocket RPC server

import { Hono } from "@hono/hono";
import { upgradeWebSocket } from "@hono/hono/deno";
import { execute_llm_script } from "../execute_llm_script.ts";
import { execute_rpc } from "./execute_rpc.ts";
import { discover_rpc_files, type RpcFile } from "./load_rpc_files.ts";
import { McpClientManager } from "../external-mcps/mcp_client_manager.ts";
import { McpSchemaFetcher } from "../external-mcps/mcp_schema_fetcher.ts";
import { executeMcpTool, executeMcpResource } from "./execute_mcp.ts";
import { convertMcpSchemasToExtractionResults } from "../external-mcps/parse_mcp_schemas.ts";
import type { McpConfigFile } from "../external-mcps/mcp_config.ts";

// Type for Hono WebSocket context
interface WebSocketContext {
  send(message: string): void;
  close(): void;
}

interface RpcMessage {
  method: string;
  args?: unknown; // Now a single object instead of array
  id?: string;
}

interface ScriptMessage {
  script: string;
  id?: string;
}

interface RpcResponse {
  result?: unknown;
  error?: string;
  id?: string;
}

export class WebSocketRpcServer {
  private app = new Hono();
  private rpcFiles = new Map<string, RpcFile>();
  private connectedClients = new Set<WebSocketContext>();
  private fileWatcher?: Deno.FsWatcher;
  private mcpState: {
    clientManager: McpClientManager;
    schemaFetcher: McpSchemaFetcher;
  } | null = null;
  private cachedClientCode: string | null = null;
  private cachedTypes: string | null = null;

  constructor() {
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get("/health", (c) => {
      return c.json({
        status: "ok",
        functions: Array.from(this.rpcFiles.keys()),
      });
    });

    this.app.get("/types", async (c) => {
      if (!this.cachedTypes) {
        this.cachedTypes = await this.generateTypes();
      }
      return c.text(this.cachedTypes);
    });

    this.app.get("/client.ts", async (c) => {
      if (!this.cachedClientCode) {
        this.cachedClientCode = await this.generateClientCode();
      }
      return c.text(this.cachedClientCode);
    });

    this.app.get(
      "/ws",
      upgradeWebSocket(() => ({
        onOpen: (_event, ws) => {
          console.error("WebSocket connected");
          this.connectedClients.add(ws);
          ws.send(
            JSON.stringify({
              type: "welcome",
              functions: Array.from(this.rpcFiles.keys()),
            })
          );
        },

        onMessage: async (event, ws) => {
          try {
            console.error("📨 WebSocket received message");
            const data =
              typeof event.data === "string"
                ? event.data
                : new TextDecoder().decode(
                    new Uint8Array(event.data as ArrayBuffer)
                  );

            const parsed = JSON.parse(data);
            console.error(
              `📋 Parsed message type: ${
                "script" in parsed ? "SCRIPT" : "RPC"
              }`,
              { id: parsed.id }
            );
            const response: RpcResponse = { id: parsed.id };

            // Check if this is a script execution request
            if ("script" in parsed) {
              console.error("🎬 Starting script execution...");
              const scriptMsg: ScriptMessage = parsed;
              console.error(
                `📄 Script length: ${scriptMsg.script.length} chars`
              );

              const result = await execute_llm_script(scriptMsg.script);
              console.error("✅ Script execution completed", {
                success: result.success,
              });

              if (result.success) {
                response.result = result.output;
              } else {
                response.error = result.error;
              }
            } else {
              // Handle as RPC or MCP call
              const msg: RpcMessage = parsed;

              // Check if this is an MCP call (starts with mcp_)
              if (msg.method.startsWith('mcp_')) {
                if (!this.mcpState) {
                  response.error = 'MCP is not enabled on this server';
                } else {
                  const result = await this.handleMcpCall(msg.method, msg.args);
                  if (result.success) {
                    response.result = result.data;
                  } else {
                    response.error = result.error;
                  }
                }
              } else {
                // Handle as regular RPC call
                const rpcFile = this.rpcFiles.get(msg.method);
                if (!rpcFile) {
                  response.error = `Unknown method: ${msg.method}`;
                } else {
                  // Extract original function name from namespaced method (e.g., "pokemon.fetchPokemon" -> "fetchPokemon")
                  const functionName = msg.method.includes('.') ? msg.method.split('.')[1] : msg.method;
                  const result = await execute_rpc({
                    file: rpcFile.path,
                    functionName: functionName,
                    params: msg.args || {},
                  });

                  if (result.success) {
                    response.result = result.data;
                  } else {
                    response.error = result.error;
                  }
                }
              }
            }

            console.error("📤 Sending response back to client", {
              hasResult: !!response.result,
              hasError: !!response.error,
            });
            ws.send(JSON.stringify(response));
          } catch (error) {
            console.error("❌ WebSocket message error:", error);
            ws.send(
              JSON.stringify({
                error: "Invalid message format",
                id: null,
              })
            );
          }
        },

        onClose: (_event, ws) => {
          console.error("WebSocket disconnected");
          this.connectedClients.delete(ws);
        },
        onError: (error) => console.error("WebSocket error:", error),
      }))
    );
  }

  private async refreshRpcFiles(): Promise<void> {
    try {
      const { TypeExtractor } = await import(
        "../type_system/type_extractor.ts"
      );
      const files = await discover_rpc_files();
      const extractor = new TypeExtractor();

      // Clear existing cache
      this.rpcFiles.clear();

      // Invalidate cached client and types
      this.cachedClientCode = null;
      this.cachedTypes = null;

      // Rebuild function cache with namespaced method names
      for (const file of files) {
        try {
          const result = extractor.extractFromFile(file.path);
          for (const func of result.functions) {
            const namespacedMethod = `${file.name}.${func.name}`;
            this.rpcFiles.set(namespacedMethod, file);
          }
        } catch (err) {
          console.error(`Error discovering functions in ${file.name}:`, err);
        }
      }

      const functionNames = Array.from(this.rpcFiles.keys());
      console.error(`RPC functions updated: ${functionNames.join(", ")}`);

      // Notify all connected clients about function updates
      const updateMessage = JSON.stringify({
        type: "functions_updated",
        functions: functionNames,
      });

      for (const client of this.connectedClients) {
        try {
          client.send(updateMessage);
        } catch (err) {
          console.error("Failed to notify client of function updates:", err);
          this.connectedClients.delete(client);
        }
      }
    } catch (err) {
      console.error("Failed to refresh RPC files:", err);
    }
  }

  private async startFileWatcher(): Promise<void> {
    const { get_config } = await import("../get_config.ts");
    const config = get_config();

    try {
      this.fileWatcher = Deno.watchFs(config.rpc_dir);
      console.error(`Watching RPC directory: ${config.rpc_dir}`);

      // Start watching in background
      (async () => {
        try {
          for await (const event of this.fileWatcher!) {
            // Only react to TypeScript file changes
            if (event.paths.some((path) => path.endsWith(".ts"))) {
              console.error(
                `File system event: ${event.kind} - ${event.paths.join(", ")}`
              );

              // Debounce rapid file changes
              await new Promise((resolve) => setTimeout(resolve, 100));
              await this.refreshRpcFiles();
            }
          }
        } catch (err) {
          console.error("File watcher error:", err);
        }
      })();
    } catch (err) {
      console.error("Failed to start file watcher:", err);
    }
  }

  async start(port: number, mcpConfig: McpConfigFile | null): Promise<void> {
    // Initial load of RPC files
    await this.refreshRpcFiles();

    // Initialize MCP if config provided
    if (mcpConfig) {
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

      this.mcpState = { clientManager, schemaFetcher };
      console.error("MCP integration initialized successfully");
    }

    // Start file watcher for continuous monitoring
    await this.startFileWatcher();

    console.error(`Starting RPC server on port ${port}`);
    console.error(
      `Available RPC functions: ${Array.from(this.rpcFiles.keys()).join(", ")}`
    );
    if (this.mcpState) {
      const mcpServers = this.mcpState.clientManager.getConnectedServerNames();
      console.error(`Connected MCP servers: ${mcpServers.join(", ")}`);
    }

    Deno.serve({ port }, this.app.fetch);
  }

  async stop(): Promise<void> {
    console.error("Stopping RPC server...");

    // Close all WebSocket connections
    for (const client of this.connectedClients) {
      try {
        client.close();
      } catch (err) {
        console.error("Error closing WebSocket connection:", err);
      }
    }
    this.connectedClients.clear();

    // Disconnect MCP clients
    if (this.mcpState) {
      await this.mcpState.clientManager.disconnectAll();
      this.mcpState = null;
    }

    // Note: Deno.watchFs doesn't have a direct close method,
    // but the async iterator will be garbage collected
    this.fileWatcher = undefined;
  }

  /**
   * Handle MCP tool or resource call
   */
  private async handleMcpCall(
    method: string,
    args: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.mcpState) {
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
        this.mcpState.clientManager,
        this.mcpState.schemaFetcher,
        serverName,
        resourceName,
        args
      );
    } else {
      // It's a tool call
      return await executeMcpTool(
        this.mcpState.clientManager,
        serverName,
        operationName,
        args
      );
    }
  }

  private async generateTypes(): Promise<string> {
    if (this.rpcFiles.size === 0 && !this.mcpState) {
      return "// No RPC files found";
    }

    const { TypeExtractor } = await import("../type_system/type_extractor.ts");
    const { ClientGenerator } = await import(
      "../type_system/client_generator.ts"
    );

    // Use cached RPC files instead of rescanning directory
    const uniqueFiles = new Map<string, RpcFile>();
    for (const file of this.rpcFiles.values()) {
      uniqueFiles.set(file.path, file);
    }

    const extractor = new TypeExtractor();
    const generator = new ClientGenerator();
    const rpcExtractionResults = [];

    for (const file of uniqueFiles.values()) {
      try {
        console.error(`Extracting types from: ${file.name}`);
        const result = extractor.extractFromFile(file.path);
        rpcExtractionResults.push(result);
      } catch (err) {
        console.error(`Error extracting types from ${file.name}:`, err);
      }
    }

    // Add MCP types if MCP is enabled
    if (this.mcpState) {
      const mcpSchemas = this.mcpState.schemaFetcher.getAllSchemas();
      const mcpExtractionResults = convertMcpSchemasToExtractionResults(
        mcpSchemas
      );
      return generator.generateTypesOnlyWithMcp(
        rpcExtractionResults,
        mcpExtractionResults
      );
    }

    return generator.generateTypesOnly(rpcExtractionResults);
  }

  private async generateClientCode(): Promise<string> {
    const { TypeExtractor } = await import("../type_system/type_extractor.ts");
    const { ClientGenerator } = await import(
      "../type_system/client_generator.ts"
    );
    const { get_config } = await import("../get_config.ts");

    const config = get_config();

    // Use cached RPC files instead of rescanning directory
    const uniqueFiles = new Map<string, RpcFile>();
    for (const file of this.rpcFiles.values()) {
      uniqueFiles.set(file.path, file);
    }

    const extractor = new TypeExtractor();
    const generator = new ClientGenerator();
    const rpcExtractionResults = [];

    for (const file of uniqueFiles.values()) {
      try {
        const result = extractor.extractFromFile(file.path);
        rpcExtractionResults.push(result);
      } catch (err) {
        console.error(
          `Error extracting types for client from ${file.name}:`,
          err
        );
      }
    }

    const options = {
      websocketUrl: `ws://localhost:${config.port}/ws`,
      timeout: 10000,
      clientClassName: "RpcClient",
      includeInterfaces: true,
    };

    // Generate client with MCP integration if enabled
    if (this.mcpState) {
      const mcpSchemas = this.mcpState.schemaFetcher.getAllSchemas();
      const mcpExtractionResults = convertMcpSchemasToExtractionResults(
        mcpSchemas
      );
      return generator.generateFullClientWithMcp(
        rpcExtractionResults,
        mcpExtractionResults,
        options
      );
    }

    return generator.generateFullClient(rpcExtractionResults, options);
  }
}
