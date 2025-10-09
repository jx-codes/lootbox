// Convert MCP schemas to TypeScript extraction results

import type {
  ExtractionResult,
  FunctionSignature,
  InterfaceDefinition,
  InterfaceProperty,
} from "../type_system/types.ts";
import type {
  McpServerSchemas,
  McpToolSchema,
  McpResourceSchema,
} from "./mcp_schema_fetcher.ts";

/**
 * Convert all MCP server schemas to ExtractionResult format
 * Each server becomes a namespace (like RPC files)
 */
export function convertMcpSchemasToExtractionResults(
  allSchemas: McpServerSchemas[]
): ExtractionResult[] {
  return allSchemas.map((schemas) => convertServerToExtractionResult(schemas));
}

/**
 * Convert a single MCP server's schemas to ExtractionResult
 */
function convertServerToExtractionResult(
  schemas: McpServerSchemas
): ExtractionResult {
  const functions: FunctionSignature[] = [];
  const interfaces: InterfaceDefinition[] = [];

  // Convert tools to functions
  for (const tool of schemas.tools) {
    const { func, argsInterface } = convertToolToFunction(
      tool,
      schemas.serverName
    );
    functions.push(func);
    if (argsInterface) {
      interfaces.push(argsInterface);
    }
  }

  // Convert resources to functions
  for (const resource of schemas.resources) {
    const { func, argsInterface } = convertResourceToFunction(
      resource,
      schemas.serverName
    );
    functions.push(func);
    if (argsInterface) {
      interfaces.push(argsInterface);
    }
  }

  // Add common MCP result interfaces
  interfaces.push(...generateMcpResultInterfaces());

  return {
    functions,
    interfaces,
    errors: [],
    sourceFile: schemas.serverName,
  };
}

/**
 * Convert MCP tool to function signature
 */
function convertToolToFunction(
  tool: McpToolSchema,
  serverName: string
): {
  func: FunctionSignature;
  argsInterface: InterfaceDefinition | null;
} {
  const sanitizedServerName = sanitizeIdentifier(serverName);
  const interfaceName = `Mcp${capitalizeFirst(sanitizedServerName)}_${capitalizeFirst(tool.name)}Args`;
  const argsInterface = generateArgsInterface(interfaceName, tool.inputSchema);

  const func: FunctionSignature = {
    name: tool.name, // Already sanitized in schema
    parameters: [
      {
        name: "args",
        type: interfaceName,
        isOptional: false,
        hasDefault: false,
      },
    ],
    returnType: "Promise<McpToolResult>",
    isAsync: true,
    documentation: tool.description
      ? {
          description: tool.description,
        }
      : undefined,
    sourceLocation: {
      line: 0,
      file: serverName,
    },
  };

  return { func, argsInterface };
}

/**
 * Convert MCP resource to function signature
 */
function convertResourceToFunction(
  resource: McpResourceSchema,
  serverName: string
): {
  func: FunctionSignature;
  argsInterface: InterfaceDefinition | null;
} {
  const sanitizedServerName = sanitizeIdentifier(serverName);
  const interfaceName = `Mcp${capitalizeFirst(sanitizedServerName)}_Resource${capitalizeFirst(resource.name)}Args`;

  // Parse URI template if present, otherwise empty interface
  const argSchema = resource.uriTemplate
    ? parseUriTemplateToSchema(resource.uriTemplate)
    : { type: "object", properties: {}, required: [] };

  const argsInterface = generateArgsInterface(interfaceName, argSchema);

  const func: FunctionSignature = {
    name: `resource_${resource.name}`, // Already sanitized in schema
    parameters: [
      {
        name: "args",
        type: interfaceName,
        isOptional: false,
        hasDefault: false,
      },
    ],
    returnType: "Promise<McpResourceResult>",
    isAsync: true,
    documentation: resource.description
      ? {
          description: resource.description,
        }
      : undefined,
    sourceLocation: {
      line: 0,
      file: serverName,
    },
  };

  return { func, argsInterface };
}

/**
 * Generate args interface from JSON Schema
 */
function generateArgsInterface(
  name: string,
  schema: Record<string, unknown>
): InterfaceDefinition {
  const properties: InterfaceProperty[] = [];

  if (schema.properties && typeof schema.properties === "object") {
    const props = schema.properties as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? schema.required : [];

    for (const [propName, propSchema] of Object.entries(props)) {
      const isOptional = !required.includes(propName);
      const propType = jsonSchemaToTsType(
        propSchema as Record<string, unknown>
      );

      properties.push({
        name: propName,
        type: propType,
        isOptional,
      });
    }
  }

  return {
    name,
    properties,
    sourceLocation: {
      line: 0,
      file: "mcp",
    },
  };
}

/**
 * Convert JSON Schema type to TypeScript type string
 */
function jsonSchemaToTsType(schema: Record<string, unknown>): string {
  // Handle type field
  if (schema.type) {
    const type = schema.type as string;

    switch (type) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      case "array":
        if (schema.items) {
          const itemType = jsonSchemaToTsType(
            schema.items as Record<string, unknown>
          );
          return `${itemType}[]`;
        }
        return "unknown[]";
      case "object":
        // For nested objects, return Record type
        return "Record<string, unknown>";
      default:
        return "unknown";
    }
  }

  // Handle anyOf/oneOf union types
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const types = schema.anyOf.map((s) =>
      jsonSchemaToTsType(s as Record<string, unknown>)
    );
    return types.join(" | ");
  }

  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    const types = schema.oneOf.map((s) =>
      jsonSchemaToTsType(s as Record<string, unknown>)
    );
    return types.join(" | ");
  }

  return "unknown";
}

/**
 * Parse URI template to extract variable names and create schema
 * Example: "file:///{path}/{filename}" => { path: string, filename: string }
 */
function parseUriTemplateToSchema(
  template: string
): Record<string, unknown> {
  const variables: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    variables.push(match[1]);
  }

  if (variables.length === 0) {
    return { type: "object", properties: {}, required: [] };
  }

  const properties: Record<string, unknown> = {};
  for (const varName of variables) {
    properties[varName] = { type: "string" };
  }

  return {
    type: "object",
    properties,
    required: variables,
  };
}

/**
 * Generate common MCP result interfaces
 */
function generateMcpResultInterfaces(): InterfaceDefinition[] {
  return [
    {
      name: "McpToolResult",
      properties: [
        {
          name: "content",
          type: "Array<{ type: string; text?: string; data?: string; mimeType?: string }>",
          isOptional: false,
        },
        {
          name: "isError",
          type: "boolean",
          isOptional: true,
        },
      ],
      sourceLocation: { line: 0, file: "mcp" },
    },
    {
      name: "McpResourceResult",
      properties: [
        {
          name: "contents",
          type: "Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>",
          isOptional: false,
        },
      ],
      sourceLocation: { line: 0, file: "mcp" },
    },
  ];
}

/**
 * Sanitize string to be a valid TypeScript identifier
 * Replaces hyphens and other invalid characters with underscores
 */
function sanitizeIdentifier(str: string): string {
  return str.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}