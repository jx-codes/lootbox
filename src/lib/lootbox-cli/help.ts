export function showLlmHelp() {
  console.log(`lootbox - Script Execution Reference

Sandboxed TypeScript runtime for executing scripts with network access and
discoverable tool functions.

DISCOVERY:
  lootbox tools                     List available function namespaces
  lootbox tools types <ns1,ns2>     Get TypeScript signatures
  lootbox scripts                   List available scripts with examples

EXECUTION:
  lootbox script.ts                 Execute TypeScript file
  lootbox exec 'code'               Execute inline code
  cat file.ts | lootbox             Execute from stdin

AVAILABLE APIS:
  tools.<namespace>.<function>({ arg: value })
  console.log() / console.error()
  fetch(url, options)               HTTP requests
  Promise.all([...])                Parallel execution
  stdin(default = "")               Access piped stdin data
    .text()                         Returns trimmed text
    .json()                         Returns parsed JSON or null
    .lines()                        Returns array of non-empty lines
    .raw()                          Returns raw input

CONSTRAINTS:
  • 10 second execution timeout
  • Sandboxed execution for safety

EXAMPLES:
  # Discover and use tools
  lootbox tools
  lootbox tools types namespace1
  lootbox exec 'console.log(await tools.namespace1.func({arg: "value"}))'

  # Parallel execution
  lootbox exec 'const [r1, r2] = await Promise.all([tools.ns1.f1({}), tools.ns2.f2({})])'

  # Process piped data
  cat data.json | lootbox exec 'console.log(stdin().json())'

  # Composability
  lootbox script1.ts | jq '.data' | lootbox script2.ts

WORKFLOW EXECUTION:
  workflow step                             Execute current workflow step
  workflow step --end-loop="reason"         Advance from loop (after min iterations)
  workflow abort --abort="reason"           Abort workflow with reason
  workflow status                           Check workflow position

COMMAND-SPECIFIC HELP:
  lootbox tools --llm       Detailed tool discovery help
  lootbox scripts --llm     Detailed script management help
  lootbox workflow --llm    Detailed workflow execution help
`);
}

export function showHumanHelp() {
  console.log(`lootbox - Sandboxed TypeScript runtime with network access

Write scripts with fetch() for web requests and the 'tools' object for
additional capabilities. Sandboxed execution keeps your system safe while
you orchestrate, fetch, and transform data.

Usage:
  lootbox [OPTIONS] [FILE]
  lootbox exec <code>
  lootbox tools [subcommand]
  lootbox scripts [subcommand]
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
    lootbox tools              List all available namespaces
    lootbox tools types <ns>   See TypeScript signatures for namespace

Options:
  -s, --server <url>          WebSocket server URL (default: ws://localhost:3000/ws)
  --config-help               Show configuration file information
  --llm-help                  Show LLM-focused help (command index)
  -h, --help                  Show this help message
  -v, --version               Show version

Workflow Commands:
  workflow start <file>                   Start a new workflow from a YAML file
  workflow step                           Show/repeat current step
  workflow step --end-loop="reason"       End loop early and advance with reason (only after min iterations)
  workflow abort --abort="reason"         Abort workflow with reason
  workflow reset                          Reset workflow to the beginning
  workflow status                         Show current workflow status

Script Management:
  scripts                                 List all available scripts with descriptions
  scripts init <filename>                 Create new script from template (auto-adds .ts extension)

Server Commands:
  server                      Start the WebSocket RPC server
    --port <port>             Server port (default: 3000)
    --lootbox-root <path>     Lootbox root directory (default: .lootbox)
    --lootbox-data-dir <path> Data directory (optional, defaults to ~/.local/share/lootbox)

Tool Discovery:
  lootbox tools                            # List all available namespaces
  lootbox tools types sqlite,fetch         # Get TypeScript types
  lootbox tools --llm                      # LLM-focused help

Execution:
  lootbox script.ts                        # Execute script file
  lootbox exec 'console.log("Hello")'      # Execute inline code
  cat data.json | lootbox script.ts        # Pipe data to script

Examples:
  # Using tools in inline code
  lootbox exec 'console.log(await tools.sqlite.query({ sql: "SELECT 1" }))'

  # Parallel execution
  lootbox exec 'const [r1, r2] = await Promise.all([tools.ns1.f1({}), tools.ns2.f2({})]); console.log(r1, r2)'

  # Using fetch
  lootbox exec 'const data = await fetch("https://api.example.com").then(r => r.json()); console.log(data)'

  # Workflow execution
  lootbox workflow start tutorial.yaml
  lootbox workflow step                                    # Show/repeat current step
  lootbox workflow step --end-loop="completed the task"   # End loop early with reason
  lootbox workflow abort --abort="switching approach"     # Abort workflow
  lootbox workflow status                                 # Check progress

  # Script management
  lootbox scripts                       # List all available scripts
  lootbox scripts init fetch-data       # Create new script (auto-adds .ts)
  lootbox fetch-data.ts                 # Run the script

  # Server mode
  lootbox server                        # Uses defaults (port 3000, ./lootbox/tools)
  lootbox server --port 9000            # Custom port

  # Workflow file format (YAML):
  # steps:
  #   - title: Step name
  #     prompt: |
  #       Instructions for this step
  #   - title: Loop example
  #     loop: { min: 2, max: 5 }
  #     prompt: |
  #       This step repeats 2-5 times. Use 'workflow step' to repeat,
  #       or 'workflow step --end-loop="reason"' to advance (after min 2 iterations)
`);
}

export function showConfigHelp() {
  console.log(`lootbox - Configuration

Create a lootbox.config.json file in your project directory to configure both
client and server settings. All settings are optional with sensible defaults.

Configuration File:
  File: lootbox.config.json (in current directory)
  Format: JSON

Example:
  {
    "port": 3000,
    "lootboxRoot": ".lootbox",
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
      }
    }
  }

Settings:
  port              Server port (default: 3000, client derives ws://localhost:{port}/ws)
  serverUrl         Override for custom host/protocol (e.g., wss://remote:3000/ws)
  lootboxRoot       Root directory for lootbox files (default: .lootbox)
                    Contains: tools/, workflows/, scripts/
  lootboxDataDir    Internal data directory (default: ~/.local/share/lootbox)
  mcpServers        MCP server definitions (command, args, env)

Priority (for all settings):
  CLI flags > config file > defaults

The config file is optional. If not found, defaults will be used.
`);
}
