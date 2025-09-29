// Simple WebSocket RPC server

import { Hono } from "@hono/hono";
import { upgradeWebSocket } from "@hono/hono/deno";
import { execute_llm_script } from "../execute_llm_script.ts";
import { execute_rpc } from "./execute_rpc.ts";
import { discover_rpc_files, type RpcFile } from "./load_rpc_files.ts";

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
      const types = await this.generateTypes();
      return c.text(types);
    });

    this.app.get("/client.ts", async (c) => {
      const clientCode = await this.generateClientCode();
      return c.text(clientCode);
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
              // Handle as RPC call
              const msg: RpcMessage = parsed;
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

  async start(port: number): Promise<void> {
    // Initial load of RPC files
    await this.refreshRpcFiles();

    // Start file watcher for continuous monitoring
    await this.startFileWatcher();

    console.error(`Starting RPC server on port ${port}`);
    console.error(
      `Available functions: ${Array.from(this.rpcFiles.keys()).join(", ")}`
    );

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

    // Note: Deno.watchFs doesn't have a direct close method,
    // but the async iterator will be garbage collected
    this.fileWatcher = undefined;
  }

  private async generateTypes(): Promise<string> {
    if (this.rpcFiles.size === 0) {
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
    const extractionResults = [];

    for (const file of uniqueFiles.values()) {
      try {
        console.error(`Extracting types from: ${file.name}`);
        const result = extractor.extractFromFile(file.path);
        extractionResults.push(result);
      } catch (err) {
        console.error(`Error extracting types from ${file.name}:`, err);
      }
    }

    return generator.generateTypesOnly(extractionResults);
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
    const extractionResults = [];

    for (const file of uniqueFiles.values()) {
      try {
        const result = extractor.extractFromFile(file.path);
        extractionResults.push(result);
      } catch (err) {
        console.error(
          `Error extracting types for client from ${file.name}:`,
          err
        );
      }
    }

    return generator.generateFullClient(extractionResults, {
      websocketUrl: `ws://localhost:${config.port}/ws`,
      timeout: 10000,
      clientClassName: "RpcClient",
      includeInterfaces: true,
    });
  }
}
