// RPC file discovery and type generation

import { get_config } from "../get_config.ts";

export interface RpcFile {
  name: string;
  path: string;
}

export const discover_rpc_files = async (): Promise<RpcFile[]> => {
  const config = await get_config();
  const toolsDir = config.tools_dir;
  const files: RpcFile[] = [];

  try {
    const dirInfo = await Deno.stat(toolsDir).catch(() => null);
    if (!dirInfo?.isDirectory) {
      console.error(`Tools directory not found: ${toolsDir}`);
      return [];
    }

    for await (const entry of Deno.readDir(toolsDir)) {
      if (entry.isFile && entry.name.endsWith(".ts")) {
        const filePath = `${toolsDir}/${entry.name}`;
        const absolutePath = await Deno.realPath(filePath);
        const name = entry.name.replace(".ts", "");

        files.push({ name, path: absolutePath });
      }
    }

    console.error(`Found ${files.length} RPC files`);
    return files;
  } catch (err) {
    console.error(`Failed to discover RPC files:`, err);
    return [];
  }
};

export const generate_types = async (): Promise<string> => {
  const files = await discover_rpc_files();

  if (files.length === 0) {
    return "// No RPC files found";
  }

  const { TypeExtractor } = await import("../type_system/type_extractor.ts");
  const { ClientGenerator } = await import("../type_system/client_generator.ts");

  const extractor = new TypeExtractor();
  const generator = new ClientGenerator();
  const extractionResults = [];

  for (const file of files) {
    console.error(`Extracting types from: ${file.name}`);
    const result = extractor.extractFromFile(file.path);
    extractionResults.push(result);
  }

  return generator.generateTypesOnly(extractionResults);
};
