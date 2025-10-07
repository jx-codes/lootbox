/**
 * Lootbox branded bootup display - inspired by Vite
 */

import type { Spinner } from "@std/cli/unstable-spinner";

interface BootupInfo {
  port: number;
  toolsDir: string;
  mcpServers: string[];
  rpcFunctions: string[];
  spinner?: Spinner;
}

export function showBootup(info: BootupInfo): void {
  const { port, toolsDir, mcpServers, rpcFunctions, spinner } = info;

  // Stop and clear the spinner before showing bootup
  if (spinner) {
    spinner.stop();
    // Clear the spinner line
    Deno.stdout.writeSync(new TextEncoder().encode("\r\x1b[K"));
  }

  console.log("\n  \x1b[35m▶\x1b[0m \x1b[1mlootbox\x1b[0m \x1b[2mv1.0.0\x1b[0m\n");

  console.log(`  \x1b[32m➜\x1b[0m  Local:   \x1b[36mhttp://localhost:\x1b[1m${port}\x1b[0m`);
  console.log(`  \x1b[32m➜\x1b[0m  WebSocket: \x1b[36mws://localhost:\x1b[1m${port}\x1b[36m/ws\x1b[0m`);

  if (mcpServers.length > 0) {
    console.log(`  \x1b[90m○\x1b[0m  MCP: ${mcpServers.join(", ")}`);
  }

  console.log(`  \x1b[90m○\x1b[0m  RPC: ${rpcFunctions.length} function${rpcFunctions.length !== 1 ? "s" : ""}`);
  console.log(`  \x1b[90m○\x1b[0m  Tools: \x1b[2m${toolsDir}\x1b[0m\n`);

  console.log(`  \x1b[1mready\x1b[0m in \x1b[1m${Math.floor(performance.now())}ms\x1b[0m\n`);
}
