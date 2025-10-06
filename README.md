# This is Open Source because I thought the technique was really cool.

I've been using lootbox daily since I started building it. So far I've used it to automate my knowledge base, build a daily language practice app with Claude as my tutor, an instagram post -> image generator and a lot more.

I hope the community takes this and builds on it, shares their lootbox scripts, or whatever workflows they found work well for them.

If you do end up using lootbox I'd love to hear from you!


## Lootbox

> Lootbox looks so cool! Can I have a lootbox?
>
> _Totally real Claude Code Quote_

## What it is

A **local-first** TypeScript WebSocket RPC server that enables LLMs to execute code instead of using traditional tool calling. Runs entirely on your machine with your own functions. This project implements the "Code Mode" approach inspired by Cloudflare's MCP research, where LLMs write TypeScript code to call APIs rather than using direct tool invocation.



## Why Code Mode?

Traditional MCP implementations require LLMs to use special tool-calling tokens and synthetic training data. This project takes a different approach:

- **LLMs are better at writing code** than using artificial tool-calling syntax
- **Real-world TypeScript** is abundant in training data vs. contrived tool examples
- **Code execution allows chaining** multiple API calls without token overhead
- **Type safety and IntelliSense** provide better developer experience

## Core Components

### 1. **lootbox server** (WebSocket Server)

The main RPC server that auto-discovers TypeScript functions, generates type definitions, and executes scripts in isolated sandboxes.

```bash
# Start the server
lootbox server --rpc-dir ./my-functions --port 8080
```

### 2. **lootbox** (CLI Client)

A lightweight command-line tool for one-shot script execution via WebSocket.

```bash
# Execute scripts directly
lootbox script.ts
lootbox -e 'console.log(await tools.kv.get({key: "mykey"}))'
cat script.ts | lootbox

# Discover available functions
lootbox --namespaces
lootbox --types fs,kv,sqlite
```

### 3. **Web UI** (Status Dashboard)

React-based status dashboard showing server health, WebSocket connection status, and available namespaces at `http://localhost:8080/ui`.

## Architecture

```
┌─────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   Clients   │          │     lootbox     │          │  RPC Functions  │
│             │          │  (This Server)  │          │   & MCP Servers │
│ • Web UI    │◄────────►│                 │◄────────►│                 │
│ • CLI Tool  │    WS    │ • Auto-discover │          │ • test-rpc/*.ts │
│ • LLM/MCP   │  HTTP    │ • Type gen      │   Load   │ • External MCP  │
│             │          │ • Sandboxing    │          │                 │
└─────────────┘          └─────────────────┘          └─────────────────┘
```

**Key Features:**

- WebSocket RPC server with auto-discovery and type generation
- Persistent worker processes for fast RPC execution
- Sandboxed script execution with 10-second timeout
- MCP server integration (filesystem, GitHub, etc.)
- OpenAPI/Swagger documentation

## Prerequisites

