// Simple WebSocket RPC server

import { Hono } from "@hono/hono";
import { upgradeWebSocket } from "@hono/hono/deno";
import { get_client, set_client } from "../client_cache.ts";
import { execute_llm_script } from "../execute_llm_script.ts";
import { McpClientManager } from "../external-mcps/mcp_client_manager.ts";
import type { McpConfigFile } from "../external-mcps/mcp_config.ts";
import { McpSchemaFetcher } from "../external-mcps/mcp_schema_fetcher.ts";
import { convertMcpSchemasToExtractionResults } from "../external-mcps/parse_mcp_schemas.ts";
import { executeMcpResource, executeMcpTool } from "./execute_mcp.ts";
import { discover_rpc_files, type RpcFile } from "./load_rpc_files.ts";
import { WorkerManager } from "./worker_manager.ts";

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
  sessionId?: string;
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
  private workerManager: WorkerManager | null = null;

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

    this.app.get("/namespaces", async (c) => {
      const namespaces = await this.getAvailableNamespaces();
      return c.json(namespaces);
    });

    this.app.get("/rpc-namespaces", async (c) => {
      const metadata = await this.getRpcNamespaces();
      return c.text(metadata);
    });

    this.app.get("/types", async (c) => {
      if (!this.cachedTypes) {
        this.cachedTypes = await this.generateTypes();
      }
      return c.text(this.cachedTypes);
    });

    this.app.get("/types/:namespaces", async (c) => {
      const namespacesParam = c.req.param("namespaces");
      const requestedNamespaces = namespacesParam.split(",").map(ns => ns.trim());
      const types = await this.generateNamespaceTypes(requestedNamespaces);
      return c.text(types);
    });

    this.app.get("/client.ts", (c) => {
      const client = get_client();
      return c.text(client.code);
    });

    this.app.get(
      "/worker-ws",
      upgradeWebSocket(() => {
        let workerId: string | null = null;

        return {
          onOpen: (_event, ws) => {
            console.error("Worker WebSocket connected");

            // Register send callback immediately
            if (this.workerManager) {
              // We'll set the workerId when we get the identify message
              // For now, just store the ws reference
            }
          },

          onMessage: (event, ws) => {
            if (!this.workerManager) return;

            const data =
              typeof event.data === "string"
                ? event.data
                : new TextDecoder().decode(
                    new Uint8Array(event.data as ArrayBuffer)
                  );

            // Parse to get workerId from identify message
            try {
              const msg = JSON.parse(data);
              if (msg.type === "identify" && msg.workerId) {
                const id = msg.workerId as string;
                workerId = id;
                // Register the send callback for this worker
                this.workerManager.registerWorkerSender(
                  id,
                  (message: string) => {
                    ws.send(message);
                  }
                );
              }
            } catch {
              // Ignore parse errors
            }

            // Forward all messages to worker manager
            this.workerManager.handleMessage(data);
          },

          onClose: () => {
            console.error("Worker WebSocket disconnected");
            if (this.workerManager && workerId) {
              this.workerManager.handleDisconnect(workerId);
            }
          },

          onError: (error) => console.error("Worker WebSocket error:", error),
        };
      })
    );

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

              const result = await execute_llm_script({
                script: scriptMsg.script,
                sessionId: scriptMsg.sessionId,
              });
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
              if (msg.method.startsWith("mcp_")) {
                if (!this.mcpState) {
                  response.error = "MCP is not enabled on this server";
                } else {
                  const result = await this.handleMcpCall(msg.method, msg.args);
                  if (result.success) {
                    response.result = result.data;
                  } else {
                    response.error = result.error;
                  }
                }
              } else {
                // Handle as regular RPC call via worker
                if (!msg.method.includes(".")) {
                  response.error = `Invalid method format: ${msg.method}. Expected: namespace.functionName`;
                } else {
                  const [namespace, functionName] = msg.method.split(".");

                  if (!this.workerManager) {
                    response.error = "Worker manager not initialized";
                  } else {
                    try {
                      const result = await this.workerManager.callFunction(
                        namespace,
                        functionName,
                        msg.args || {}
                      );
                      response.result = result;
                    } catch (error) {
                      response.error =
                        error instanceof Error ? error.message : String(error);
                    }
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

      // Generate client eagerly when files change
      const clientCode = await this.generateClientCode();
      set_client(clientCode);

      // Restart affected workers with new code
      if (this.workerManager) {
        const uniqueFiles = this.getUniqueRpcFiles();
        await Promise.all(
          Array.from(uniqueFiles.values()).map((file) =>
            this.workerManager!.restartWorker(file.name, file)
          )
        );
      }

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
    // Initial load of RPC files (for type extraction)
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

    // Start the HTTP server first
    Deno.serve({ port }, this.app.fetch);

    // Give the server a moment to start listening
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Now initialize worker manager and start workers
    this.workerManager = new WorkerManager(port);

    // Start workers for all RPC files
    const uniqueFiles = this.getUniqueRpcFiles();
    await Promise.all(
      Array.from(uniqueFiles.values()).map((file) =>
        this.workerManager!.startWorker(file)
      )
    );

    // Wait for workers to be ready (5 second timeout)
    await this.workerManager.waitForReady(5000);
    console.error(`[Server] All workers initialized`);
  }

  async stop(): Promise<void> {
    console.error("Stopping RPC server...");

    // Stop all workers
    if (this.workerManager) {
      await this.workerManager.stopAllWorkers();
      this.workerManager = null;
    }

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
   * Get unique RPC files (one per file path)
   */
  private getUniqueRpcFiles(): Map<string, RpcFile> {
    const uniqueFiles = new Map<string, RpcFile>();
    for (const file of this.rpcFiles.values()) {
      uniqueFiles.set(file.path, file);
    }
    return uniqueFiles;
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
        console.error(`Extracting types from: ${file.name}`);
        const result = extractor.extractFromFile(file.path);
        rpcExtractionResults.push(result);
      } catch (err) {
        console.error(`Error extracting types from ${file.name}:`, err);
      }
    }

    // Generate lightweight type summary with MCP integration
    const mcpExtractionResults = this.mcpState
      ? convertMcpSchemasToExtractionResults(
          this.mcpState.schemaFetcher.getAllSchemas()
        )
      : [];

    return generator.generateTypesSummary(
      rpcExtractionResults,
      mcpExtractionResults,
      config.port
    );
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
   * Get list of available namespaces
   */
  private async getAvailableNamespaces(): Promise<{ rpc: string[]; mcp: string[] }> {
    const { TypeExtractor } = await import("../type_system/type_extractor.ts");
    const { ClientGenerator } = await import("../type_system/client_generator.ts");

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
        console.error(`Error extracting types from ${file.name}:`, err);
      }
    }

    const mcpExtractionResults = this.mcpState
      ? convertMcpSchemasToExtractionResults(
          this.mcpState.schemaFetcher.getAllSchemas()
        )
      : [];

    return generator.getAvailableNamespaces(rpcExtractionResults, mcpExtractionResults);
  }

  /**
   * Get RPC namespaces with metadata (for LLM discovery)
   */
  private async getRpcNamespaces(): Promise<string> {
    const { TypeExtractor } = await import("../type_system/type_extractor.ts");
    const { ClientGenerator } = await import("../type_system/client_generator.ts");

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
        console.error(`Error extracting types from ${file.name}:`, err);
      }
    }

    const mcpExtractionResults = this.mcpState
      ? convertMcpSchemasToExtractionResults(
          this.mcpState.schemaFetcher.getAllSchemas()
        )
      : [];

    const metadata = generator.getNamespaceMetadata(rpcExtractionResults, mcpExtractionResults);

    // Format as text with instruction block
    let output = "Available Namespaces:\n\n";

    output += "<namespaces>\n";

    // Combine RPC and MCP namespaces (MCP namespaces are prefixed with mcp_)
    const allNamespaces = [
      ...metadata.rpc,
      ...metadata.mcp.map(ns => ({ ...ns, name: `mcp_${ns.name}` }))
    ];

    if (allNamespaces.length > 0) {
      for (const ns of allNamespaces) {
        output += `- ${ns.name} (${ns.functionCount} function${ns.functionCount !== 1 ? 's' : ''})`;
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
   * Generate types for specific namespaces
   */
  private async generateNamespaceTypes(namespaces: string[]): Promise<string> {
    const { TypeExtractor } = await import("../type_system/type_extractor.ts");
    const { ClientGenerator } = await import("../type_system/client_generator.ts");
    const { NamespaceFilter } = await import("../type_system/namespace_filter.ts");
    const { get_config } = await import("../get_config.ts");

    const config = get_config();

    const uniqueFiles = new Map<string, RpcFile>();
    for (const file of this.rpcFiles.values()) {
      uniqueFiles.set(file.path, file);
    }

    const extractor = new TypeExtractor();
    const generator = new ClientGenerator();
    const filter = new NamespaceFilter(generator);
    const rpcExtractionResults = [];

    for (const file of uniqueFiles.values()) {
      try {
        const result = extractor.extractFromFile(file.path);
        rpcExtractionResults.push(result);
      } catch (err) {
        console.error(`Error extracting types from ${file.name}:`, err);
      }
    }

    const mcpExtractionResults = this.mcpState
      ? convertMcpSchemasToExtractionResults(
          this.mcpState.schemaFetcher.getAllSchemas()
        )
      : [];

    return filter.generateNamespaceTypes(
      rpcExtractionResults,
      mcpExtractionResults,
      namespaces,
      config.port
    );
  }
}
