import { parseArgs } from "@std/cli";
import { get_config } from "../get_config.ts";
import { loadMcpConfig } from "../external-mcps/mcp_config.ts";
import { WebSocketRpcServer } from "../rpc/websocket_server.ts";

export async function startServer(args: string[]): Promise<void> {
  const parsedArgs = parseArgs(args, {
    string: ["port", "rpc-dir", "mcp-config"],
    alias: {
      p: "port",
      r: "rpc-dir",
      m: "mcp-config",
    },
  });

  // Override config with CLI args if provided
  const originalArgs = Deno.args;
  if (parsedArgs.port || parsedArgs["rpc-dir"] || parsedArgs["mcp-config"]) {
    const customArgs = [];
    if (parsedArgs.port) {
      customArgs.push("--port", String(parsedArgs.port));
    }
    if (parsedArgs["rpc-dir"]) {
      customArgs.push("--rpc-dir", parsedArgs["rpc-dir"] as string);
    }
    if (parsedArgs["mcp-config"]) {
      customArgs.push("--mcp-config", parsedArgs["mcp-config"] as string);
    }
    // Temporarily replace Deno.args for get_config
    Object.defineProperty(Deno, "args", { value: customArgs, writable: true });
  }

  try {
    const config = get_config();

    console.error(`Starting WebSocket RPC server on port ${config.port}...`);
    console.error(`Using RPC directory: ${config.rpc_dir}`);

    // Load MCP config if provided
    let mcpConfig = null;
    if (config.mcp_config) {
      console.error(`Loading MCP configuration from: ${config.mcp_config}`);
      mcpConfig = await loadMcpConfig(config.mcp_config);
      const serverCount = Object.keys(mcpConfig.mcpServers).length;
      console.error(`Found ${serverCount} MCP server(s) in configuration`);
    } else {
      console.error("No MCP configuration provided, running without MCP integration");
    }

    const server = new WebSocketRpcServer();
    await server.start(config.port, mcpConfig);
  } catch (error) {
    console.error("Failed to start WebSocket RPC server:", error);
    Deno.exit(1);
  } finally {
    // Restore original args
    Object.defineProperty(Deno, "args", { value: originalArgs, writable: true });
  }
}
