# Lootbox

Code mode doesn't replace MCP - it orchestrates it.

Example: Fetch Jira issues, filter high-priority, store in KV
- MCP: 4 sequential tool calls
- Code mode: 1 script that calls 4 tools

The script is reusable. Now you have a "get-high-priority-jira" 
tool. It's tools all the way up.

That's what Lootbox does.

## What it is

Lootbox is inspired by "Code Mode" - LLMs write TypeScript code to call APIs rather than using tool invocation. This leverages what LLMs are already good at: writing real code with types and IntelliSense. The repository includes example tools for key-value storage, SQLite, knowledge graphs, GraphQL, and filesystem operations that you can copy to your project.

https://blog.cloudflare.com/code-mode/

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

### 2. Initialize Project

```bash
lootbox init  # Creates .lootbox/ in current directory
```

The server starts with:

- WebSocket endpoint at `ws://localhost:3000/ws`
- Web UI at `http://localhost:3000/ui`
- OpenAPI docs at `http://localhost:3000/doc`

### 3. Discover Available Tools

```bash
# List all available tool namespaces
lootbox tools

# Get TypeScript type definitions for specific namespaces
lootbox tools types kv,sqlite,memory

# List available scripts with examples
lootbox scripts
```

### 4. Create Your Tools

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

### 5. Execute Scripts

```bash
# Execute inline code
lootbox exec 'console.log(await tools.kv.get({key: "test"}))'

# Execute from file
lootbox script.ts

# Execute from stdin
cat script.ts | lootbox
```

## Example Tools

The repository includes example tools that demonstrate common use cases. You can copy these to your own `.lootbox/tools/` directory:

**Location in Repository**: `.lootbox/tools/`

**To use**: Copy the desired tool files from the repository's `.lootbox/tools/` directory to your project's `.lootbox/tools/` directory.

### Usage Example (After Copying Tools)

```typescript
// Using example tools (after copying to your .lootbox/tools/)
const kvResult = await tools.kv.set({
  key: "user:1",
  value: { name: "Alice" },
});
const userData = await tools.kv.get({ key: "user:1" });

// SQLite queries
await tools.sqlite.execute({
  sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
});
await tools.sqlite.query({
  sql: "SELECT * FROM users WHERE name = ?",
  params: ["Alice"],
});

// Knowledge graph
await tools.memory.createEntities({
  entities: [
    { name: "Alice", type: "person", properties: { age: 30 } },
    { name: "Bob", type: "person", properties: { age: 25 } },
  ],
});
await tools.memory.createRelations({
  relations: [{ from: "Alice", to: "Bob", type: "knows" }],
});

// GraphQL
const result = await tools.graphql.query({
  endpoint: "https://api.example.com/graphql",
  query: "{ user(id: 1) { name email } }",
});
```

## Script Management

Lootbox includes a script management system for creating reusable, documented scripts.

### Scripts Directory

Scripts are stored in `.lootbox/scripts/` and can be organized in subdirectories.

### Creating Scripts

```bash
# Create a new script from template
lootbox scripts init process-data

# This creates .lootbox/scripts/process-data.ts with template
```

### Script Format

Scripts support JSDoc comments for documentation and examples:

```typescript
/**
 * Process and format tags from JSON input
 * @example echo '{"tags": ["typescript", "deno"]}' | lootbox memory/tags.ts
 * @example echo '{"tags": ["a", "b"], "filter": "a"}' | lootbox memory/tags.ts
 */

const input = stdin().json();

if (!input || typeof input !== "object") {
  console.error(
    JSON.stringify({
      error: "Invalid input. Expected JSON object",
    })
  );
  throw new Error("Invalid input");
}

// Your script logic here
console.log(JSON.stringify(result, null, 2));
```

### Running Scripts

Use `lootbox scripts` to list all available scripts with descriptions and examples from JSDoc.

```bash
# Scripts auto-resolve from .lootbox/scripts/
lootbox process-data.ts

# Subdirectories work too
lootbox memory/tags.ts

# Pipe data to scripts
echo '{"tags": ["a", "b"]}' | lootbox memory/tags.ts
```

### stdin() Helper

When piping data to scripts, use the `stdin()` helper function:

**Methods**:

- `.text()` - Returns trimmed text content
- `.json()` - Returns parsed JSON object or null if invalid
- `.lines()` - Returns array of non-empty, trimmed lines
- `.raw()` - Returns raw input without processing

**Example**:

```typescript
// Process JSON input
const data = stdin().json();
console.log(data);

// Process text lines
const lines = stdin().lines();
lines.forEach((line) => console.log(line.toUpperCase()));

// Get raw text
const raw = stdin().raw();
```

