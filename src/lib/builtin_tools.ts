// Built-in tools that are embedded at compile time
// These files are read during compilation and bundled into the binary

const TOOLS_DIR = ".lootbox/tools";

// Read tool files at compile time - these become string literals in the compiled binary
export const BUILTIN_TOOLS: Record<string, string> = {
  "fs.ts": Deno.readTextFileSync(`${TOOLS_DIR}/fs.ts`),
  "kv.ts": Deno.readTextFileSync(`${TOOLS_DIR}/kv.ts`),
  "sqlite.ts": Deno.readTextFileSync(`${TOOLS_DIR}/sqlite.ts`),
  "memory.ts": Deno.readTextFileSync(`${TOOLS_DIR}/memory.ts`),
};
