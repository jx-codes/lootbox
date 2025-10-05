export function showHelp() {
  console.log(`lootbox - Sandboxed TypeScript runtime with network access

Write scripts with fetch() for web requests and the 'tools' object for
additional capabilities. Sandboxed execution keeps your system safe while
you orchestrate, fetch, and transform data.

Usage:
  lootbox [OPTIONS] [FILE]
  lootbox -e <script>
  cat script.ts | lootbox
  lootbox workflow <command> [args]

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
