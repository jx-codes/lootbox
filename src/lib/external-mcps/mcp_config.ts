// MCP server configuration management

/**
  McpServerConfig: add supports to all transports
**/
interface McpServerConfigBase {
  transport?: "stdio" | "streamable_http" | "sse";
}

interface McpServerConfigStdio extends BaseConfig {
  command: string;
  args: string[];
  transport?: "stdio";
  url?: never;
  headers?: never;
}

interface McpServerConfigHttp extends BaseConfig {
  url: string;
  transport: "streamable_http" | "sse";
  headers?: Record<string, string>[];
  command?: never;
  args?: never;
}

export type McpServerConfig = McpServerConfigStdio | McpServerConfigHttp;

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Sanitize server name to be a valid identifier
 * Replaces hyphens and other invalid characters with underscores
 */
function sanitizeServerName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Load and parse MCP configuration from a .mcp.json file
 */
export async function loadMcpConfig(path: string): Promise<McpConfigFile> {
  try {
    const content = await Deno.readTextFile(path);
    const parsed = JSON.parse(content);
    return validateMcpConfig(parsed);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`MCP config file not found: ${path}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in MCP config file: ${path}`);
    }
    throw error;
  }
}

/**
 * Validate MCP configuration structure and filter out mcp-rpc-bridge
 */
export function validateMcpConfig(config: unknown): McpConfigFile {
  if (typeof config !== "object" || config === null) {
    throw new Error("MCP config must be an object");
  }

  const configObj = config as Record<string, unknown>;

  if (!("mcpServers" in configObj)) {
    throw new Error("MCP config must have 'mcpServers' field");
  }

  if (
    typeof configObj.mcpServers !== "object" ||
    configObj.mcpServers === null
  ) {
    throw new Error("'mcpServers' must be an object");
  }

  const mcpServers = configObj.mcpServers as Record<string, unknown>;
  const validated: Record<string, McpServerConfig> = {};

  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    // Skip our own mcp-rpc-bridge server
    if (typeof serverConfig === "object" && serverConfig !== null) {
      const cfg = serverConfig as Record<string, unknown>;
      if (cfg.command === "mcp-rpc-bridge") {
        console.error(`Skipping mcp-rpc-bridge server: ${serverName}`);
        continue;
      }
    }
    if (typeof serverConfig !== "object" || serverConfig === null) {
      throw new Error(`Server config for '${serverName}' must be an object`);
    }

    const cfg = serverConfig as Record<string, unknown>;

    if (typeof cfg.command !== "string") {
      throw new Error(`Server '${serverName}' must have 'command' string`);
    }

    if (!Array.isArray(cfg.args)) {
      throw new Error(`Server '${serverName}' must have 'args' array`);
    }

    if (!cfg.args.every((arg) => typeof arg === "string")) {
      throw new Error(
        `Server '${serverName}' args must be array of strings`
      );
    }

    const validatedConfig: McpServerConfig = {
      command: cfg.command,
      args: cfg.args as string[],
    };

    if (cfg.env !== undefined) {
      if (typeof cfg.env !== "object" || cfg.env === null) {
        throw new Error(`Server '${serverName}' env must be an object`);
      }
      const env = cfg.env as Record<string, unknown>;
      if (!Object.values(env).every((val) => typeof val === "string")) {
        throw new Error(
          `Server '${serverName}' env values must be strings`
        );
      }
      validatedConfig.env = env as Record<string, string>;
    }

    // Sanitize server name to ensure it's a valid identifier
    const sanitizedName = sanitizeServerName(serverName);
    if (sanitizedName !== serverName) {
      console.error(`Sanitized MCP server name: '${serverName}' -> '${sanitizedName}'`);
    }
    validated[sanitizedName] = validatedConfig;
  }

  return { mcpServers: validated };
}