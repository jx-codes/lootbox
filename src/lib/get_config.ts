import { parseArgs } from "@std/cli";

interface ResolvedConfig {
  rpc_dir: string;
  port: number;
}

export const get_config = (): ResolvedConfig => {
  const args = parseArgs(Deno.args, {
    string: ["rpc-dir", "port"],
    alias: {
      "rpc-dir": "r",
      "port": "p",
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

  return {
    rpc_dir: args["rpc-dir"] as string,
    port: port,
  };
};
