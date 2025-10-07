#!/usr/bin/env deno run --allow-net

// Test script execution with generated client and Promise.all()
// This simulates what an LLM would generate

async function testGeneratedClientParallel() {
  console.log("🧪 Testing Generated Client with Promise.all()\n");

  const ws = new WebSocket("ws://localhost:3000/ws");

  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      resolve(void 0);
    };
    ws.onerror = () => reject(new Error("Connection failed"));
  });

  // This is what an LLM would send as a script
  const llmScript = `
// LLM-generated code using Promise.all() for parallel operations
console.log("🚀 Running parallel RPC calls with Promise.all()...");

// Test 1: Multiple parallel math operations
const results = await Promise.all([
  rpc.math.add({ a: 10, b: 20 }),
  rpc.math.multiply({ a: 5, b: 6 }),
  rpc.math.add({ a: 100, b: 200 }),
  rpc.math.multiply({ a: 7, b: 8 })
]);

console.log("Results:", results);
console.log("All parallel calls completed successfully!");

// Test 2: More complex parallel pattern
const [sum1, sum2, product] = await Promise.all([
  rpc.math.add({ a: 1, b: 2 }),
  rpc.math.add({ a: 3, b: 4 }),
  rpc.math.multiply({ a: 5, b: 6 })
]);

console.log(\`Sum1: \${sum1}, Sum2: \${sum2}, Product: \${product}\`);

console.log("✅ Generated client handles Promise.all() correctly!");
`;

  const callId = `script_${Date.now()}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Script timeout")),
      15000
    );

    const handler = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data);
        if (response.id === callId) {
          ws.removeEventListener("message", handler);
          clearTimeout(timeout);

          console.log("\n📥 Script execution response received\n");

          if (response.error) {
            console.log("❌ Script failed:");
            console.log(response.error);
            reject(new Error(response.error));
          } else {
            console.log("✅ Script output:");
            console.log(response.result);
            console.log("\n🎉 Generated client Promise.all() test PASSED!");
            ws.close();
            resolve(response);
          }
        }
      } catch (e) {
        // Ignore other messages
      }
    };

    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ script: llmScript, id: callId }));
  });
}

if (import.meta.main) {
  try {
    await testGeneratedClientParallel();
    Deno.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    Deno.exit(1);
  }
}
