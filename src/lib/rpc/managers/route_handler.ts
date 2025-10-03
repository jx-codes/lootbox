/**
 * RouteHandler
 *
 * Manages HTTP route definitions for the RPC server.
 * Handles:
 * - Health check endpoint
 * - Namespace discovery endpoints
 * - Type generation endpoints
 * - Client code endpoint
 * - WebSocket endpoints (client and worker)
 */

import type { Hono } from "@hono/hono";
import type { RpcCacheManager } from "./rpc_cache_manager.ts";
import type { TypeGeneratorManager } from "./type_generator_manager.ts";
import type { McpIntegrationManager } from "./mcp_integration_manager.ts";

export class RouteHandler {
  constructor(
    private rpcCacheManager: RpcCacheManager,
    private typeGeneratorManager: TypeGeneratorManager,
    private mcpIntegrationManager: McpIntegrationManager,
    private clientCacheGetter: () => { code: string },
    private port: number
  ) {}

  /**
   * Setup all routes on the Hono app
   */
  setupRoutes(app: Hono): void {
    this.setupHealthRoutes(app);
    this.setupTypeRoutes(app);
  }

  /**
   * Setup health and metadata routes
   */
  private setupHealthRoutes(app: Hono): void {
    app.get("/health", (c) => {
      return c.json({
        status: "ok",
        functions: this.rpcCacheManager.getFunctionNames(),
      });
    });

    app.get("/namespaces", async (c) => {
      const schemas = this.mcpIntegrationManager.isEnabled()
        ? this.mcpIntegrationManager.getSchemas()
        : undefined;
      const namespaces = await this.typeGeneratorManager.getAvailableNamespaces(
        schemas
      );
      return c.json(namespaces);
    });

    app.get("/rpc-namespaces", async (c) => {
      const schemas = this.mcpIntegrationManager.isEnabled()
        ? this.mcpIntegrationManager.getSchemas()
        : undefined;
      const metadata = await this.typeGeneratorManager.getNamespaceMetadata(
        schemas
      );
      return c.text(metadata);
    });
  }

  /**
   * Setup type and client code routes
   */
  private setupTypeRoutes(app: Hono): void {
    app.get("/types", async (c) => {
      let cached = this.typeGeneratorManager.getCachedTypes();
      if (!cached) {
        const schemas = this.mcpIntegrationManager.isEnabled()
          ? this.mcpIntegrationManager.getSchemas()
          : undefined;
        cached = await this.typeGeneratorManager.generateTypes(schemas);
        this.typeGeneratorManager.setCachedTypes(cached);
      }
      return c.text(cached);
    });

    app.get("/types/:namespaces", async (c) => {
      const namespacesParam = c.req.param("namespaces");
      const requestedNamespaces = namespacesParam
        .split(",")
        .map((ns) => ns.trim());
      const schemas = this.mcpIntegrationManager.isEnabled()
        ? this.mcpIntegrationManager.getSchemas()
        : undefined;
      const types = await this.typeGeneratorManager.generateNamespaceTypes(
        requestedNamespaces,
        this.port,
        schemas
      );
      return c.text(types);
    });

    app.get("/client.ts", (c) => {
      const client = this.clientCacheGetter();
      return c.text(client.code);
    });
  }

}
