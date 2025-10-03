/**
 * WebSocketRpcServer - Thin Orchestrator
 *
 * Composes and coordinates all manager classes to provide
 * a complete WebSocket RPC server.
 *
 * Responsibilities:
 * - Manager composition and initialization
 * - Lifecycle orchestration (start/stop)
 * - Wiring managers together with callbacks
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import type { Hono } from "@hono/hono";
import { upgradeWebSocket } from "@hono/hono/deno";
import { get_client, set_client } from "../client_cache.ts";
import type { McpConfigFile } from "../external-mcps/mcp_config.ts";
import { WorkerManager } from "./worker_manager.ts";
import { RpcCacheManager } from "./managers/rpc_cache_manager.ts";
import { FileWatcherManager } from "./managers/file_watcher_manager.ts";
import { TypeGeneratorManager } from "./managers/type_generator_manager.ts";
import { McpIntegrationManager } from "./managers/mcp_integration_manager.ts";
import { MessageRouter } from "./managers/message_router.ts";
import { ConnectionManager } from "./managers/connection_manager.ts";
import { OpenApiRouteHandler } from "./managers/openapi_route_handler.ts";

export class WebSocketRpcServer {
  private app = new OpenAPIHono();

  // Manager composition
  private rpcCacheManager: RpcCacheManager;
  private fileWatcherManager: FileWatcherManager;
  private typeGeneratorManager: TypeGeneratorManager;
  private mcpIntegrationManager: McpIntegrationManager;
  private connectionManager: ConnectionManager;
  private messageRouter!: MessageRouter; // Initialized in start()
  private workerManager: WorkerManager | null = null;

  private currentPort = 0;

  constructor() {
    // Initialize independent managers
    this.rpcCacheManager = new RpcCacheManager();
    this.fileWatcherManager = new FileWatcherManager();
    this.typeGeneratorManager = new TypeGeneratorManager(this.rpcCacheManager);
    this.mcpIntegrationManager = new McpIntegrationManager();
    this.connectionManager = new ConnectionManager();
  }

  /**
   * Wire managers together with event callbacks
   */
  private wireManagers(): void {
    // RPC cache refresh triggers:
    // 1. Type cache invalidation
    this.rpcCacheManager.onCacheRefreshed(() => {
      this.typeGeneratorManager.invalidateCache();
    });

    // 2. Client notifications
    this.rpcCacheManager.onCacheRefreshed((functions) => {
      this.connectionManager.broadcastToClients({
        type: "functions_updated",
        functions,
      });
    });

    // 3. Client code regeneration and caching
    this.rpcCacheManager.onCacheRefreshed(async () => {
      try {
        const schemas = this.mcpIntegrationManager.isEnabled()
          ? this.mcpIntegrationManager.getSchemas()
          : undefined;
        const clientCode = await this.typeGeneratorManager.generateClientCode(
          this.currentPort,
          schemas
        );
        set_client(clientCode);
      } catch (err) {
        console.error("Failed to regenerate client code:", err);
      }
    });

    // 4. Worker restarts
    this.rpcCacheManager.onCacheRefreshed(async () => {
      if (this.workerManager) {
        const uniqueFiles = this.rpcCacheManager.getUniqueFiles();
        await Promise.all(
          Array.from(uniqueFiles.values()).map((file) =>
            this.workerManager!.restartWorker(file.name, file)
          )
        );
      }
    });
  }

  /**
   * Start the RPC server
   */
  async start(port: number, mcpConfig: McpConfigFile | null): Promise<void> {
    this.currentPort = port;

    // Phase 1: Initial RPC cache load
    console.error("Loading RPC files...");
    await this.rpcCacheManager.refreshCache();

    // Phase 2: Initialize MCP if config provided
    if (mcpConfig) {
      await this.mcpIntegrationManager.initialize(mcpConfig);
      console.error(
        `Connected MCP servers: ${this.mcpIntegrationManager.getConnectedServers().join(", ")}`
      );
    }

    // Phase 2.5: Generate initial client code
    const schemas = this.mcpIntegrationManager.isEnabled()
      ? this.mcpIntegrationManager.getSchemas()
      : undefined;
    const clientCode = await this.typeGeneratorManager.generateClientCode(
      port,
      schemas
    );
    set_client(clientCode);
    console.error("Generated initial client code");

    // Phase 3: Wire managers together
    this.wireManagers();

    // Phase 4: Setup message routing (depends on worker manager, but we'll initialize it later)
    // We'll create a lazy wrapper for now
    this.workerManager = new WorkerManager(port);
    this.messageRouter = new MessageRouter(
      this.workerManager,
      this.mcpIntegrationManager
    );

    // Phase 5: Setup HTTP routes with OpenAPI documentation
    this.setupRoutes();

    // Phase 7: Start file watcher
    const { get_config } = await import("../get_config.ts");
    const config = get_config();
    this.fileWatcherManager.startWatching(config.rpc_dir, async () => {
      await this.rpcCacheManager.refreshCache();
    });

    // Phase 8: Start HTTP server
    console.error(`Starting RPC server on port ${port}`);
    console.error(
      `Available RPC functions: ${this.rpcCacheManager.getFunctionNames().join(", ")}`
    );
    Deno.serve({ port }, this.app.fetch);

    // Give server time to start
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Phase 9: Initialize workers
    const uniqueFiles = this.rpcCacheManager.getUniqueFiles();
    await Promise.all(
      Array.from(uniqueFiles.values()).map((file) =>
        this.workerManager!.startWorker(file)
      )
    );

    // Wait for workers to be ready
    await this.workerManager.waitForReady(5000);
    console.error(`[Server] All workers initialized`);
  }

  /**
   * Stop the RPC server
   */
  async stop(): Promise<void> {
    console.error("Stopping RPC server...");

    // Stop workers
    if (this.workerManager) {
      await this.workerManager.stopAllWorkers();
      this.workerManager = null;
    }

    // Close all client connections
    await this.connectionManager.closeAllClients();

    // Shutdown MCP
    await this.mcpIntegrationManager.shutdown();

    // Stop file watcher
    this.fileWatcherManager.stopWatching();

    console.error("RPC server stopped");
  }

  /**
   * Setup all HTTP and WebSocket routes
   */
  private setupRoutes(): void {
    // Setup OpenAPI-documented REST routes
    const openApiHandler = new OpenApiRouteHandler(
      this.app,
      this.rpcCacheManager,
      this.typeGeneratorManager,
      this.mcpIntegrationManager,
      get_client,
      this.currentPort
    );
    openApiHandler.setupRoutes();

    // Setup WebSocket routes (cannot be documented via OpenAPI)
    this.setupWebSocketRoutes();
  }

  /**
   * Setup WebSocket routes
   * Note: WebSocket routes cannot be documented via OpenAPI specification
   */
  private setupWebSocketRoutes(): void {
    // Cast to Hono for WebSocket routes (OpenAPIHono extends Hono but upgradeWebSocket has strict typing)
    const honoApp = this.app as unknown as Hono;

    honoApp.get(
      "/worker-ws",
      upgradeWebSocket(() => {
        return this.connectionManager.createWorkerWebSocketHandler(
          this.workerManager!
        );
      })
    );

    honoApp.get(
      "/ws",
      upgradeWebSocket(() => {
        return this.connectionManager.createClientWebSocketHandler(
          this.messageRouter,
          () => this.rpcCacheManager.getFunctionNames()
        );
      })
    );
  }
}
