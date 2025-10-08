#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Version bumping script for deno.json
 * Usage: deno run --allow-read --allow-write scripts/bump-version.ts [major|minor|patch]
 */

async function bumpVersion(type: "major" | "minor" | "patch"): Promise<string> {
  const denoConfigPath = new URL("../deno.json", import.meta.url).pathname;
  const denoConfig = JSON.parse(await Deno.readTextFile(denoConfigPath));

  const currentVersion = denoConfig.version;
  if (!currentVersion) {
    throw new Error("No version found in deno.json");
  }

  const [major, minor, patch] = currentVersion.split(".").map(Number);

  let newVersion: string;
  switch (type) {
    case "major":
      newVersion = `${major + 1}.0.0`;
      break;
    case "minor":
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case "patch":
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  denoConfig.version = newVersion;

  // Write back with nice formatting
  await Deno.writeTextFile(
    denoConfigPath,
    JSON.stringify(denoConfig, null, 2) + "\n"
  );

  return newVersion;
}

if (import.meta.main) {
  const type = Deno.args[0] as "major" | "minor" | "patch" | undefined;

  if (!type || !["major", "minor", "patch"].includes(type)) {
    console.error("Usage: bump-version.ts [major|minor|patch]");
    Deno.exit(1);
  }

  const newVersion = await bumpVersion(type);
  console.log(`Version bumped to ${newVersion}`);
}
