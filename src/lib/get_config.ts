import { parseArgs } from "@std/cli";
import type { Config, McpServerConfig } from "./lootbox-cli/types.ts";

interface ResolvedConfig {
  lootbox_root: string;
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
    string: ["lootbox-root", "port", "lootbox-data-dir"],
    alias: {
      "lootbox-root": "r",
      port: "p",
      "lootbox-data-dir": "d",
    },
  });

  // Load config file
  const config = await loadConfig();

  // Priority: flag > config > defaults
  const lootboxRoot =
    (args["lootbox-root"] as string) || config.lootboxRoot || ".lootbox";
  const toolsDir = `${lootboxRoot}/tools`;
  const portStr = (args.port as string) || config.port?.toString() || "3000";
  const lootboxDataDir =
    (args["lootbox-data-dir"] as string) || config.lootboxDataDir || null;
  const mcpServers = config.mcpServers || null;

  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    console.error("Error: --port must be a valid number");
    Deno.exit(1);
  }

  return {
    lootbox_root: lootboxRoot,
    tools_dir: toolsDir,
    port: port,
    lootbox_data_dir: lootboxDataDir,
    mcp_servers: mcpServers,
  };
};
