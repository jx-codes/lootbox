# MCP RPC Runtime

A TypeScript WebSocket RPC server that enables LLMs to execute code instead of using traditional tool calling. This project implements the "Code Mode" approach inspired by Cloudflare's innovative MCP research, where LLMs write TypeScript code to call APIs rather than using direct tool invocation.

## Why Code Mode?

Traditional MCP implementations require LLMs to use special tool-calling tokens and synthetic training data. This project takes a different approach:

- **LLMs are better at writing code** than using artificial tool-calling syntax
- **Real-world TypeScript** is abundant in training data vs. contrived tool examples
- **Code execution allows chaining** multiple API calls without token overhead
- **Type safety and IntelliSense** provide better developer experience

## Architecture

This is part of a two-component system:

```
┌─────────────┐          ┌─────────────────┐          ┌─────────────────┐
│ MCP Client  │◄────────►│  mcp-rpc-bridge │◄────────►│ mcp-rpc-runtime │
│ (Claude)    │   MCP    │  (MCP Server)   │    WS    │ (This Project)  │
└─────────────┘          └─────────────────┘          └─────────────────┘
                                                                │
                                                                │ loads &
                                                                │ executes
                                                                ▼
                                                       ┌─────────────────┐
                                                       │ TypeScript RPC  │
                                                       │ Functions       │
                                                       │ (--rpc-dir)     │
                                                       └─────────────────┘
```

- **mcp-rpc-runtime** (this project): WebSocket RPC server with auto-discovery and type generation
- **mcp-rpc-bridge** (companion): MCP server that translates between MCP protocol and this runtime

## Quick Start

### Installation

Requires [Deno 2.x](https://deno.com/):

```bash
git clone https://github.com/jx-codes/mcp-rpc-runtime
cd mcp-rpc-runtime
```

### 1. Create RPC Functions

Create TypeScript files in a directory (e.g., `./my-rpc/`):

```typescript
// my-rpc/math.ts
export function add(args: { a: number; b: number }): number {
  return args.a + args.b;
}

export function multiply(args: { a: number; b: number }): number {
  return args.a * args.b;
}
```

```typescript
// my-rpc/weather.ts
export async function getCurrentWeather(args: {
  location: string
}): Promise<{ temperature: number; condition: string }> {
  // Your weather API logic here
  const response = await fetch(`https://api.weather.com/current?q=${args.location}`);
  return await response.json();
}
```

### 2. Start the Server

```bash
deno task start                                    # Uses test-rpc directory
# OR
deno run --allow-all src/main.ts --rpc-dir ./my-rpc --port 8080
```

### 3. Use the Generated Client

```bash
# Get the TypeScript client
curl http://localhost:8080/client.ts > rpc_client.ts

# Or execute scripts directly via WebSocket
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
export interface Math_AddArgs { a: number; b: number; }
export interface RpcClient {
  math: {
    add(args: Math_AddArgs): Promise<number>;
    multiply(args: Math_MultiplyArgs): Promise<number>;
  };
  weather: {
    getCurrentWeather(args: Weather_CurrentWeatherArgs): Promise<Weather_WeatherResult>;
  };
}
```

### 📡 WebSocket RPC

Real-time bidirectional communication:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

// Direct RPC call
ws.send(JSON.stringify({
  method: 'math.add',
  args: { a: 5, b: 3 },
  id: 'call_123'
}));

// Script execution
ws.send(JSON.stringify({
  script: `
    const result = await rpc.math.add({ a: 10, b: 20 });
    const weather = await rpc.weather.getCurrentWeather({ location: 'San Francisco' });
    console.log('Math result:', result);
    console.log('Weather:', weather);
  `,
  id: 'script_456'
}));
```

### 🎬 Script Execution

Execute complete TypeScript workflows with injected RPC client:

```typescript
// This TypeScript code runs in a sandboxed environment
// with the 'rpc' object automatically available

const team = ['charizard', 'blastoise', 'venusaur'];
const pokemonData = [];

for (const name of team) {
  const pokemon = await rpc.pokemon.fetchPokemon({ name });
  pokemonData.push(pokemon);
}

const analysis = await rpc.pokemon.analyzeTeam({ teamNames: team });
const sum = await rpc.math.add({ a: analysis.team.length, b: 10 });

console.log(`Analyzed ${team.length} Pokemon. Total with bonus: ${sum}`);
console.log('Team strengths:', analysis.strengths);
```

