import { parseArgs } from "@std/cli";
import { loadConfig } from "./lib/lootbox-cli/config.ts";
import { executeScript, getScriptFromArgs, execInline } from "./lib/lootbox-cli/exec.ts";
import {
  showConfigHelp,
  showHumanHelp,
  showLlmHelp,
} from "./lib/lootbox-cli/help.ts";
import { init } from "./lib/lootbox-cli/init.ts";
import { startServer } from "./lib/lootbox-cli/server.ts";
import {
  workflowAbort,
  workflowReset,
  workflowStart,
  workflowStatus,
  workflowStep,
  showWorkflowLlmHelp,
} from "./lib/lootbox-cli/workflow.ts";
import {
  scriptsInit,
  scriptsList,
  showScriptsLlmHelp,
} from "./lib/lootbox-cli/scripts.ts";
import {
  toolsList,
  toolsTypes,
  showToolsLlmHelp,
} from "./lib/lootbox-cli/tools.ts";
import { VERSION } from "./version.ts";

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["eval", "server", "types", "end-loop", "abort"],
    boolean: [
      "help",
      "human-help",
      "llm-help",
      "llm",
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

  // Handle tools commands
  if (firstArg === "tools") {
    const toolsCommand = args._[1] as string | undefined;

    // Check for --llm flag first
    if (args.llm) {
      showToolsLlmHelp();
      return;
    }

    // Load config for serverUrl
    const config = await loadConfig();
    const serverUrl = config.serverUrl || (config.port ? `ws://localhost:${config.port}/ws` : "ws://localhost:3000/ws");

    if (!toolsCommand || toolsCommand === "list") {
      await toolsList(serverUrl);
    } else if (toolsCommand === "types") {
      const namespaces = args._[2] as string | undefined;
      if (!namespaces) {
        console.error("Error: tools types requires namespace argument");
        console.error("Usage: lootbox tools types <ns1,ns2,...>");
        Deno.exit(1);
      }
      await toolsTypes(namespaces, serverUrl);
    } else {
      console.error(`Error: Unknown tools command '${toolsCommand}'`);
      console.error("Available commands: list, types");
      Deno.exit(1);
    }
    return;
  }

  // Handle exec command
  if (firstArg === "exec") {
    const code = args._[1] as string | undefined;
    if (!code) {
      console.error("Error: exec requires code argument");
      console.error("Usage: lootbox exec '<code>'");
      Deno.exit(1);
    }

    // Load config for serverUrl
    const config = await loadConfig();
    const serverUrl = config.serverUrl || (config.port ? `ws://localhost:${config.port}/ws` : "ws://localhost:3000/ws");

    await execInline(code, serverUrl);
    return;
  }

  // Handle workflow commands
  if (firstArg === "workflow") {
    // Check for --llm flag first
    if (args.llm) {
      showWorkflowLlmHelp();
      return;
    }

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
    // Check for --llm flag first
    if (args.llm) {
      showScriptsLlmHelp();
      return;
    }

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
