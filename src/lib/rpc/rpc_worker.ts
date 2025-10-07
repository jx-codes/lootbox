// RPC Worker - Long-running process that executes RPC functions
// One worker per RPC file, communicates with main server via WebSocket

interface CallMessage {
  type: "call";
  id: string;
  functionName: string;
  args: unknown;
}

interface ShutdownMessage {
  type: "shutdown";
}

type WorkerMessage = CallMessage | ShutdownMessage;

async function main() {
  // Parse CLI arguments
  const rpcFilePath = Deno.args[0];
  const workerWsUrl = Deno.args[1];
  const namespace = Deno.args[2];

  if (!rpcFilePath || !workerWsUrl || !namespace) {
    console.error("Usage: rpc_worker.ts <rpcFilePath> <workerWsUrl> <namespace>");
    Deno.exit(1);
  }

  // Import all functions from RPC file
  const functions = await import(rpcFilePath);

  // Connect to main server
  const ws = new WebSocket(workerWsUrl);

  ws.onopen = () => {
    // Identify ourselves
    ws.send(JSON.stringify({
      type: "identify",
      workerId: namespace,
    }));

    // Signal ready
    ws.send(JSON.stringify({
      type: "ready",
      workerId: namespace,
    }));
  };

  ws.onmessage = async (event) => {
    try {
      const msg: WorkerMessage = JSON.parse(
        typeof event.data === "string"
          ? event.data
          : new TextDecoder().decode(new Uint8Array(event.data as ArrayBuffer))
      );

      if (msg.type === "call") {
        const { id, functionName, args } = msg;

        try {
          // Get the function
          const fn = functions[functionName];

          if (typeof fn !== "function") {
            throw new Error(`Function '${functionName}' not found or not exported`);
          }

          // Execute with timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Function execution timeout (30s)")), 30000);
          });

          const result = await Promise.race([
            fn(args),
            timeoutPromise,
          ]);

          // Send result back
          ws.send(JSON.stringify({
            type: "result",
            id,
            data: result,
          }));
        } catch (error) {
          // Send error back
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      } else if (msg.type === "shutdown") {
        console.error(`[Worker ${namespace}] Received shutdown signal`);
        ws.close();
        Deno.exit(0);
      }
    } catch (error) {
      console.error(`[Worker ${namespace}] Error handling message:`, error);
    }
  };

  ws.onerror = (error) => {
    // Suppress "Unexpected EOF" errors on shutdown
    const errorEvent = error as ErrorEvent;
    if (!errorEvent.message?.includes("Unexpected EOF")) {
      console.error(`[Worker ${namespace}] WebSocket error:`, error);
    }
  };

  ws.onclose = () => {
    // Silent exit on close
    Deno.exit(0);
  };

  // Handle uncaught errors
  globalThis.addEventListener("error", (event) => {
    console.error(`[Worker ${namespace}] Uncaught error:`, event.error);

    try {
      ws.send(JSON.stringify({
        type: "crash",
        error: event.error?.message || String(event.error),
      }));
    } catch {
      // Best effort
    }

    ws.close();
    Deno.exit(1);
  });

  // Handle unhandled promise rejections
  globalThis.addEventListener("unhandledrejection", (event) => {
    console.error(`[Worker ${namespace}] Unhandled rejection:`, event.reason);

    try {
      ws.send(JSON.stringify({
        type: "crash",
        error: event.reason?.message || String(event.reason),
      }));
    } catch {
      // Best effort
    }

    ws.close();
    Deno.exit(1);
  });
}

main();
