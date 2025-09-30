// WebSocket RPC server entry point

import { get_config } from "./lib/get_config.ts";
import { loadMcpConfig } from "./lib/external-mcps/mcp_config.ts";
import { WebSocketRpcServer } from "./lib/rpc/websocket_server.ts";

async function main(): Promise<void> {
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
  }
}

if (import.meta.main) {
  main();
}
