// WebSocket RPC server entry point

import { get_config } from "./lib/get_config.ts";
import { WebSocketRpcServer } from "./lib/rpc/websocket_server.ts";

async function main(): Promise<void> {
  try {
    const config = get_config();
    const server = new WebSocketRpcServer();

    console.error(`Starting WebSocket RPC server on port ${config.port}...`);
    console.error(`Using RPC directory: ${config.rpc_dir}`);
    await server.start(config.port);
  } catch (error) {
    console.error("Failed to start WebSocket RPC server:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
