#!/usr/bin/env deno run --allow-net

// Simple script execution test

async function testSimpleScript() {
  console.log("🧪 Testing Simple Script Execution");

  const ws = new WebSocket("ws://localhost:9002/ws");

  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      resolve(void 0);
    };
    ws.onerror = () => reject(new Error("WebSocket connection failed"));
  });

  const callId = `simple_${Date.now()}`;

  // Very simple script that just logs a message
  const simpleScript = `console.log("Hello from executed script!");`;

  const message = {
    script: simpleScript,
    id: callId
  };

  console.log("📤 Sending simple script:", simpleScript);
  console.log("🆔 Message ID:", callId);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Script execution timeout"));
    }, 15000); // 15 second timeout

    const handler = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data);
        console.log("📥 Received response:", response);

        if (response.id === callId) {
          ws.removeEventListener('message', handler);
          clearTimeout(timeout);

          if (response.error) {
            console.log("❌ Script execution failed:", response.error);
          } else {
            console.log("✅ Script execution successful!");
            console.log("📄 Output:", response.result);
          }

          ws.close();
          resolve(response);
        }
      } catch (e) {
        console.log("🔍 Non-JSON message:", event.data);
      }
    };

    ws.addEventListener('message', handler);
    ws.send(JSON.stringify(message));
  });
}

if (import.meta.main) {
  try {
    await testSimpleScript();
    console.log("🏁 Simple test completed!");
  } catch (error) {
    console.error("❌ Simple test failed:", error);
  }
}