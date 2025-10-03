#!/usr/bin/env -S deno run --allow-net
/**
 * mcp-rpc-exec - Lightweight WebSocket client for one-shot script execution
 *
 * Usage:
 *   mcp-rpc-exec script.ts                    # Execute file
 *   mcp-rpc-exec -e 'console.log(1+1)'       # Execute inline
 *   cat script.ts | mcp-rpc-exec              # Execute from stdin
 *   mcp-rpc-exec --server ws://host:9000/ws script.ts
 */

import { parseArgs } from "@std/cli";

interface ExecResponse {
  result?: string;
  error?: string;
  id?: string;
}

async function readStdin(): Promise<string> {
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];

  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }

  const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
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
  return wsUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/ws$/, "");
}

function showHelp() {
  console.log(`mcp-rpc-exec - Execute TypeScript scripts via WebSocket RPC

Usage:
  mcp-rpc-exec [OPTIONS] [FILE]
  mcp-rpc-exec -e <script>
  cat script.ts | mcp-rpc-exec

Execution Environment:
  • Runtime: Deno sandbox
  • Network: fetch() available for HTTP requests
  • Permissions: Network access only (no file system, env vars, etc.)
  • Timeout: 10 second execution limit
  • Available: rpc object (injected), console, fetch, Promise, standard APIs

Options:
  -e, --eval <script>         Execute inline script
  -s, --server <url>          WebSocket server URL (default: ws://localhost:8080/ws)
  --namespaces                List available RPC namespaces
  --types <ns1,ns2,...>       Show TypeScript types for specific namespaces
  -h, --help                  Show this help message
  -v, --version               Show version

Examples:
  # Execute scripts
  mcp-rpc-exec script.ts
  mcp-rpc-exec -e 'console.log(await rpc.math.add({a: 1, b: 2}))'
  echo 'console.log(1+1)' | mcp-rpc-exec
  mcp-rpc-exec --server ws://remote:8080/ws script.ts

  # Discovery
  mcp-rpc-exec --namespaces
  mcp-rpc-exec --types math,pokemon

  # Using fetch in scripts
  mcp-rpc-exec -e 'const data = await fetch("https://api.github.com/users/octocat").then(r => r.json()); console.log(data.name)'
`);
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["eval", "server", "types"],
    boolean: ["help", "version", "namespaces"],
    alias: {
      "e": "eval",
      "s": "server",
      "h": "help",
      "v": "version",
    },
  });

  if (args.help) {
    showHelp();
    Deno.exit(0);
  }

  if (args.version) {
    console.log("mcp-rpc-exec v1.0.0");
    Deno.exit(0);
  }

  const serverUrl = (args.server as string) || "ws://localhost:8080/ws";
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
      console.error(`Error connecting to server:`, error instanceof Error ? error.message : String(error));
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
      console.error(`Error connecting to server:`, error instanceof Error ? error.message : String(error));
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
      console.error(`Error reading file '${filePath}':`, error instanceof Error ? error.message : String(error));
      Deno.exit(1);
    }
  } else {
    // Check if stdin is a TTY (interactive terminal)
    if (Deno.stdin.isTerminal()) {
      console.error("Error: No script provided");
      console.error("Usage: mcp-rpc-exec [file] or mcp-rpc-exec -e 'script' or pipe via stdin");
      console.error("Run 'mcp-rpc-exec --help' for more information");
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
    console.error(`Error connecting to ${serverUrl}:`, error instanceof Error ? error.message : String(error));
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
        reject(new Error(`Invalid response: ${error instanceof Error ? error.message : String(error)}`));
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
        reject(new Error(`Connection closed unexpectedly (code: ${event.code})`));
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
    console.error("Execution failed:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
