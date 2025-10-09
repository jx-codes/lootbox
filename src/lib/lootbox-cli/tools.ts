import { wsUrlToHttpUrl } from "./utils.ts";

/**
 * List all available tool namespaces
 */
export async function toolsList(serverUrl: string): Promise<void> {
  const httpUrl = wsUrlToHttpUrl(serverUrl);

  try {
    const response = await fetch(`${httpUrl}/namespaces`);
    if (!response.ok) {
      console.error(`Error fetching namespaces: ${response.statusText}`);
      Deno.exit(1);
    }

    const text = await response.text();
    console.log("Available Tool Namespaces:\n");
    console.log(text);
    console.log("\nGet types for a namespace:");
    console.log("  lootbox tools types <namespace>");
    console.log("\nUsage in scripts:");
    console.log("  tools.<namespace>.<function>({ args })");
  } catch (error) {
    console.error(
      "Error connecting to server:",
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

/**
 * Show TypeScript types for specific namespaces
 */
export async function toolsTypes(
  namespaces: string,
  serverUrl: string
): Promise<void> {
  const httpUrl = wsUrlToHttpUrl(serverUrl);

  try {
    const response = await fetch(`${httpUrl}/types/${namespaces}`);
    if (!response.ok) {
      console.error(`Error fetching types: ${response.statusText}`);
      Deno.exit(1);
    }

    const types = await response.text();
    console.log(types);
  } catch (error) {
    console.error(
      "Error connecting to server:",
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

/**
 * Show LLM-focused help for tools
 */
export function showToolsLlmHelp() {
  console.log(`lootbox tools - Tool Discovery

COMMANDS:
  lootbox tools                     List available tool namespaces
  lootbox tools types <ns1,ns2>     Get TypeScript signatures for namespaces

USAGE IN SCRIPTS:
  tools.<namespace>.<function>({ arg: value })

EXAMPLES:
  lootbox tools
  lootbox tools types sqlite,fetch
  lootbox exec 'console.log(await tools.sqlite.query({ sql: "SELECT 1" }))'
`);
}
