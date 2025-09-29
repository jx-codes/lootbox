export const execute_llm_script = async (script: string) => {
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
    return {
      success: false,
      error: `Failed to fetch client code: ${clientResponse.status}`,
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

    if (!success) {
      return {
        success: false,
        error: errStr || "Script execution failed",
        output: outStr,
      };
    }

    return {
      success: true,
      output: outStr,
      warnings: errStr || undefined,
    };
  } catch (error) {
    // Clean up temp file
    await Deno.remove(tempFile).catch(() => {});

    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Script execution timeout (10 seconds)",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
