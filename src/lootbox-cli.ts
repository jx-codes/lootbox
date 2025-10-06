#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write
/**
 * lootbox - Lightweight WebSocket client for one-shot script execution
 *
 * Usage:
 *   lootbox script.ts                    # Execute file
 *   lootbox -e 'console.log(1+1)'       # Execute inline
 *   cat script.ts | lootbox              # Execute from stdin
 *   lootbox --server ws://host:9000/ws script.ts
 *   lootbox workflow start workflow.yaml  # Start workflow
 *   lootbox workflow step                 # Get next workflow step
 *
 * Configuration:
 *   Reads from lootbox.config.json in current directory if present.
 *   Set "serverUrl" to configure default server.
 *   CLI --server flag overrides config file.
 */

import { parseArgs } from "@std/cli";
import { showHumanHelp, showLlmHelp, showConfigHelp } from "./lib/lootbox-cli/help.ts";
import { loadConfig } from "./lib/lootbox-cli/config.ts";
import { wsUrlToHttpUrl } from "./lib/lootbox-cli/utils.ts";
import { executeScript, getScriptFromArgs } from "./lib/lootbox-cli/exec.ts";
import {
  workflowStart,
  workflowStep,
  workflowReset,
  workflowStatus,
} from "./lib/lootbox-cli/workflow.ts";
import { startServer } from "./lib/lootbox-cli/server.ts";

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["eval", "server", "types"],
    boolean: ["help", "human-help", "llm-help", "version", "namespaces", "config-help", "end-loop"],
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
    console.log("lootbox v1.0.0");
    Deno.exit(0);
  }

  if (args["config-help"]) {
    showConfigHelp();
    Deno.exit(0);
  }

  // Handle server command
  const firstArg = args._[0] as string | undefined;
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
        await workflowStep(args["end-loop"] as boolean);
        break;
      case "reset":
        await workflowReset();
        break;
      case "status":
        await workflowStatus();
        break;
      default:
        console.error(`Error: Unknown workflow command '${workflowCommand}'`);
        console.error("Available commands: start, step, reset, status");
        Deno.exit(1);
    }
    return;
  }

  // Load config file if present (silently ignore if not found)
  const config = await loadConfig();

  // Priority: CLI arg > config file > default
  const serverUrl =
    (args.server as string) || config.serverUrl || "ws://localhost:8080/ws";
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
