import { parseArgs } from "@std/cli";

interface ResolvedConfig {
  rpc_dir: string;
  port: number;
  mcp_config: string | null;
  mcp_rpc_data_dir: string | null;
}

export const get_config = (): ResolvedConfig => {
  const args = parseArgs(Deno.args, {
    string: ["rpc-dir", "port", "mcp-config", "lootbox-data-dir"],
    alias: {
      "rpc-dir": "r",
      "port": "p",
      "mcp-config": "m",
      "lootbox-data-dir": "d",
    },
  });

  if (!args["rpc-dir"]) {
    console.error("Error: --rpc-dir flag is required");
    console.error("Usage: program --rpc-dir <path> --port <number>");
    console.error("Example: program --rpc-dir .rpc --port 8080");
    Deno.exit(1);
  }

  if (!args.port) {
    console.error("Error: --port flag is required");
    console.error("Usage: program --rpc-dir <path> --port <number>");
    console.error("Example: program --rpc-dir .rpc --port 8080");
    Deno.exit(1);
  }

  const port = parseInt(args.port as string, 10);
  if (isNaN(port)) {
    console.error("Error: --port must be a valid number");
    Deno.exit(1);
  }

  // MCP config is optional
  let mcpConfigPath: string | null = null;
  if (args["mcp-config"]) {
    mcpConfigPath = args["mcp-config"] as string;
    // Verify file exists if provided
    try {
      const stat = Deno.statSync(mcpConfigPath);
      if (!stat.isFile) {
        console.error(`Error: --mcp-config path is not a file: ${mcpConfigPath}`);
        Deno.exit(1);
      }
    } catch {
      console.error(`Error: --mcp-config file not found: ${mcpConfigPath}`);
      Deno.exit(1);
    }
  }

  return {
    rpc_dir: args["rpc-dir"] as string,
    port: port,
    mcp_config: mcpConfigPath,
    mcp_rpc_data_dir: args["lootbox-data-dir"] as string | null || null,
  };
};