## Configuration

Create `lootbox.config.json` in your project directory:

```json
{
  "port": 3000,
  "serverUrl": "ws://localhost:3000/ws",
  "lootboxRoot": ".lootbox",
  "lootboxDataDir": "./data",
  "mcpServers": {
    // WIP
  }
}
```

**Configuration Options:**

- `port` - Server port (default: 3000)
- `serverUrl` - Override WebSocket URL for custom host/protocol (optional, derived from port if not specified)
- `lootboxRoot` - Directory containing tools/, workflows/, scripts/ subdirectories (default: `.lootbox`)
- `lootboxDataDir` - Directory for runtime data storage (optional, defaults to `~/.local/share/lootbox` on Linux/Mac, `%LOCALAPPDATA%\lootbox` on Windows)
- `mcpServers` - External MCP server configurations (optional)

**Directory Resolution** (priority order):

1. Explicit `--lootbox-root` flag
2. `lootboxRoot` from config file
3. Local `.lootbox/` directory (if exists)
4. Global `~/.lootbox/` directory

**CLI Flags:**

- `--port <number>` - Custom server port
- `--lootbox-root <path>` - Custom tools directory
- `--lootbox-data-dir <path>` - Custom data directory
- `--server <url>` - Custom server URL for execution

## CLI Command Reference

### Execution

- `lootbox script.ts` - Execute TypeScript file
- `lootbox -e 'code'` or `lootbox exec 'code'` - Execute inline code
- `cat script.ts | lootbox` - Execute from stdin

### Tools & Scripts Discovery

- `lootbox tools` - List all tool namespaces (local + MCP)
- `lootbox tools types <namespaces>` - Get TypeScript types (comma-separated)
- `lootbox scripts` - List available scripts with examples
- `lootbox scripts init <name>` - Create new script from template

### Server & Init

- `lootbox server` - Start server (default port 3000)
- `lootbox server --port <port> --lootbox-root <dir> --lootbox-data-dir <dir>` - Start with custom settings
- `lootbox init` - Create `.lootbox/` directory structure

### Help

- `lootbox --help` - Human-friendly help
- `lootbox --llm-help` - LLM-focused command reference
- `lootbox --config-help` - Configuration documentation
- `lootbox --version` - Show version number

## MCP Server Integration

Integrate external MCP servers alongside local tools. MCP tools are namespaced with `mcp_{servername}` prefix.

### Configuration

```json
{
  "mcpServers": {
    // WIP may not work properly with all mcp servers
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}
```

### Usage

Access MCP tools with `mcp_{servername}` namespace prefix:

```typescript
// Filesystem MCP server
await tools.mcp_filesystem.read_file({ path: "/etc/hosts" });
await tools.mcp_filesystem.list_directory({ path: "/tmp" });

// GitHub MCP server
await tools.mcp_github.create_issue({
  repo: "owner/repo",
  title: "Bug Report",
  body: "Description...",
});

// Mix MCP tools with local tools
const data = await tools.kv.get({ key: "config" });
await tools.mcp_github.create_issue({
  repo: "owner/repo",
  title: data.value.title,
});
```

### Discovery

MCP server namespaces appear alongside local tools when running `lootbox tools`, prefixed with `mcp_` (e.g., `mcp_filesystem`, `mcp_github`).

## Workflows

Execute multi-step workflows with Handlebars templating, loops, and session tracking.

**Commands:**

- `lootbox workflow start <file>` - Start workflow
- `lootbox workflow step` - Execute/show current step
- `lootbox workflow step --end-loop="reason"` - End loop early (after min iterations)
- `lootbox workflow status` - Check current position
- `lootbox workflow reset` - Reset to beginning
- `lootbox workflow abort --abort="reason"` - Abort with reason

### Workflow File Format (YAML)

Workflows are YAML files located in `.lootbox/workflows/` or current directory.

**Basic Structure**:

```yaml
steps:
  - title: Step 1 - Setup
    prompt: |
      Initialize the project structure.

  - title: Step 2 - Implementation
    prompt: |
      Implement the core features.

  - title: "Loop: Testing (iteration {{loop}}/{{totalSteps}})"
    loop:
      min: 2
      max: 5
    prompt: |
      Run tests and fix issues.
      {{#if (eq loop 1)}}
      This is the first iteration.
      {{else}}
      This is iteration {{loop}}.
      {{/if}}
```

### Handlebars Templating

Workflows support Handlebars templates with built-in helpers:

**Template Variables**:

- `{{step}}` - Current step number (1-based)
- `{{totalSteps}}` - Total number of steps
- `{{loop}}` - Current loop iteration (only in loop steps, 1-based)

