import { z } from "zod";

// Health endpoint schemas
export const HealthResponseSchema = z.object({
  status: z.string().openapi({ example: "ok" }),
});

// Namespaces endpoint schemas
export const NamespacesResponseSchema = z.object({
  rpc: z.array(z.string()).openapi({ example: ["filedb", "zendesk"] }),
  mcp: z.array(z.string()).openapi({ example: ["best-practices", "ide", "codemode"] }),
});

// RPC namespace metadata schemas
export const RpcNamespaceMetadataResponseSchema = z.string().openapi({
  description: "Human-readable namespace metadata with function signatures",
  example: "Available Namespaces:\n\n<namespaces>\nfiledb:\n  - createTable\n  - query\n</namespaces>",
});

// Types endpoint schemas
export const TypesResponseSchema = z.string().openapi({
  description: "TypeScript type definitions for all RPC functions",
  example: "export interface CreateTableArgs { tableName: string; columns: Column[]; }",
});

// Namespace-specific types endpoint schemas
export const NamespaceTypesParamSchema = z.object({
  namespaces: z.string().openapi({
    param: { name: "namespaces", in: "path" },
    description: "Comma-separated list of namespace names",
    example: "filedb,zendesk",
  }),
});

export const NamespaceTypesResponseSchema = z.string().openapi({
  description: "TypeScript type definitions for specific namespaces",
  example: "export interface FiledbCreateTableArgs { tableName: string; }",
});

// Client code endpoint schemas
export const ClientCodeResponseSchema = z.string().openapi({
  description: "Generated RPC client code for browser/Deno usage",
  example: "export class RpcClient {\n  async call(method: string, args: any) { ... }\n}",
});
