// Path utilities for lootbox directories

import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { BUILTIN_TOOLS } from "./builtin_tools.ts";

/**
 * Get the user's home directory
 */
function getHomeDir(): string {
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!home) {
    throw new Error("Could not determine home directory");
  }
  return home;
}

/**
 * Get the global lootbox tools directory (~/.lootbox/tools)
 */
export function getUserLootboxToolsDir(): string {
  return join(getHomeDir(), ".lootbox", "tools");
}

/**
 * Ensure ~/.lootbox/tools exists with built-in tools
 * This is called automatically on server startup
 */
export async function ensureBuiltinTools(): Promise<void> {
  const toolsDir = getUserLootboxToolsDir();
  await ensureDir(toolsDir);

  // Write each built-in tool if it doesn't exist
  for (const [filename, content] of Object.entries(BUILTIN_TOOLS)) {
    const toolPath = join(toolsDir, filename);

    try {
      await Deno.stat(toolPath);
      // File exists, skip
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        // File doesn't exist, create it
        await Deno.writeTextFile(toolPath, content);
        console.error(`Created built-in tool: ${toolPath}`);
      } else {
        throw error;
      }
    }
  }
}
