# Lootbox

A **local-first** TypeScript WebSocket RPC server that enables LLMs to execute code instead of using traditional tool calling. Runs entirely on your machine with your own functions.

## What it is

Lootbox implements "Code Mode" - LLMs write TypeScript code to call APIs rather than using tool invocation. This leverages what LLMs are already good at: writing real code with types and IntelliSense.

## Why Code Mode?

- **LLMs are better at writing code** than using artificial tool-calling syntax
- **Real-world TypeScript** is abundant in training data vs. contrived tool examples
- **Code execution allows chaining** multiple API calls without token overhead
- **Type safety and IntelliSense** provide better developer experience

## Prerequisites

- [Deno 2.x](https://deno.com/) or later
- Git (for cloning the repository)

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/jx-codes/lootbox/main/install.sh | bash
```

This installs `lootbox` to `~/.deno/bin/`.

Or build from source:

```bash
git clone https://github.com/jx-codes/lootbox
cd lootbox
deno task compile
```

## Quick Start

### 1. Start Server

```bash
lootbox server
```

### 2. Initialize Project (Optional)

```bash
lootbox init  # Creates .lootbox/ in current directory
```

The server starts with:

- WebSocket endpoint at `ws://localhost:8080/ws`
- Web UI at `http://localhost:8080/ui`
- OpenAPI docs at `http://localhost:8080/doc`

### 3. Create Your Tools

Create TypeScript files in `.lootbox/tools/`:

```typescript
// .lootbox/tools/myapi.ts
export async function processData(args: {
  items: string[];
  threshold: number;
}): Promise<{ processed: number; results: string[] }> {
  const results = args.items.filter((item) => item.length > args.threshold);
  return { processed: results.length, results };
}
```

### 4. Execute Scripts

```bash
# Execute inline code
lootbox -e 'console.log(await tools.myapi.processData({items: ["a", "bb"], threshold: 1}))'

# Execute from file
lootbox script.ts

# Execute from stdin
cat script.ts | lootbox

# Discover available tools
lootbox --namespaces
lootbox --types myapi,kv,sqlite
```

## Configuration

Create `lootbox.config.json` in your project:

```json
{
  "port": 8080,
  "lootboxRoot": ".lootbox",
  "lootboxDataDir": "./data",
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "your-token" }
    }
  }
}
```

**Options:**

- `port`: Server port (default: 8080)
- `lootboxRoot`: Directory containing tools/ subdirectory (default: `.lootbox`)
- `lootboxDataDir`: Directory for runtime data (optional)
- `mcpServers`: External MCP server configurations (optional)

**CLI Flags:**

```bash
lootbox server --port 3000                           # Custom port
lootbox server --lootbox-root ./my-tools             # Custom tools directory
lootbox server --lootbox-data-dir ./data             # Custom data directory
```

## MCP Server Integration

Integrate external MCP servers alongside local tools:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}
```

Access MCP tools with `mcp_{servername}` prefix:

```typescript
await tools.mcp_filesystem.read_file({ path: "/etc/hosts" });
await tools.mcp_github.create_issue({ repo: "owner/repo", title: "Bug" });
```

## Workflows

Execute multi-step workflows with Handlebars templating:

```bash
lootbox workflow start workflow.yaml   # Start workflow
lootbox workflow step                  # Get next step
lootbox workflow status                # Check status
lootbox workflow reset                 # Reset workflow
lootbox workflow abort --abort="reason" # Abort workflow
```

## Tool Requirements

All tools must follow this pattern:

```typescript
// ✅ Correct - with parameter
export async function functionName(args: ArgsType): Promise<ReturnType> {
  // Implementation
}

// ✅ Correct - no parameters
export async function getInfo(): Promise<InfoResult> {
  return { version: "0.0.52" };
}

// ❌ Wrong - not exported
async function privateFunction(args: any) {}

// ❌ Wrong - multiple parameters
export function wrongSignature(x: number, y: string) {}
```

**Requirements:**

- Must be exported
- Must have 0 or 1 parameter (if 1, it should be an object)
- Multiple parameters are not supported

## HTTP API Endpoints

| Endpoint             | Description                        |
| -------------------- | ---------------------------------- |
| `/health`            | Server health check                |
| `/namespaces`        | List available tools & MCP servers |
| `/types`             | All TypeScript type definitions    |
| `/types/:namespaces` | Types for specific namespaces      |
| `/client.ts`         | Generated TypeScript client        |
| `/ui`                | Status dashboard                   |
| `/doc`               | OpenAPI/Swagger documentation      |
| `/ws`                | WebSocket endpoint                 |

## Development

```bash
# Start in development mode
deno task start

# Build UI
deno task ui:build

# Format code
deno task fmt

# Lint code
deno task lint

# Compile standalone binary
deno task compile
```

## Architecture

```
┌─────────────┐          ┌─────────────────┐          ┌─────────────────┐
│   Clients   │          │     lootbox     │          │      Tools      │
│             │          │                 │          │                 │
│ • Web UI    │◄────────►│ • Auto-discover │◄────────►│ • .lootbox/tools│
│ • CLI       │    WS    │ • Type gen      │   Load   │ • MCP Servers   │
│ • LLM/MCP   │   HTTP   │ • Sandboxing    │          │                 │
└─────────────┘          └─────────────────┘          └─────────────────┘
```

**Key Features:**

- WebSocket RPC server with auto-discovery
- Sandboxed script execution with timeout
- Full TypeScript type safety
- MCP server integration

## Technical Details

### Worker-Based Execution

- **Fast Startup**: Workers stay warm, eliminating cold-start overhead

### Script Sandboxing

- **Isolated Execution**: User scripts run in separate Deno processes
- **Limited Permissions**: Scripts only have `--allow-net` access
- **10-Second Timeout**: Automatic termination for long-running scripts
- **Injected Client**: `tools` object automatically available

### Type System

- **AST Analysis**: Uses `ts-morph` to extract TypeScript types
- **Namespace Prefixing**: Prevents conflicts (e.g., `Kv_GetArgs`)
- **JSDoc Support**: Extracts documentation comments
- **Selective Generation**: Filter types by namespace

### Security Considerations

**Local-First Design**: Lootbox runs on your local machine in trusted environments.

- **Tool Functions**: Run with `--allow-all` - only include trusted code
- **User Scripts**: Sandboxed with `--allow-net` only
- **No Authentication**: Designed for localhost use
- **MCP Servers**: External processes with configurable permissions

## Inspiration

This project implements ideas from:

- Cloudflare's "Code Mode: the better way to use MCP"
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

## License

MIT License - See LICENSE file for details.
