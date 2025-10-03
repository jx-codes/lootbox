# Lootbox

A TypeScript WebSocket RPC server that enables LLMs to execute code instead of using traditional tool calling. This project implements the "Code Mode" approach inspired by Cloudflare's innovative MCP research, where LLMs write TypeScript code to call APIs rather than using direct tool invocation.

## Why Code Mode?

Traditional MCP implementations require LLMs to use special tool-calling tokens and synthetic training data. This project takes a different approach:

- **LLMs are better at writing code** than using artificial tool-calling syntax
- **Real-world TypeScript** is abundant in training data vs. contrived tool examples
- **Code execution allows chaining** multiple API calls without token overhead
- **Type safety and IntelliSense** provide better developer experience

## Core Components

### 1. **lootbox-runtime** (WebSocket Server)

The main RPC server that auto-discovers TypeScript functions, generates type definitions, and executes scripts in isolated sandboxes.

### 2. **lootbox** (CLI Client)

A lightweight command-line tool for one-shot script execution via WebSocket.

```bash
# Execute scripts directly
lootbox script.ts
lootbox -e 'console.log(await rpc.slack.sendMessage({channelId: "C123", text: "Hello!"}))'
cat script.ts | lootbox

# Discover available functions
lootbox --namespaces
lootbox --types slack,stripe
```

### 3. **Web UI** (Dashboard & Playground)

Modern React interface for interactive RPC exploration, script execution, and server monitoring at `http://localhost:8080/ui`.

## Architecture

```
┌─────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   Clients   │          │     lootbox     │          │  RPC Functions  │
│             │          │  (This Server)  │          │   & MCP Servers │
│ • Web UI    │◄────────►│                 │◄────────►│                 │
│ • CLI Tool  │    WS    │ • Auto-discover │          │ • test-rpc/*.ts │
│ • LLM/MCP   │  HTTP    │ • Type gen      │   Load   │ • External MCP  │
│             │          │ • Sandboxing    │          │   (optional)    │
└─────────────┘          └─────────────────┘          └─────────────────┘
```

**Key Features:**

- WebSocket RPC server with auto-discovery and type generation
- Persistent worker processes for fast RPC execution
- Sandboxed script execution with 10-second timeout
- Optional MCP server integration (Zendesk, Slack, etc.)
- OpenAPI/Swagger documentation

## Quick Start

### Installation

