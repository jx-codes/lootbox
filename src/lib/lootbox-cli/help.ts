export function showLlmHelp() {
  console.log(`lootbox - Script Execution Reference

Sandboxed TypeScript runtime for executing scripts with network access and
discoverable tool functions.

DISCOVERY:
  lootbox --namespaces              List available function namespaces
  lootbox --types <ns1,ns2>         Get TypeScript signatures for namespaces

EXECUTION:
  lootbox file.ts                   Execute TypeScript file
  lootbox -e 'code'                 Execute inline code
  cat file.ts | lootbox             Execute from stdin

AVAILABLE APIS:
  tools.<namespace>.<function>({ arg: value })
  console.log() / console.error()
  fetch(url, options)               HTTP requests
  Promise.all([...])                Parallel execution
  stdin(default = "")                    Access piped stdin data
    .text()                         Returns trimmed text
    .json()                         Returns parsed JSON or null
    .lines()                        Returns array of non-empty lines
    .raw()                          Returns raw input

CONSTRAINTS:
  • 10 second execution timeout
  • Sandboxed execution for safety

EXAMPLES:
  # Discover and use tools
  lootbox --namespaces
  lootbox --types namespace1
  lootbox -e 'console.log(await tools.namespace1.func({arg: "value"}))'

  # Parallel execution
  lootbox -e 'const [r1, r2] = await Promise.all([tools.ns1.f1({}), tools.ns2.f2({})])'

  # Process piped data
  cat data.json | lootbox -e 'console.log(stdin().json())'

WORKFLOW EXECUTION:
  workflow step                     Execute current workflow step
  workflow step --end-loop          Advance from loop (if min iterations met)
  workflow status                   Check workflow position

SERVER:
  server [OPTIONS]                  Start the WebSocket RPC server
    --port <port>                   Server port (default: 8080)
    --rpc-dir <path>                RPC functions directory
    --mcp-config <path>             MCP configuration file
`);
}

export function showHumanHelp() {
  console.log(`lootbox - Sandboxed TypeScript runtime with network access

Write scripts with fetch() for web requests and the 'tools' object for
additional capabilities. Sandboxed execution keeps your system safe while
you orchestrate, fetch, and transform data.

Usage:
  lootbox [OPTIONS] [FILE]
  lootbox -e <script>
  cat script.ts | lootbox
  lootbox workflow <command> [args]
  lootbox server [OPTIONS]

Execution Environment:
  • Runtime: Deno sandbox with TypeScript support
  • Network: fetch() available for HTTP requests
  • Sandbox: Direct file system and environment access disabled
  • Timeout: 10 second execution limit
  • Global APIs: console, fetch, Promise, standard JavaScript/TypeScript APIs

Function Library (tools object):
  The 'tools' object provides access to functions organized by namespace.
  Available namespaces depend on your configuration.
  Syntax: tools.<namespace>.<function>({ args })

  Examples:
    tools.namespace1.functionName({ arg1: value1, arg2: value2 })
    tools.namespace2.anotherFunction({ param: "value" })

  Discovery:
    Use --namespaces to list all available namespaces
    Use --types <namespace> to see TypeScript signatures for a namespace

Options:
  -e, --eval <script>         Execute inline script
                              Note: For complex scripts with special characters, save to a
                              file and pipe it instead: cat script.ts | lootbox
  -s, --server <url>          WebSocket server URL (default: ws://localhost:8080/ws)
  --namespaces                List all namespaces available in tools object
  --types <ns1,ns2,...>       Show TypeScript types for specific namespaces
  --config-help               Show configuration file information
  -h, --help                  Show this help message
  -v, --version               Show version

Workflow Commands:
  workflow start <file>       Start a new workflow from a YAML file
  workflow step               Show/repeat current step
  workflow step --end-loop    End loop early and advance (only after min iterations)
  workflow reset              Reset workflow to the beginning
  workflow status             Show current workflow status

Server Commands:
  server                      Start the WebSocket RPC server
    --port <port>             Server port (default: 8080)
    --rpc-dir <path>          RPC functions directory (default: ./rpc)
    --mcp-config <path>       MCP configuration file (optional)

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

  # Workflow execution
  lootbox workflow start tutorial.yaml
  lootbox workflow step                 # Show/repeat current step
  lootbox workflow step --end-loop      # End loop early (if min met)
  lootbox workflow status               # Check progress

  # Server mode
  lootbox server --port 8080 --rpc-dir ./test-rpc
  lootbox server --port 9000 --rpc-dir ./rpc --mcp-config .mcp.json

  # Workflow file format (YAML):
  # steps:
  #   - title: Step name
  #     prompt: |
  #       Instructions for this step
  #   - title: Loop example
  #     loop: { min: 2, max: 5 }
  #     prompt: |
  #       This step repeats 2-5 times. 'workflow step' repeats it,
  #       'workflow step --end-loop' advances (after min 2 iterations)
`);
}

export function showConfigHelp() {
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
