// Execute RPC function in separate Deno process

export const execute_rpc = async (args: {
  file: string;
  functionName: string;
  params: unknown; // Now a single object instead of array
}): Promise<{ success: boolean; data?: unknown; error?: string }> => {
  try {
    // Create a temporary script that imports and calls the function
    // With standardized args: { data: T } pattern, we just pass the params object directly
    const argsJson = JSON.stringify(args.params);

    const script = `import { ${args.functionName} } from "${args.file}";

const args = ${argsJson};
const result = await ${args.functionName}(args);
console.log(JSON.stringify({ success: true, data: result }));
`;

    const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
    await Deno.writeTextFile(tempFile, script);

    const cmd = new Deno.Command("deno", {
      args: [
        "run",
        "--allow-all", // Full permissions for trusted RPC functions
        "--no-check", // Skip type checking for remote modules only
        tempFile,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const { success, stdout, stderr } = await cmd.output();

    // Clean up temp file
    await Deno.remove(tempFile).catch(() => {});

    if (!success) {
      const errorText = new TextDecoder().decode(stderr);
      return { success: false, error: errorText };
    }

    const outputText = new TextDecoder().decode(stdout);
    try {
      const result = JSON.parse(outputText.trim());
      return result;
    } catch {
      return { success: true, data: outputText.trim() };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};