## HTTP Endpoints

| Endpoint | Description | Response |
|----------|-------------|----------|
| `/health` | Server status and available functions | `{ status: "ok", functions: [...] }` |
| `/client.ts` | Generated TypeScript client code | Full client with types |
| `/types` | TypeScript interfaces only | Type definitions |
| `/ws` | WebSocket endpoint | Upgrade to WebSocket |

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
async function privateFunction(args: any) { }

// ❌ Wrong - multiple parameters
export function wrongSignature(x: number, y: string) { }
```

## Examples

The project includes example RPC functions in `test-rpc/`:

- **`math.ts`**: Basic arithmetic operations
- **`pokemon.ts`**: Complex API integration with Pokemon data
- **`hello.ts`**: Simple greeting function

### Pokemon API Example

```typescript
// RPC function automatically discovered
export async function comparePokemon(args: {
  pokemon1: string;
  pokemon2: string;
}): Promise<PokemonComparison> {
  // Fetches data from PokeAPI and performs battle analysis
  // Full implementation in test-rpc/pokemon.ts
}

// Usage in script:
const battle = await rpc.pokemon.comparePokemon({
  pokemon1: 'charizard',
  pokemon2: 'blastoise'
});
console.log('Battle analysis:', battle.analysis.recommendation);
```

## Configuration

### Command Line Options

```bash
deno run --allow-all src/main.ts [options]

Required:
  --rpc-dir, -r    Directory containing RPC TypeScript files
  --port, -p       Port number for WebSocket server

Examples:
  --rpc-dir ./functions --port 8080
  --rpc-dir ~/.rpc --port 3000
  -r ./my-api -p 4000
```

### Deno Tasks

```bash
deno task start      # Start with test-rpc directory on port 8080
deno task fmt        # Format code
deno task lint       # Lint code
deno task compile    # Compile to standalone binary
```

## Technical Details

### File System Monitoring

- Watches RPC directory for `.ts` file changes
- Hot-reloads functions without server restart
- Notifies connected WebSocket clients of updates

### Type Extraction

- Uses `ts-morph` for TypeScript AST analysis
- Extracts function signatures and interface definitions
- Generates namespace-prefixed types to prevent conflicts

### Security Model

- **Script Execution**: Sandboxed in separate Deno process with limited permissions (`--allow-net`)
- **RPC Functions**: Run with full permissions (`--allow-all`) - only place trusted code in RPC directory
- **WebSocket**: No authentication - suitable for local development/trusted environments

### Performance

- **Generated Client**: Auto-disconnects after 100ms of inactivity (no active RPC calls)
- **Type Generation**: On-demand via HTTP endpoints
- **File Watching**: Debounced file system events (100ms)
- **Script Execution**: 10-second timeout, isolated processes

## Development

### Project Structure

```
src/
├── main.ts                          # Entry point
├── lib/
│   ├── get_config.ts               # CLI argument parsing
│   ├── execute_llm_script.ts       # Script execution with injected client
│   ├── rpc/
│   │   ├── websocket_server.ts     # Main WebSocket RPC server
│   │   ├── load_rpc_files.ts       # File discovery
│   │   ├── execute_rpc.ts          # Individual RPC execution
│   │   └── client.ts               # Generated client template
│   └── type_system/
│       ├── type_extractor.ts       # TypeScript AST analysis
│       ├── client_generator.ts     # Client code generation
│       ├── types.ts                # Type definitions
│       └── file_system_adapter.ts  # File system abstraction
test-rpc/                           # Example RPC functions
├── math.ts                         # Basic math operations
├── pokemon.ts                      # Complex Pokemon API integration
└── hello.ts                        # Simple greeting
```

## Troubleshooting

### Common Issues

**Functions not appearing:**
```bash
# Check function signatures follow args pattern
# Ensure functions are exported
# Verify files are in RPC directory
curl http://localhost:8080/health
```

**Type errors in generated client:**
```bash
# Re-fetch client after function changes
curl http://localhost:8080/client.ts > client.ts
```

**WebSocket connection issues:**
```bash
# Check server logs
# Verify port is not in use: lsof -i :8080
# Test with: websocat ws://localhost:8080/ws
```

**Script execution timeout:**
```javascript
// Scripts timeout after 10 seconds
// Break long operations into smaller RPC functions
// Use Promise.all() for parallel operations
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