- [Deno 2.x](https://deno.com/) or later
- Git (for cloning the repository)
- Node.js/npm (optional, only for UI development)

## Installation

### Option 1: Quick Install (Recommended)

Install globally using the provided script:

```bash
curl -fsSL https://raw.githubusercontent.com/jx-codes/lootbox/main/install.sh | bash
```

This installs the `lootbox` CLI to `~/.deno/bin/`.

### Option 2: Manual Installation

Clone and build from source:

```bash
git clone https://github.com/jx-codes/lootbox
cd lootbox
deno task compile
```

The compiled binary `lootbox` will be created in the project root.

## Quick Start

### 1. Start the Server

```bash
deno task start                    # Development mode with test-rpc functions
deno task start:prod              # Production mode
```

The server starts on `http://localhost:8080` with:

- WebSocket endpoint at `ws://localhost:8080/ws`
- Web UI at `http://localhost:8080/ui`
- OpenAPI docs at `http://localhost:8080/doc`

### 2. Create Your RPC Functions

Create TypeScript files in `test-rpc/` (or your own directory):

```typescript
// test-rpc/myapi.ts
export async function processData(args: {
  items: string[];
  threshold: number;
}): Promise<{ processed: number; results: string[] }> {
  const results = args.items.filter((item) => item.length > args.threshold);
  return { processed: results.length, results };
}
```

### 3. Use the Runtime

**Option A: CLI Tool**

```bash
# Compile the CLI tool
deno task compile-exec

# Execute scripts
./lootbox -e 'console.log(await tools.myapi.processData({items: ["a", "bb", "ccc"], threshold: 1}))'
./lootbox script.ts
```

**Option B: Direct WebSocket**

```javascript
const ws = new WebSocket("ws://localhost:8080/ws");
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      script:
        'console.log(await tools.myapi.processData({items: ["hello"], threshold: 0}))',
      id: "exec_1",
    })
  );
};
```

## Core Features

### 🔍 Auto-Discovery

The server automatically discovers exported TypeScript functions:

```typescript
// Discovers all exported functions from RPC directory
// Functions become: namespace.functionName (e.g., kv.get, sqlite.query, fs.readFile)
```

### 🏷️ Type Safety

Full TypeScript type extraction with namespace prefixing:

```typescript
// Generated client includes full type definitions
export interface Kv_SetArgs {
  key: string;
  value: unknown;
}
export interface Kv_SetResult {
  success: boolean;
  key: string;
}
export interface Sqlite_QueryArgs {
  sql: string;
  params?: unknown[];
}
export interface Sqlite_QueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
}
export interface RpcClient {
  kv: {
    get(args: Kv_GetArgs): Promise<Kv_GetResult>;
    set(args: Kv_SetArgs): Promise<Kv_SetResult>;
    list(args: Kv_ListArgs): Promise<Kv_ListResult>;
  };
  sqlite: {
    execute(args: Sqlite_ExecuteArgs): Promise<Sqlite_ExecuteResult>;
    query(args: Sqlite_QueryArgs): Promise<Sqlite_QueryResult>;
  };
  fs: {
    readFile(args: Fs_ReadFileArgs): Promise<Fs_ReadFileResult>;
    writeFile(args: Fs_WriteFileArgs): Promise<Fs_WriteFileResult>;
  };
}
```

### 📡 WebSocket RPC

Real-time bidirectional communication:

```javascript
const ws = new WebSocket("ws://localhost:8080/ws");

// Direct RPC call
ws.send(
  JSON.stringify({
    method: "kv.get",
    args: { key: "mykey" },
    id: "call_123",
  })
);

// Script execution
ws.send(
  JSON.stringify({
    script: `
    const result = await tools.kv.get({ key: 'user:123' });
    const count = await tools.kv.count({ prefix: 'user:' });
    console.log('User data:', result);
    console.log('Total users:', count.count);
  `,
    sessionId: "user-session-123", // Optional: associate script with a session
    id: "script_456",
  })
);
```

### 🎬 Script Execution

Execute complete TypeScript workflows with injected tools client:

```typescript
// This TypeScript code runs in a sandboxed environment
// with the 'tools' object automatically available

const userIds = ["alice", "bob", "charlie"];
const userData = [];

for (const id of userIds) {
  const result = await tools.kv.get({ key: `user:${id}` });
  if (result.exists) {
    userData.push(result.value);
  }
}

// Store aggregated data in SQLite
await tools.sqlite.execute({
  sql: "CREATE TABLE IF NOT EXISTS user_summary (count INTEGER, timestamp TEXT)",
});

await tools.sqlite.execute({
  sql: "INSERT INTO user_summary (count, timestamp) VALUES (?, ?)",
  params: [userData.length, new Date().toISOString()],
});

console.log(`Processed ${userData.length} users`);
```

## HTTP API Endpoints

| Endpoint             | Description                         | Response                             |
| -------------------- | ----------------------------------- | ------------------------------------ |
| `/health`            | Server health check                 | `{ status: "ok", functions: [...] }` |
| `/namespaces`        | List available RPC & MCP namespaces | `{ rpc: [...], mcp: [...] }`         |
| `/rpc-namespaces`    | Metadata for RPC functions          | Human-readable function signatures   |
| `/types`             | All TypeScript type definitions     | Full TypeScript interfaces           |
| `/types/:namespaces` | Types for specific namespaces       | Filtered TypeScript interfaces       |
| `/client.ts`         | Generated TypeScript client         | Full RPC client with types           |
| `/ui`                | Status dashboard                    | React SPA interface                  |
| `/doc`               | OpenAPI/Swagger documentation       | Interactive API docs                 |
| `/ws`                | WebSocket endpoint                  | Script execution & RPC calls         |

## RPC Function Requirements

All RPC functions must follow this pattern:

```typescript
// ✅ Correct - with parameter
export async function functionName(args: ArgsType): Promise<ReturnType> {
  // Implementation
}

// ✅ Correct - no parameters
export async function getInfo(): Promise<InfoResult> {
  return { version: "1.0.0" };
}

// ✅ Correct - synchronous with parameter
export function simpleCalc(args: { x: number }): number {
  return args.x * 2;
}

// ❌ Wrong - not exported
async function privateFunction(args: any) {}

// ❌ Wrong - multiple parameters
export function wrongSignature(x: number, y: string) {}
```

**Requirements:**

- Must be exported
- Must be async or sync (returning Promise or value)
- Must have 0 or 1 parameter (if 1 parameter, it should be an object)
- Multiple parameters are not supported

## Example RPC Functions

The `test-rpc/` directory includes example implementations:

- **`fs.ts`**: Filesystem operations with access controls (read, write, list, delete files)
- **`kv.ts`**: Simple key-value store using JSON file storage (get, set, delete, list keys)
- **`sqlite.ts`**: SQLite database operations (execute SQL, query data)

### Example Usage

```typescript
// Create a table and insert data
await tools.sqlite.execute({
  sql: "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)",
});

await tools.sqlite.execute({
  sql: "INSERT INTO users (name, email) VALUES (?, ?)",
  params: ["Alice", "alice@example.com"],
});

// Query the data
const result = await tools.sqlite.query({
  sql: "SELECT * FROM users WHERE name = ?",
  params: ["Alice"],
});

console.log("Found users:", result.rows);

// Store data in KV store
await tools.kv.set({
  key: "user:alice",
  value: { name: "Alice", active: true },
});
const userData = await tools.kv.get({ key: "user:alice" });

console.log("User data:", userData.value, "exists:", userData.exists);
```

## Configuration

### Runtime Server Options

```bash
deno run --allow-all src/main.ts [options]

Required:
  --rpc-dir, -r           Directory containing RPC TypeScript files
  --port, -p              Port number for server

Optional:
  --mcp-config, -m        Path to MCP server configuration JSON
  --lootbox-data-dir, -d  Directory for runtime data (script history, etc.)
                          Defaults to platform-specific standard location:
                          - macOS: ~/Library/Application Support/lootbox
                          - Linux: ~/.local/share/lootbox
                          - Windows: %APPDATA%/lootbox

Examples:
  --rpc-dir ./functions --port 8080
  --rpc-dir ~/.rpc --port 3000 --mcp-config mcp-servers.json
```

### CLI Client Configuration

Create `lootbox.config.json` in your project directory:

```json
{
  "serverUrl": "ws://localhost:8080/ws"
}
```

Priority: `--server` flag > config file > default (`ws://localhost:8080/ws`)

### Deno Tasks

```bash
# Server
deno task start           # Development mode with UI hot-reload
deno task start:prod      # Production mode
deno task compile         # Build standalone lootbox binary (includes server + CLI + UI)

# UI development
deno task ui:dev          # Start Vite dev server (port 5173)
deno task ui:build        # Build UI for production
deno task ui:preview      # Preview production build

# Code quality
deno task fmt             # Format code
deno task lint            # Lint code
```

## MCP Server Integration

The runtime can integrate external MCP servers alongside local RPC functions:

```json
// mcp-servers.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "your-token" }
    }
  }
}
```

Start server with MCP integration:

```bash
deno task start --mcp-config mcp-servers.json
```

Access MCP tools via namespaced calls:

```typescript
// MCP tools appear as mcp_{servername}.{toolname}
await tools.mcp_filesystem.read_file({ path: "/etc/hosts" });
await tools.mcp_github.create_issue({ repo: "owner/repo", title: "Bug" });
```

## Technical Details

### Worker-Based Execution

- **Persistent Worker Pool**: RPC functions execute in long-lived Deno worker processes
- **Fast Startup**: Workers stay warm, eliminating cold-start overhead
- **Isolation**: Each worker runs with `--allow-all` permissions for RPC functions
- **Automatic Cleanup**: Workers restart on crashes or after extended inactivity

### Script Sandboxing

- **Isolated Execution**: User scripts run in separate Deno processes
- **Limited Permissions**: Scripts only have `--allow-net` (network access)
- **10-Second Timeout**: Automatic termination for long-running scripts
- **Injected Tools Client**: `tools` object automatically available in script scope

### Type System

- **AST Analysis**: Uses `ts-morph` to extract TypeScript types from source
- **Namespace Prefixing**: Prevents type conflicts (e.g., `Slack_MessageArgs`)
- **JSDoc Support**: Extracts documentation comments for generated client
- **Selective Generation**: Filter types by namespace (`/types/slack,stripe`)

### Hot Reload & Caching

- **File Watching**: Monitors `test-rpc/` for changes, auto-reloads functions
- **Client Caching**: Generated client cached until RPC files change
- **Metadata Cache**: Function signatures cached for fast `/namespaces` queries
- **WebSocket Notifications**: Connected clients notified of function updates

### Security Considerations

**Local-First Design**: Lootbox is designed to run on your local machine in trusted environments. All execution happens locally with your own functions.

- **RPC Functions**: Run with `--allow-all` - only include trusted code
- **User Scripts**: Sandboxed with `--allow-net` only
- **No Authentication**: WebSocket has no built-in auth - designed for localhost use
- **MCP Servers**: External processes with configurable permissions

## Project Structure

```
src/
├── main.ts                              # Server entry point
├── exec.ts                              # CLI tool entry point
├── lib/
│   ├── get_config.ts                    # Configuration & CLI args
│   ├── execute_llm_script.ts            # Sandboxed script execution
│   ├── script_history.ts                # Execution history tracking
│   ├── client_cache.ts                  # Generated client caching
│   ├── ui_server.ts                     # Web UI routing (dev/prod)
│   ├── rpc/
│   │   ├── websocket_server.ts          # Main WebSocket server (Hono)
│   │   ├── worker_manager.ts            # Persistent worker pool
│   │   ├── rpc_worker.ts                # Worker process handler
│   │   ├── execute_rpc.ts               # RPC function execution
│   │   ├── execute_mcp.ts               # MCP tool execution
│   │   ├── load_rpc_files.ts            # Function auto-discovery
│   │   ├── client.ts                    # Client template
│   │   ├── managers/                    # Modular server components
│   │   │   ├── connection_manager.ts    # WebSocket connections
│   │   │   ├── message_router.ts        # WS message routing
│   │   │   ├── route_handler.ts         # HTTP route handlers (deprecated)
│   │   │   ├── openapi_route_handler.ts # OpenAPI/Swagger routes
│   │   │   ├── file_watcher_manager.ts  # Hot-reload for RPC files
│   │   │   ├── type_generator_manager.ts# Type generation
│   │   │   ├── mcp_integration_manager.ts # MCP server lifecycle
│   │   │   └── rpc_cache_manager.ts     # Function metadata cache
│   │   └── schemas/
│   │       └── openapi_schemas.ts       # Zod schemas for API
│   ├── external-mcps/                   # MCP integration
│   │   ├── mcp_config.ts                # Config loading & validation
│   │   ├── mcp_client_manager.ts        # MCP server lifecycle
│   │   ├── mcp_schema_fetcher.ts        # Tool schema extraction
│   │   ├── parse_mcp_schemas.ts         # Schema to TypeScript types
│   │   └── create_rpc_client_section.ts # MCP client generation
│   └── type_system/
│       ├── type_extractor.ts            # TypeScript AST analysis
│       ├── client_generator.ts          # Client code generation
│       ├── documentation_extractor.ts   # JSDoc extraction
│       ├── namespace_filter.ts          # Selective type filtering
│       ├── file_system_adapter.ts       # File system operations
│       └── types.ts                     # Shared type definitions
├── test-rpc/                            # Example RPC functions
│   ├── fs.ts                            # Filesystem operations
│   ├── kv.ts                            # Key-value store
│   └── sqlite.ts                        # SQLite database
└── ui/                                  # React Web UI
    ├── src/
    │   ├── pages/                       # Status Dashboard
    │   ├── components/                  # Reusable UI components
    │   └── lib/                         # API client, WebSocket client
    └── dist/                            # Built UI (production)
```

## Troubleshooting

### Common Issues

**Functions not discovered:**

```bash
# Verify function signature: export async function name(args: Type): Promise<Result>
# or: export async function name(): Promise<Result>
# Check files are .ts and in --rpc-dir directory
# Inspect discovered functions:
curl http://localhost:8080/rpc-namespaces
lootbox --namespaces
```

**UI not loading:**

```bash
# Development mode: Ensure Vite dev server is running
deno task ui:dev  # Separate terminal

# Production mode: Build UI first
deno task ui:build
deno task start:prod
```

**WebSocket connection refused:**

```bash
# Check server is running and port is correct
curl http://localhost:8080/health

# Verify port not in use
lsof -i :8080

# Test WebSocket directly
websocat ws://localhost:8080/ws
```

**Script execution timeout:**

```javascript
// Scripts timeout after 10 seconds
// Solution 1: Break into smaller RPC functions
// Solution 2: Use Promise.all() for parallel calls
const results = await Promise.all([
  tools.kv.get({ key: "user1" }),
  tools.kv.get({ key: "user2" }),
]);
```

**MCP server not starting:**

```bash
# Check MCP config file syntax
cat mcp-servers.json | jq .

# Verify MCP server command is available
npx -y @modelcontextprotocol/server-filesystem --version

# Check server logs for startup errors
deno task start --mcp-config mcp-servers.json
```

**CLI tool config not working:**

```bash
# Verify config file exists in current directory
cat lootbox.config.json

# Test with explicit --server flag
lootbox --server ws://localhost:8080/ws --namespaces
```

## Inspiration & Research

This project implements ideas from:

- Cloudflare's "Code Mode: the better way to use MCP"
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Dynamic Worker loading and V8 isolates for sandboxing

## License

MIT License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing patterns
4. Add tests for new functionality
5. Submit a pull request

For questions or issues, please open a GitHub issue.
