#!/usr/bin/env -S deno run --allow-net --allow-read
/**
 * lootbox - Lightweight WebSocket client for one-shot script execution
 *
 * Usage:
 *   lootbox script.ts                    # Execute file
 *   lootbox -e 'console.log(1+1)'       # Execute inline
 *   cat script.ts | lootbox              # Execute from stdin
 *   lootbox --server ws://host:9000/ws script.ts
 *
 * Configuration:
 *   Reads from lootbox.config.json in current directory if present.
 *   Set "serverUrl" to configure default server.
 *   CLI --server flag overrides config file.
 */

import { parseArgs } from "@std/cli";

interface ExecResponse {
  result?: string;
  error?: string;
  id?: string;
}

interface Config {
  serverUrl?: string;
}

async function readStdin(): Promise<string> {
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];

  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }

  const combined = new Uint8Array(
    chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return decoder.decode(combined);
}

function generateId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function wsUrlToHttpUrl(wsUrl: string): string {
  // Convert ws://localhost:8080/ws -> http://localhost:8080
  return wsUrl
    .replace(/^ws:/, "http:")
    .replace(/^wss:/, "https:")
    .replace(/\/ws$/, "");
}

function showHelp() {
  console.log(`lootbox - Execute TypeScript scripts via WebSocket RPC

Usage:
  lootbox [OPTIONS] [FILE]
  lootbox -e <script>
  cat script.ts | lootbox

Execution Environment:
  • Runtime: Deno sandbox with TypeScript support
  • Network: fetch() available for HTTP requests
  • Permissions: Network access only (no file system, env vars, etc.)
  • Timeout: 10 second execution limit
  • Global APIs: console, fetch, Promise, standard JavaScript/TypeScript APIs

Function Library (tools object):
  The 'tools' object provides access to functions organized by namespace.
  Syntax: tools.<namespace>.<function>({ args })

  Examples:
    tools.namespace1.functionName({ arg1: value1, arg2: value2 })
    tools.namespace2.anotherFunction({ param: "value" })

  Discovery:
    Use --namespaces to list all available namespaces
    Use --types <namespace> to see TypeScript signatures for a namespace

Options:
  -e, --eval <script>         Execute inline script
  -s, --server <url>          WebSocket server URL (default: ws://localhost:8080/ws)
  --namespaces                List all namespaces available in tools object
  --types <ns1,ns2,...>       Show TypeScript types for specific namespaces
  --config-help               Show configuration file information
  -h, --help                  Show this help message
  -v, --version               Show version

Examples:
  # Discover available functions
  lootbox --namespaces
  lootbox --types namespace1,namespace2

  # Execute scripts with tools
  lootbox -e 'console.log(await tools.namespace1.functionName({arg: "value"}))'
  lootbox script.ts
  echo 'console.log(await tools.namespace2.anotherFunction({param: 123}))' | lootbox

  # Parallel execution with Promise.all
  lootbox -e 'const [r1, r2] = await Promise.all([tools.namespace1.func1({a:1}), tools.namespace2.func2({b:2})]); console.log(r1, r2)'

  # Using fetch alongside tools
  lootbox -e 'const data = await fetch("https://api.example.com/data").then(r => r.json()); console.log(data)'
`);
}

function showConfigHelp() {
  console.log(`lootbox - Configuration

You can create a lootbox.config.json file in your project directory to set
a default server URL. This is useful when using lootbox with Claude Code or
other tools where you don't want to specify the server URL every time.

Configuration File:
  File: lootbox.config.json (in current directory)
  Format: JSON

Example:
  {
    "serverUrl": "ws://localhost:8080/ws"
  }

Priority:
  --server flag > config file > default (ws://localhost:8080/ws)

The config file is optional. If not found, the default server URL will be used.
`);
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["eval", "server", "types"],
    boolean: ["help", "version", "namespaces", "config-help"],
    alias: {
      e: "eval",
      s: "server",
      h: "help",
      v: "version",
    },
  });

  if (args.help) {
    showHelp();
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

  // Load config file if present (silently ignore if not found)
  let config: Config = {};
  try {
    const configText = await Deno.readTextFile("lootbox.config.json");
    config = JSON.parse(configText);
  } catch {
    console.warn("Config file not found or not readable, use defaults");
    // Config file not found or not readable, use defaults
  }

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
      const data = await response.json();
      console.log(JSON.stringify(data, null, 2));
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

  let script: string;

  // Determine script source: -e flag, file, or stdin
  if (args.eval) {
    script = args.eval as string;
  } else if (args._.length > 0) {
    const filePath = args._[0] as string;
    try {
      script = await Deno.readTextFile(filePath);
    } catch (error) {
      console.error(
        `Error reading file '${filePath}':`,
        error instanceof Error ? error.message : String(error)
      );
      Deno.exit(1);
    }
  } else {
    // Check if stdin is a TTY (interactive terminal)
    if (Deno.stdin.isTerminal()) {
      console.error("Error: No script provided");
      console.error(
        "Usage: lootbox [file] or lootbox -e 'script' or pipe via stdin"
      );
      console.error("Run 'lootbox --help' for more information");
      Deno.exit(1);
    }
    // Read from stdin
    script = await readStdin();
  }

  if (!script.trim()) {
    console.error("Error: Empty script");
    Deno.exit(1);
  }

  // Connect to WebSocket
  let ws: WebSocket;
  try {
    ws = new WebSocket(serverUrl);
  } catch (error) {
    console.error(
      `Error connecting to ${serverUrl}:`,
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }

  const id = generateId();
  const responsePromise = new Promise<ExecResponse>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Timeout waiting for response (30s)"));
    }, 30000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ script, id }));
    };

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      try {
        const response = JSON.parse(event.data) as ExecResponse;
        if (response.id === id) {
          ws.close();
          resolve(response);
        }
      } catch (error) {
        ws.close();
        reject(
          new Error(
            `Invalid response: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        );
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      ws.close();
      reject(new Error(`WebSocket error: ${error}`));
    };

    ws.onclose = (event) => {
      clearTimeout(timeout);
      if (!event.wasClean) {
        reject(
          new Error(`Connection closed unexpectedly (code: ${event.code})`)
        );
      }
    };
  });

  try {
    const response = await responsePromise;

    if (response.error) {
      console.error(response.error);
      Deno.exit(1);
    }

    if (response.result) {
      // Output result to stdout (trim trailing newline if present for clean piping)
      const output = response.result;
      Deno.stdout.writeSync(new TextEncoder().encode(output));
    }

    Deno.exit(0);
  } catch (error) {
    console.error(
      "Execution failed:",
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