**Helpers**:

- `{{eq a b}}` - Equal comparison
- `{{ne a b}}` - Not equal
- `{{lt a b}}` - Less than
- `{{gt a b}}` - Greater than
- `{{lte a b}}` - Less than or equal
- `{{gte a b}}` - Greater than or equal

**Example with Conditionals**:

```yaml
steps:
  - title: "Step {{step}} of {{totalSteps}}"
    prompt: |
      {{#if (eq step 1)}}
      This is the first step.
      {{else if (eq step totalSteps)}}
      This is the final step.
      {{else}}
      This is an intermediate step.
      {{/if}}
```

### Loop Mechanics

Loop steps repeat with configurable min/max iterations. When max iterations reached, automatically advances to next step.

```yaml
- title: "Review Loop ({{loop}}/{{max}})"
  loop:
    min: 2 # Minimum iterations before --end-loop allowed
    max: 5 # Maximum iterations (auto-advances)
  prompt: |
    Review the code. Current iteration: {{loop}}
```

### Session Tracking

Each workflow run has a unique session ID for tracking workflow events:

- Session ID generated on `workflow start`
- Persisted in `.lootbox-workflow.json` state file
- Used for workflow logging and analytics
- Visible with `lootbox workflow status`

### Workflow State

Workflow state stored in `.lootbox-workflow.json` includes:

- Current step index
- Loop iteration count
- Session ID
- Workflow file path

State automatically managed - deleted on completion or abort.

## Tool Requirements

All tools must follow these patterns:

```typescript
// ✅ Correct - with single parameter (object)
export async function functionName(args: ArgsType): Promise<ReturnType> {
  // Implementation
}

// ✅ Correct - no parameters
export async function getInfo(): Promise<InfoResult> {
  return { version: "0.0.54" };
}

// ✅ Correct - with TypeScript interfaces
export interface CreateArgs {
  name: string;
  value: number;
}

export interface CreateResult {
  success: boolean;
  id: string;
}

export async function create(args: CreateArgs): Promise<CreateResult> {
  return { success: true, id: "123" };
}

// ❌ Wrong - not exported
async function privateFunction(args: any) {}

// ❌ Wrong - multiple parameters
export function wrongSignature(x: number, y: string) {}
```

**Requirements:**

- Must be exported using `export` keyword
- Must have 0 or 1 parameter only
- If 1 parameter, it must be an object type
- Multiple positional parameters are not supported
- Should use TypeScript interfaces for type safety
- Should be async (return Promise) for consistency

**Best Practices:**

- Export TypeScript interfaces for args and results
- Use JSDoc comments for function documentation
- Keep functions focused on single responsibility
- Handle errors with clear error messages
- Return structured objects, not primitives

See the "Example Tools" section above for reference implementations (kv, sqlite, memory, graphql).

## HTTP API Endpoints

| Endpoint             | Method | Description                                       |
| -------------------- | ------ | ------------------------------------------------- |
| `/health`            | GET    | Server health check                               |
| `/namespaces`        | GET    | List available tool namespaces and MCP servers    |
| `/types`             | GET    | All TypeScript type definitions for all tools     |
| `/types/:namespaces` | GET    | Types for specific namespaces (comma-separated)   |
| `/client.ts`         | GET    | Generated TypeScript client with type definitions |
| `/ui`                | GET    | Interactive status dashboard (HTML)               |
| `/doc`               | GET    | OpenAPI/Swagger documentation (HTML)              |
| `/ws`                | WS     | WebSocket endpoint for script execution           |

### Examples

```bash
# Get all namespaces
curl http://localhost:3000/namespaces

# Get types for specific namespaces
curl http://localhost:3000/types/kv,sqlite,memory

# Get all types
curl http://localhost:3000/types

# Download TypeScript client
curl http://localhost:3000/client.ts > client.ts

# Health check
curl http://localhost:3000/health
```

## Development

### Development Mode

Development mode enables hot-reloading and debugging:

```bash
# Start server in development mode (MODE=development)
deno task start

# This enables:
# - Automatic restarts on file changes
# - Verbose logging
# - Development-specific features
```

### Building

```bash
# Build UI (required before compile)
deno task ui:build

# Compile standalone binary
deno task compile

# UI development server
deno task ui:dev

# UI preview mode
deno task ui:preview
```

### Code Quality

```bash
# Format code
deno task fmt

# Lint code
deno task lint
```

### Production Mode

```bash
# Start in production mode (no auto-reload)
deno task start:prod

# Or run compiled binary
./lootbox server
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
