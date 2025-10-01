import { saveScriptRun } from "./script_history.ts";
import { get_client } from "./client_cache.ts";

export const execute_llm_script = async (args: { script: string; sessionId?: string }) => {
  const { script, sessionId } = args;
  const startTime = Date.now();
  console.error("🔧 execute_llm_script: Starting execution");

  // Import client via HTTP URL with version for cache busting only when RPC files change
  const { get_config } = await import("./get_config.ts");
  const config = get_config();
  const client = get_client();
  const clientUrl = `http://localhost:${config.port}/client.ts?v=${client.version}`;

  console.error(`📦 Using client from ${clientUrl} (version ${client.version})`);

  // Inject import statement at the top of the user script
  const injectedScript = `import { rpc } from "${clientUrl}";\n\n// User script begins here\n${script}`;

  const tempFile = await Deno.makeTempFile({ suffix: ".ts" });
  console.error(`📁 Created temp file: ${tempFile}`);
  await Deno.writeTextFile(tempFile, injectedScript);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const { success, stdout, stderr } = await new Deno.Command("deno", {
      args: [
        "run",
        "--allow-net", // Only allow network access for user scripts (sandboxed)
        "--allow-import=localhost:8080", // Allow importing from local RPC server
        "--no-check=remote", // Don't check remote imports
        tempFile,
      ],
      stdout: "piped",
      stderr: "piped",
      signal: controller.signal,
    }).output();

    clearTimeout(timeoutId);

    const outStr = new TextDecoder().decode(stdout);
    const errStr = new TextDecoder().decode(stderr);

    // Clean up temp file
    await Deno.remove(tempFile).catch(() => {});

    const durationMs = Date.now() - startTime;

    if (!success) {
      const error = errStr || "Script execution failed";

      // Save failed run
      await saveScriptRun({
        timestamp: startTime,
        script,
        success: false,
        error,
        output: outStr,
        durationMs,
        sessionId,
      });

      return {
        success: false,
        error,
        output: outStr,
      };
    }

    // Save successful run
    await saveScriptRun({
      timestamp: startTime,
      script,
      success: true,
      output: outStr,
      durationMs,
      sessionId,
    });

    return {
      success: true,
      output: outStr,
      warnings: errStr || undefined,
    };
  } catch (error) {
    // Clean up temp file
    await Deno.remove(tempFile).catch(() => {});

    const durationMs = Date.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      const errorMsg = "Script execution timeout (10 seconds)";

      // Save timeout run
      await saveScriptRun({
        timestamp: startTime,
        script,
        success: false,
        error: errorMsg,
        durationMs,
        sessionId,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }

    const errorMsg = error instanceof Error ? error.message : String(error);

    // Save error run
    await saveScriptRun({
      timestamp: startTime,
      script,
      success: false,
      error: errorMsg,
      durationMs,
      sessionId,
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
};
