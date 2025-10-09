import { parseArgs } from "@std/cli";
import { loadConfig } from "./lib/lootbox-cli/config.ts";
import { executeScript, getScriptFromArgs } from "./lib/lootbox-cli/exec.ts";
import {
  showConfigHelp,
  showHumanHelp,
  showLlmHelp,
} from "./lib/lootbox-cli/help.ts";
import { init } from "./lib/lootbox-cli/init.ts";
import { startServer } from "./lib/lootbox-cli/server.ts";
import { wsUrlToHttpUrl } from "./lib/lootbox-cli/utils.ts";
import {
  workflowAbort,
  workflowReset,
  workflowStart,
  workflowStatus,
  workflowStep,
} from "./lib/lootbox-cli/workflow.ts";
import { scriptsInit, scriptsList } from "./lib/lootbox-cli/scripts.ts";
import { VERSION } from "./version.ts";

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["eval", "server", "types", "end-loop", "abort"],
    boolean: [
      "help",
      "human-help",
      "llm-help",
      "version",
      "namespaces",
      "config-help",
    ],
    alias: {
      e: "eval",
      s: "server",
      h: "help",
      v: "version",
    },
  });

  if (args.help || args["human-help"]) {
    showHumanHelp();
    Deno.exit(0);
  }

  if (args["llm-help"]) {
    showLlmHelp();
    Deno.exit(0);
  }

  if (args.version) {
    console.log(`lootbox v${VERSION}`);
    Deno.exit(0);
  }

  if (args["config-help"]) {
    showConfigHelp();
    Deno.exit(0);
  }

  // Handle init command
  const firstArg = args._[0] as string | undefined;
  if (firstArg === "init") {
    await init();
    return;
  }

  // Handle server command
  if (firstArg === "server") {
    const serverArgs = args._.slice(1) as string[];
    await startServer(serverArgs);
    return;
  }

  // Handle workflow commands
  if (firstArg === "workflow") {
    const workflowCommand = args._[1] as string | undefined;
    const workflowArgs = args._.slice(2) as string[];

    switch (workflowCommand) {
      case "start":
        if (workflowArgs.length === 0) {
          console.error("Error: workflow start requires a file argument");
          console.error("Usage: lootbox workflow start <file.yaml>");
          Deno.exit(1);
        }
        await workflowStart(workflowArgs[0]);
        break;
      case "step":
        await workflowStep(args["end-loop"] as string | undefined);
        break;
      case "reset":
        await workflowReset();
        break;
      case "status":
        await workflowStatus();
        break;
      case "abort":
        if (!args.abort) {
          console.error("Error: --abort requires a reason");
          console.error('Usage: lootbox workflow abort --abort="reason"');
          Deno.exit(1);
        }
        await workflowAbort(args.abort as string);
        break;
      default:
        console.error(`Error: Unknown workflow command '${workflowCommand}'`);
        console.error("Available commands: start, step, reset, status, abort");
        Deno.exit(1);
    }
    return;
  }

  // Handle scripts commands
  if (firstArg === "scripts") {
    const scriptsCommand = args._[1] as string | undefined;
    const scriptsArgs = args._.slice(2) as string[];

    if (!scriptsCommand || scriptsCommand === "list") {
      await scriptsList();
    } else if (scriptsCommand === "init") {
      if (scriptsArgs.length === 0) {
        console.error("Error: scripts init requires a filename argument");
        console.error("Usage: lootbox scripts init <filename>");
        Deno.exit(1);
      }
      await scriptsInit(scriptsArgs[0]);
    } else {
      console.error(`Error: Unknown scripts command '${scriptsCommand}'`);
      console.error("Available commands: list, init");
      Deno.exit(1);
    }
    return;
  }

  // Load config file if present (silently ignore if not found)
  const config = await loadConfig();

  // Priority: CLI arg > config file > derived from port > default
  let serverUrl: string;
  if (args.server) {
    serverUrl = args.server as string;
  } else if (config.serverUrl) {
    serverUrl = config.serverUrl;
  } else if (config.port) {
    serverUrl = `ws://localhost:${config.port}/ws`;
  } else {
    serverUrl = "ws://localhost:3000/ws";
  }
  const httpUrl = wsUrlToHttpUrl(serverUrl);

  // Handle discovery flags
  if (args.namespaces) {
    try {
      const response = await fetch(`${httpUrl}/namespaces`);
      if (!response.ok) {
        console.error(`Error fetching namespaces: ${response.statusText}`);
        Deno.exit(1);
      }
      const text = await response.text();
      console.log(
        `${text}\n\nSuggested Next Step: lootbox --types <namespace1>,..,<namespace2>\nUsage: tools.<namespace>.<function>({ args })`
      );
      Deno.exit(0);
    } catch (error) {
      console.error(
        `Error connecting to server:`,
        error instanceof Error ? error.message : String(error)
      );
      Deno.exit(1);
    }
  }

  if (args.types) {
    const namespaces = args.types as string;
    try {
      const response = await fetch(`${httpUrl}/types/${namespaces}`);
      if (!response.ok) {
        console.error(`Error fetching types: ${response.statusText}`);
        Deno.exit(1);
      }
      const types = await response.text();
      console.log(types);
      Deno.exit(0);
    } catch (error) {
      console.error(
        `Error connecting to server:`,
        error instanceof Error ? error.message : String(error)
      );
      Deno.exit(1);
    }
  }

  // Get script from various sources
  const script = await getScriptFromArgs(
    args.eval as string | undefined,
    args._ as string[]
  );

  if (!script.trim()) {
    console.error("Error: Empty script");
    Deno.exit(1);
  }

  // Execute the script
  await executeScript(script, serverUrl);
}

if (import.meta.main) {
  main();
}
