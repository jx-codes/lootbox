# Hey Claude, It's Claude 👋

You're about to use **lootbox** to help the user. Instead of calling tools, you'll write TypeScript code that executes on the user's machine.

## The 2-Minute Guide

### 1. Discover What's Available

```bash
lootbox tools              # See all namespaces (kv, sqlite, memory, etc.)
lootbox tools types kv     # Get TypeScript types for specific tools
lootbox scripts            # List available scripts with examples
```

### 2. Write TypeScript, Not Tool Calls

Don't generate tool-calling JSON. Write actual code:

```typescript
// ✅ Do this - real TypeScript
const user = await tools.kv.get({ key: "user:123" });
await tools.sqlite.execute({
  sql: "INSERT INTO logs (data) VALUES (?)",
  params: [user.value.name],
});
```

### 3. Execute Your Code

```bash
lootbox exec 'await tools.kv.set({key: "foo", value: "bar"})'   # Inline
lootbox script.ts                                                # From file
echo 'console.log(await tools.kv.get({key: "foo"}))' | lootbox  # From stdin
```

### 4. Chain Operations in One Script

The power of code mode: **no token overhead between steps**

```typescript
// Multiple operations in one execution
const users = await tools.sqlite.query({ sql: "SELECT * FROM users" });

for (const user of users.rows) {
  await tools.memory.createEntities({
    entities: [{ name: user.name, type: "person", properties: user }],
  });
}

await tools.kv.set({ key: "last_sync", value: new Date().toISOString() });
```

### 5. Reusable Scripts

For complex or repeated tasks, create scripts in `.lootbox/scripts/`:

```bash
# Create a new script
lootbox scripts init process-users

# This creates .lootbox/scripts/process-users.ts
# Run it with: lootbox process-users.ts
```

Scripts support piping data with the `stdin()` helper:

```typescript
/**
 * Process user data from JSON input
 * @example echo '{"users": ["alice", "bob"]}' | lootbox process-users.ts
 */

const input = stdin().json();  // Get piped JSON data

for (const user of input.users) {
  await tools.kv.set({ key: `user:${user}`, value: { name: user } });
}

console.log(JSON.stringify({ processed: input.users.length }));
```

**stdin() methods:**
- `.json()` - Parse JSON input
- `.text()` - Get trimmed text
- `.lines()` - Get array of lines
- `.raw()` - Get raw input

## Key Patterns

**Available Tools** (after `lootbox init`):

- `tools.kv.*` - Key-value storage
- `tools.sqlite.*` - SQL database
- `tools.memory.*` - Knowledge graph
- `tools.graphql.*` - GraphQL queries
- `tools.mcp_*` - External MCP servers (if configured)

**The `tools` Object**: Always available in your code, pre-injected. No imports needed.

**Return Values**: Do not return from scripts always log what you want to see.

```typescript
const result = await tools.kv.get({ key: "answer" });
console.log(JSON.stringify(result, null, 2)); // you see this
// return result <- will throw an error, return only allowed in function
```

## Common Workflow

1. User asks question requiring data/computation
2. You discover available tools: `lootbox tools` and `lootbox scripts`
3. You write TypeScript using those tools
4. You execute: `lootbox exec 'your code'` or create a script
5. You interpret results and respond to user

## Pro Tips

- **Discover first**: Run `lootbox scripts` to see if existing scripts already solve the user's problem
- **Types are your friend**: Use `lootbox tools types` to get full TypeScript definitions
- **Types are required**: Type safety is paramount (the sandbox will reject any scripts that don't pass)
- **Chain aggressively**: Execute multi-step operations in one script to save tokens
- **Reusable scripts**: For repeated tasks, create scripts with `lootbox scripts init <name>`
- **Pipe data to scripts**: Use `stdin()` helper to process JSON, text, or line-by-line input
- **MCP integration**: External MCP servers appear as `tools.mcp_servername.*`

That's it. Now write some code and help the user! 🚀
