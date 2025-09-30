import { saveScriptRun } from "./script_history.ts";

export const execute_llm_script = async (script: string) => {
  const startTime = Date.now();
  console.error("🔧 execute_llm_script: Starting execution");

  // Fetch the generated client and inject it into the script - need to get current server port
  const { get_config } = await import("./get_config.ts");
  const config = get_config();
  const clientUrl = `http://localhost:${config.port}/client.ts`;

  console.error(`📥 Fetching client code from ${clientUrl}...`);
  const clientResponse = await fetch(clientUrl);

  if (!clientResponse.ok) {
    console.error(
      `❌ Failed to fetch client: ${clientResponse.status} ${clientResponse.statusText}`
    );
    const error = `Failed to fetch client code: ${clientResponse.status}`;

    // Save failed run (client fetch failure)
    await saveScriptRun({
      timestamp: startTime,
      script,
      success: false,
      error,
      durationMs: Date.now() - startTime,
    });

    return {
      success: false,
      error,
    };
  }

  const clientCode = await clientResponse.text();
  console.error(`✅ Client code fetched: ${clientCode.length} chars`);

  // Inject client at the top of the user script
  const injectedScript = `${clientCode}\n\n// User script begins here\n${script}`;

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
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
};
