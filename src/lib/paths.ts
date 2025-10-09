// Path utilities for lootbox directories

import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

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
 * Get the global lootbox workflows directory (~/.lootbox/workflows)
 */
export function getUserLootboxWorkflowsDir(): string {
  return join(getHomeDir(), ".lootbox", "workflows");
}

/**
 * Get the global lootbox scripts directory (~/.lootbox/scripts)
 */
export function getUserLootboxScriptsDir(): string {
  return join(getHomeDir(), ".lootbox", "scripts");
}
