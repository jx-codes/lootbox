/**
 * OpenApiRouteHandler - OpenAPI-documented REST Routes
 *
 * Provides type-safe, auto-documented REST endpoints using @hono/zod-openapi.
 * Replaces manual route definitions with schema-validated routes that generate
 * OpenAPI specifications automatically.
 *
 * Responsibilities:
 * - Define OpenAPI-documented routes with Zod validation
 * - Serve health and metadata endpoints
 * - Serve TypeScript type generation endpoints
 * - Serve RPC client code generation endpoint
 * - Provide OpenAPI spec and Swagger UI
 */

import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
  ClientCodeResponseSchema,
  HealthResponseSchema,
  NamespaceTypesParamSchema,
  NamespaceTypesResponseSchema,
  NamespacesResponseSchema,
  RpcNamespaceMetadataResponseSchema,
  TypesResponseSchema,
} from "../schemas/openapi_schemas.ts";
import type { McpIntegrationManager } from "./mcp_integration_manager.ts";
import type { RpcCacheManager } from "./rpc_cache_manager.ts";
import type { TypeGeneratorManager } from "./type_generator_manager.ts";
import { VERSION } from "../../../version.ts";

export class OpenApiRouteHandler {
  constructor(
    private app: OpenAPIHono,
    private rpcCacheManager: RpcCacheManager,
    private typeGeneratorManager: TypeGeneratorManager,
    private mcpIntegrationManager: McpIntegrationManager,
    private clientCacheGetter: () => { code: string },
    private port: number
  ) {}

  setupRoutes(): void {
    this.setupHealthRoutes();
    this.setupTypeRoutes();
    this.setupDocRoutes();
  }

  /**
   * Health and metadata routes
   */
  private setupHealthRoutes(): void {
    // Health check endpoint
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/health",
        tags: ["Health"],
        summary: "Check server health",
        description: "Returns server status",
        responses: {
          200: {
            description: "Server is healthy and operational",
            content: {
              "application/json": {
                schema: HealthResponseSchema,
              },
            },
          },
        },
      }),
      (c) => {
        return c.json({
          status: "ok",
        });
      }
    );

    // Namespaces discovery endpoint
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/namespaces",
        tags: ["Namespaces"],
        summary: "List all available namespaces",
        description:
          "Returns all available namespaces with function counts. MCP namespaces are prefixed with 'mcp_'.",
        responses: {
          200: {
            description: "Successfully retrieved namespace list",
            content: {
              "text/plain": {
                schema: NamespacesResponseSchema,
              },
            },
          },
        },
      }),
      async (c) => {
        const schemas = this.mcpIntegrationManager.isEnabled()
          ? this.mcpIntegrationManager.getSchemas()
          : undefined;
        const namespaces =
          await this.typeGeneratorManager.getAvailableNamespaces(schemas);
        return c.text(namespaces);
      }
    );

    // RPC namespace metadata endpoint
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/rpc-namespaces",
        tags: ["Namespaces"],
        summary: "Get namespace metadata",
        description:
          "Returns human-readable metadata about RPC namespaces including function signatures and descriptions",
        responses: {
          200: {
            description: "Successfully retrieved namespace metadata",
            content: {
              "text/plain": {
                schema: RpcNamespaceMetadataResponseSchema,
              },
            },
          },
        },
      }),
      async (c) => {
        const schemas = this.mcpIntegrationManager.isEnabled()
          ? this.mcpIntegrationManager.getSchemas()
          : undefined;
        const metadata = await this.typeGeneratorManager.getNamespaceMetadata(
          schemas
        );
        return c.text(metadata);
      }
    );
  }

  /**
   * TypeScript type generation routes
   */
  private setupTypeRoutes(): void {
    // All types endpoint
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/types",
        tags: ["Types"],
        summary: "Get all TypeScript type definitions",
        description:
          "Returns TypeScript interface definitions for all RPC functions. Types are cached and regenerated when RPC files change.",
        responses: {
          200: {
            description: "Successfully generated TypeScript definitions",
            content: {
              "text/plain": {
                schema: TypesResponseSchema,
              },
            },
          },
        },
      }),
      async (c) => {
        let cached = this.typeGeneratorManager.getCachedTypes();
        if (!cached) {
          const schemas = this.mcpIntegrationManager.isEnabled()
            ? this.mcpIntegrationManager.getSchemas()
            : undefined;
          cached = await this.typeGeneratorManager.generateTypes(schemas);
          this.typeGeneratorManager.setCachedTypes(cached);
        }
        return c.text(cached);
      }
    );

    // Namespace-specific types endpoint
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/types/{namespaces}",
        tags: ["Types"],
        summary: "Get types for specific namespaces",
        description:
          "Returns TypeScript definitions for a comma-separated list of namespaces. Useful for selective client generation.",
        request: {
          params: NamespaceTypesParamSchema,
        },
        responses: {
          200: {
            description: "Successfully generated namespace-specific types",
            content: {
              "text/plain": {
                schema: NamespaceTypesResponseSchema,
              },
            },
          },
        },
      }),
      async (c) => {
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
      }
    );

    // Client code generation endpoint
    this.app.openapi(
      createRoute({
        method: "get",
        path: "/client.ts",
        tags: ["Client"],
        summary: "Get RPC client code",
        description:
          "Returns generated TypeScript client code for connecting to the RPC server from browser or Deno environments.",
        responses: {
          200: {
            description: "Successfully generated client code",
            content: {
              "text/plain": {
                schema: ClientCodeResponseSchema,
              },
            },
          },
        },
      }),
      (c) => {
        const client = this.clientCacheGetter();
        return c.text(client.code);
      }
    );
  }

  /**
   * OpenAPI documentation routes
   */
  private setupDocRoutes(): void {
    // OpenAPI JSON specification
    this.app.doc("/openapi.json", {
      openapi: "3.1.0",
      info: {
        version: VERSION,
        title: "Lootbox API",
        description:
          "REST API for the Lootbox server. Provides TypeScript type definitions, RPC client code generation, namespace discovery, and server health monitoring.",
      },
      servers: [
        {
          url: `http://localhost:${this.port}`,
          description: "Local development server",
        },
      ],
      tags: [
        {
          name: "Health",
          description: "Server health and status monitoring",
        },
        {
          name: "Namespaces",
          description: "RPC and MCP namespace discovery",
        },
        {
          name: "Types",
          description: "TypeScript type definition generation",
        },
        {
          name: "Client",
          description: "RPC client code generation",
        },
      ],
    });

    // Swagger UI
    this.app.get(
      "/doc",
      swaggerUI({
        url: "/openapi.json",
      })
    );
  }
}
