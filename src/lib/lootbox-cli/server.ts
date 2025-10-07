import { parseArgs } from "@std/cli";
import { Spinner } from "@std/cli/unstable-spinner";
import { get_config } from "../get_config.ts";
import { WebSocketRpcServer } from "../rpc/websocket_server.ts";

/**
 * Sanitize server name to be a valid identifier
 * Replaces hyphens and other invalid characters with underscores
 */
function sanitizeServerName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

export async function startServer(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args, {
    string: ["port", "lootbox-root", "lootbox-data-dir"],
    alias: {
      p: "port",
      r: "lootbox-root",
      d: "lootbox-data-dir",
    },
  });

  // Override config with CLI args if provided
  const originalArgs = Deno.args;
  if (
    parsedArgs.port ||
    parsedArgs["lootbox-root"] ||
    parsedArgs["lootbox-data-dir"]
  ) {
    const customArgs = [];
    if (parsedArgs.port) {
      customArgs.push("--port", String(parsedArgs.port));
    }
    if (parsedArgs["lootbox-root"]) {
      customArgs.push("--lootbox-root", parsedArgs["lootbox-root"] as string);
    }
    if (parsedArgs["lootbox-data-dir"]) {
      customArgs.push(
        "--lootbox-data-dir",
        parsedArgs["lootbox-data-dir"] as string
      );
    }
    // Temporarily replace Deno.args for get_config
    Object.defineProperty(Deno, "args", { value: customArgs, writable: true });
  }

  try {
    const spinner = new Spinner({
      message: "Starting lootbox 🎁",
      color: "cyan",
    });
    spinner.start();

    const config = await get_config();

    // Process MCP servers from config
    let mcpConfig = null;
    if (config.mcp_servers && Object.keys(config.mcp_servers).length > 0) {
      // Sanitize server names and filter out mcp-rpc-bridge
      const sanitizedServers: Record<
        string,
        (typeof config.mcp_servers)[string]
      > = {};

      for (const [serverName, serverConfig] of Object.entries(
        config.mcp_servers
      )) {
        const sanitizedName = sanitizeServerName(serverName);
        sanitizedServers[sanitizedName] = serverConfig;
      }
      mcpConfig = { mcpServers: sanitizedServers };
    }
    const server = new WebSocketRpcServer();
    await server.start(config.port, mcpConfig, spinner);
  } catch (error) {
    console.error("Failed to start server:", error);
    Deno.exit(1);
  } finally {
    // Restore original args
    Object.defineProperty(Deno, "args", {
      value: originalArgs,
      writable: true,
    });
  }
}
