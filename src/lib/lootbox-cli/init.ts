export async function init(): Promise<void> {
  const lootboxDir = ".lootbox";
  const configFile = "lootbox.config.json";

  // Check for existing files/directories
  const conflicts: string[] = [];

  try {
    await Deno.stat(lootboxDir);
    conflicts.push(lootboxDir);
  } catch {
    // Doesn't exist, good
  }

  try {
    await Deno.stat(configFile);
    conflicts.push(configFile);
  } catch {
    // Doesn't exist, good
  }

  if (conflicts.length > 0) {
    console.error("Error: The following files/directories already exist:");
    conflicts.forEach((c) => console.error(`  - ${c}`));
    console.error("\nPlease remove them or run init in a different directory.");
    Deno.exit(1);
  }

  // Create directory structure
  await Deno.mkdir(`${lootboxDir}/tools`, { recursive: true });
  await Deno.mkdir(`${lootboxDir}/workflows`, { recursive: true });
  await Deno.mkdir(`${lootboxDir}/scripts`, { recursive: true });

  // Create config file with defaults
  const defaultConfig = {
    port: 8080,
    lootboxRoot: ".lootbox",
  };

  await Deno.writeTextFile(
    configFile,
    JSON.stringify(defaultConfig, null, 2) + "\n"
  );

  // Success message
  console.log("✓ Created .lootbox/");
  console.log("✓ Created .lootbox/tools/");
  console.log("✓ Created .lootbox/workflows/");
  console.log("✓ Created .lootbox/scripts/");
  console.log("✓ Created lootbox.config.json");
  console.log("\nReady! Start server: lootbox server");
}
