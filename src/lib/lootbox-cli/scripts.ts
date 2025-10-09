import { get_config } from "../get_config.ts";
import { dirname } from "https://deno.land/std@0.208.0/path/mod.ts";

interface ScriptMetadata {
  filename: string;
  path: string;
  description?: string;
  examples: string[];
}

/**
 * Parse JSDoc comment block from script file
 */
function parseJSDoc(content: string): { description?: string; examples: string[] } {
  const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (!jsdocMatch) {
    return { examples: [] };
  }

  const jsdoc = jsdocMatch[0];
  const lines = jsdoc.split('\n').map(line =>
    line.replace(/^\s*\*+\/?\s?/, '').trim()
  ).filter(line => line && !line.startsWith('/**') && !line.startsWith('*/'));

  let description: string | undefined;
  const examples: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('@example')) {
      // Extract example text after @example
      const exampleText = line.substring('@example'.length).trim();
      if (exampleText) {
        examples.push(exampleText);
      }
      // Check if example continues on next lines (multi-line example)
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('@')) {
        examples[examples.length - 1] += '\n' + lines[j];
        j++;
      }
      i = j - 1;
    } else if (!line.startsWith('@') && !description) {
      // First non-tag line is the description
      description = line;
    }
  }

  return { description, examples };
}

/**
 * Discover scripts in a directory
 */
async function discoverScriptsInDir(dir: string): Promise<ScriptMetadata[]> {
  const scripts: ScriptMetadata[] = [];

  try {
    const dirInfo = await Deno.stat(dir).catch(() => null);
    if (!dirInfo?.isDirectory) return scripts;

    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith('.ts')) {
        const filePath = `${dir}/${entry.name}`;
        try {
          const content = await Deno.readTextFile(filePath);
          const { description, examples } = parseJSDoc(content);

          scripts.push({
            filename: entry.name,
            path: filePath,
            description,
            examples,
          });
        } catch (err) {
          console.error(`Failed to read ${filePath}:`, err);
        }
      } else if (entry.isDirectory) {
        // Recursively scan subdirectories
        const subScripts = await discoverScriptsInDir(`${dir}/${entry.name}`);
        scripts.push(...subScripts.map(s => ({
          ...s,
          filename: `${entry.name}/${s.filename}`,
        })));
      }
    }
  } catch (err) {
    console.error(`Failed to discover scripts in ${dir}:`, err);
  }

  return scripts;
}

/**
 * List all available scripts
 */
export async function scriptsList(): Promise<void> {
  const config = await get_config();
  const scripts = await discoverScriptsInDir(config.scripts_dir);

  if (scripts.length === 0) {
    console.log("No scripts found.");
    console.log(`\nCreate a script with: lootbox scripts init <filename>`);
    return;
  }

  console.log("Available Scripts:\n");

  for (const script of scripts) {
    console.log(`  ${script.filename}`);
    if (script.description) {
      console.log(`    ${script.description}`);
    }
    if (script.examples.length > 0) {
      for (const example of script.examples) {
        const exampleLines = example.split('\n');
        exampleLines.forEach((line, idx) => {
          if (idx === 0) {
            console.log(`    Example: ${line}`);
          } else {
            console.log(`             ${line}`);
          }
        });
      }
    }
    console.log();
  }
}

/**
 * Initialize a new script from template
 */
export async function scriptsInit(filename: string): Promise<void> {
  const config = await get_config();

  // Auto-add .ts extension if not present
  const scriptName = filename.endsWith('.ts') ? filename : `${filename}.ts`;
  const scriptPath = `${config.scripts_dir}/${scriptName}`;

  // Check if file already exists
  try {
    await Deno.stat(scriptPath);
    console.error(`Error: Script '${scriptName}' already exists at ${scriptPath}`);
    Deno.exit(1);
  } catch {
    // File doesn't exist, good to proceed
  }

  const template = `/**
 * [Description]
 * @example lootbox ${scriptName}
 */

// Your script code here
`;

  // Create parent directories if they don't exist
  const parentDir = dirname(scriptPath);
  await Deno.mkdir(parentDir, { recursive: true });

  await Deno.writeTextFile(scriptPath, template);
  console.log(`✓ Created ${scriptPath}`);
  console.log(`\nEdit the script and run with: lootbox ${scriptName}`);
}
