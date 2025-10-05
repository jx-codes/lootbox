import type { Config } from "./types.ts";

export async function loadConfig(): Promise<Config> {
  try {
    const configText = await Deno.readTextFile("lootbox.config.json");
    return JSON.parse(configText);
  } catch {
    return {};
  }
}
