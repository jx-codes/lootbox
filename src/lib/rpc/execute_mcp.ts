// Execute MCP tool calls and resource reads

import type { McpClientManager } from "../external-mcps/mcp_client_manager.ts";
import type {
  McpSchemaFetcher,
  McpResourceSchema,
} from "../external-mcps/mcp_schema_fetcher.ts";

interface McpExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute an MCP tool call
 */
export async function executeMcpTool(
  clientManager: McpClientManager,
  serverName: string,
  toolName: string,
  args: unknown
): Promise<McpExecutionResult> {
  try {
    const client = clientManager.getClient(serverName);

    if (!client) {
      return {
        success: false,
        error: `MCP server '${serverName}' is not connected`,
      };
    }

    console.error(
      `Executing MCP tool: ${serverName}.${toolName} with args:`,
      args
    );

    // Execute with timeout
    const result = await executeWithTimeout(
      client.callTool({ name: toolName, arguments: args }),
      30000,
      `Tool call ${serverName}.${toolName} timed out after 30 seconds`
    );

    console.error(`MCP tool ${serverName}.${toolName} completed successfully`);

    // Extract result from MCP response
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error(
      `MCP tool ${serverName}.${toolName} failed:`,
      error instanceof Error ? error.message : String(error)
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute an MCP resource read
 */
export async function executeMcpResource(
  clientManager: McpClientManager,
  schemaFetcher: McpSchemaFetcher,
  serverName: string,
  resourceName: string,
  args: unknown
): Promise<McpExecutionResult> {
  try {
    const client = clientManager.getClient(serverName);

    if (!client) {
      return {
        success: false,
        error: `MCP server '${serverName}' is not connected`,
      };
    }

    // Get resource schema to determine URI
    const schemas = schemaFetcher.getCachedSchemas(serverName);
    if (!schemas) {
      return {
        success: false,
        error: `No cached schemas found for server '${serverName}'`,
      };
    }

    const resource = schemas.resources.find((r) => r.name === resourceName);
    if (!resource) {
      return {
        success: false,
        error: `Resource '${resourceName}' not found in server '${serverName}'`,
      };
    }

    // Build URI from template or use static URI
    const uri = buildResourceUri(resource, args);

    console.error(
      `Reading MCP resource: ${serverName}.${resourceName} from URI: ${uri}`
    );

    // Execute with timeout
    const result = await executeWithTimeout(
      client.readResource({ uri }),
      30000,
      `Resource read ${serverName}.${resourceName} timed out after 30 seconds`
    );

    console.error(
      `MCP resource ${serverName}.${resourceName} read successfully`
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error(
      `MCP resource ${serverName}.${resourceName} failed:`,
      error instanceof Error ? error.message : String(error)
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build resource URI from schema and arguments
 */
function buildResourceUri(
  resource: McpResourceSchema,
  args: unknown
): string {
  // Use static URI if available
  if (resource.uri) {
    return resource.uri;
  }

  // Use template URI and substitute variables
  if (resource.uriTemplate) {
    let uri = resource.uriTemplate;

    if (typeof args === "object" && args !== null) {
      const argsObj = args as Record<string, unknown>;

      // Replace {variable} with args.variable
      uri = uri.replace(/\{([^}]+)\}/g, (match, varName) => {
        const value = argsObj[varName];
        if (value === undefined) {
          throw new Error(
            `Missing required URI template variable: ${varName}`
          );
        }
        return String(value);
      });
    }

    return uri;
  }

  throw new Error(
    `Resource '${resource.name}' has neither uri nor uriTemplate`
  );
}

/**
 * Execute a promise with a timeout
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return await Promise.race([promise, timeoutPromise]);
}