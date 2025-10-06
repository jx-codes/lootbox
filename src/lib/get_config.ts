import { parseArgs } from "@std/cli";
import type { Config, McpServerConfig } from "./lootbox-cli/types.ts";

interface ResolvedConfig {
  tools_dir: string;
  port: number;
  lootbox_data_dir: string | null;
  mcp_servers: Record<string, McpServerConfig> | null;
}

async function loadConfig(): Promise<Config> {
  try {
    const configText = await Deno.readTextFile("lootbox.config.json");
    return JSON.parse(configText);
  } catch {
    return {};
  }
}

export const get_config = async (): Promise<ResolvedConfig> => {
  const args = parseArgs(Deno.args, {
    string: ["tools-dir", "port", "lootbox-data-dir"],
    alias: {
      "tools-dir": "t",
      "port": "p",
      "lootbox-data-dir": "d",
    },
  });

  // Load config file
  const config = await loadConfig();

  // Priority: flag > config > defaults
  const toolsDir = (args["tools-dir"] as string) || config.toolsDir;
  const portStr = (args.port as string) || config.port?.toString();
  const lootboxDataDir = (args["lootbox-data-dir"] as string) || config.lootboxDataDir || null;
  const mcpServers = config.mcpServers || null;

  // Validate required fields
  if (!toolsDir) {
    console.error("Error: --tools-dir is required (via flag or lootbox.config.json)");
    console.error("Usage: lootbox server --tools-dir <path> --port <number>");
    console.error("Or set 'toolsDir' in lootbox.config.json");
    Deno.exit(1);
  }

  if (!portStr) {
    console.error("Error: --port is required (via flag or lootbox.config.json)");
    console.error("Usage: lootbox server --tools-dir <path> --port <number>");
    console.error("Or set 'port' in lootbox.config.json");
    Deno.exit(1);
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    console.error("Error: --port must be a valid number");
    Deno.exit(1);
  }

  return {
    tools_dir: toolsDir,
    port: port,
    lootbox_data_dir: lootboxDataDir,
    mcp_servers: mcpServers,
  };
};