Requires [Deno 2.x](https://deno.com/):

```bash
git clone https://github.com/jx-codes/lootbox
cd lootbox
```

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

**Option A: Web UI (Easiest)**

```bash
# Open browser to http://localhost:8080/ui
# Use the Playground to write and execute scripts interactively
```

**Option B: CLI Tool**

```bash
# Compile the CLI tool
deno task compile-exec

# Execute scripts
./lootbox -e 'console.log(await rpc.myapi.processData({items: ["a", "bb", "ccc"], threshold: 1}))'
./lootbox script.ts
```

**Option C: Direct WebSocket**

```javascript
const ws = new WebSocket("ws://localhost:8080/ws");
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      script:
        'console.log(await rpc.myapi.processData({items: ["hello"], threshold: 0}))',
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
// Functions become: namespace.functionName (e.g., math.add, weather.getCurrentWeather)
```

### 🏷️ Type Safety

Full TypeScript type extraction with namespace prefixing:

```typescript
// Generated client includes full type definitions
export interface Math_AddArgs {
  a: number;
  b: number;
}
export interface RpcClient {
  math: {
    add(args: Math_AddArgs): Promise<number>;
    multiply(args: Math_MultiplyArgs): Promise<number>;
  };
  weather: {
    getCurrentWeather(
      args: Weather_CurrentWeatherArgs
    ): Promise<Weather_WeatherResult>;
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
    method: "math.add",
    args: { a: 5, b: 3 },
    id: "call_123",
  })
);

// Script execution
ws.send(
  JSON.stringify({
    script: `
    const result = await rpc.math.add({ a: 10, b: 20 });
    const weather = await rpc.weather.getCurrentWeather({ location: 'San Francisco' });
    console.log('Math result:', result);
    console.log('Weather:', weather);
  `,
    sessionId: "user-session-123", // Optional: associate script with a session
    id: "script_456",
  })
);
```

### 🎬 Script Execution

Execute complete TypeScript workflows with injected RPC client:

```typescript
// This TypeScript code runs in a sandboxed environment
// with the 'rpc' object automatically available

const team = ["charizard", "blastoise", "venusaur"];
const pokemonData = [];

for (const name of team) {
  const pokemon = await rpc.pokemon.fetchPokemon({ name });
  pokemonData.push(pokemon);
}

const analysis = await rpc.pokemon.analyzeTeam({ teamNames: team });
const sum = await rpc.math.add({ a: analysis.team.length, b: 10 });

console.log(`Analyzed ${team.length} Pokemon. Total with bonus: ${sum}`);
console.log("Team strengths:", analysis.strengths);
```

## HTTP API Endpoints

| Endpoint             | Description                         | Response                           |
| -------------------- | ----------------------------------- | ---------------------------------- |
| `/health`            | Server health check                 | `{ status: "ok" }`                 |
| `/namespaces`        | List available RPC & MCP namespaces | `{ rpc: [...], mcp: [...] }`       |
| `/rpc/namespaces`    | Metadata for RPC functions          | Human-readable function signatures |
| `/types`             | All TypeScript type definitions     | Full TypeScript interfaces         |
| `/types/:namespaces` | Types for specific namespaces       | Filtered TypeScript interfaces     |
| `/client.ts`         | Generated TypeScript client         | Full RPC client with types         |
| `/ui`                | Web dashboard                       | React SPA interface                |
| `/doc`               | OpenAPI/Swagger documentation       | Interactive API docs               |
| `/ws`                | WebSocket endpoint                  | Script execution & RPC calls       |

## RPC Function Requirements

All RPC functions must follow this pattern:

```typescript
// ✅ Correct
export async function functionName(args: ArgsType): Promise<ReturnType> {
  // Implementation
}

// ✅ Also correct (synchronous)
export function simpleCalc(args: { x: number }): number {
  return args.x * 2;
}

// ❌ Wrong - not exported
async function privateFunction(args: any) {}

// ❌ Wrong - multiple parameters
export function wrongSignature(x: number, y: string) {}
```

## Example RPC Functions

The `test-rpc/` directory includes production-ready examples:

### Service Integrations

- **`slack.ts`**: Send messages, list channels, rich notifications (25+ functions)
- **`stripe.ts`**: Customer lookups, subscriptions, payment health checks
- **`zendesk.ts`**: Ticket management, customer queries, comment handling
- **`linear.ts`**: Issue tracking, project management integration
- **`sendgrid.ts`**: Email sending, templates, transactional emails

### Data & Utilities

- **`filedb.ts`**: JSON-based lightweight database with SQL-like operations

### Example Usage

```typescript
// Multi-service workflow via Web UI or CLI
const ticket = await rpc.zendesk.getTicket({ ticketId: 12345 });
const customer = await rpc.stripe.getCustomer({
  customerId: ticket.customerId,
});

// Create Linear issue from Zendesk ticket
const issue = await rpc.linear.createIssue({
  title: ticket.subject,
  description: `Zendesk #${ticket.id}\nCustomer: ${customer.email}`,
  priority: 1,
});

// Notify team via Slack
await rpc.slack.sendMessage({
  channelId: "C123",
  text: `New high-priority issue created: ${issue.url}`,
});

console.log("Ticket escalated successfully!");
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
deno task compile         # Build standalone lootbox-runtime binary (includes UI)

# CLI tool
deno task compile-exec    # Build lootbox CLI binary

# UI development
deno task ui:dev          # Start Vite dev server (port 5173)
deno task ui:build        # Build UI for production
deno task ui:preview      # Preview production build

# Code quality
deno task fmt             # Format code
deno task lint            # Lint code
```

## MCP Server Integration (Optional)

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

Access MCP tools via namespaced RPC calls:

```typescript
// MCP tools appear as mcp.{servername}.{toolname}
await rpc.mcp.filesystem.read_file({ path: "/etc/hosts" });
await rpc.mcp.github.create_issue({ repo: "owner/repo", title: "Bug" });
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
- **Injected RPC Client**: `rpc` object automatically available in script scope

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

- **RPC Functions**: Run with `--allow-all` - only include trusted code
- **User Scripts**: Sandboxed with `--allow-net` only
- **No Authentication**: WebSocket has no auth - use in trusted environments or behind firewall
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
│   │   │   ├── route_handler.ts         # HTTP route handlers
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
│       └── types.ts                     # Shared type definitions
├── test-rpc/                            # Example RPC functions
│   ├── filedb.ts                        # JSON database
│   ├── slack.ts                         # Slack integration
│   ├── stripe.ts                        # Stripe payments
│   ├── zendesk.ts                       # Zendesk support
│   ├── linear.ts                        # Linear issues
│   └── sendgrid.ts                      # Email sending
└── ui/                                  # React Web UI
    ├── src/
    │   ├── pages/                       # Dashboard, Playground, etc.
    │   ├── components/                  # Reusable UI components
    │   └── lib/                         # API client, WebSocket client
    └── dist/                            # Built UI (production)
```

## Troubleshooting

### Common Issues

**Functions not discovered:**

```bash
# Verify function signature: export async function name(args: Type): Promise<Result>
# Check files are .ts and in --rpc-dir directory
# Inspect discovered functions:
curl http://localhost:8080/rpc/namespaces
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
  rpc.slack.sendMessage({...}),
  rpc.stripe.getCustomer({...})
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
