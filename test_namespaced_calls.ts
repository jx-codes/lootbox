#!/usr/bin/env deno run --allow-net

// Quick test of namespaced RPC calls

async function testNamespacedCalls() {
  console.log("🧪 Testing Namespaced RPC Calls\n");

  const ws = new WebSocket("ws://localhost:9002/ws");

  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      resolve(void 0);
    };
    ws.onerror = () => reject(new Error("WebSocket connection failed"));
  });

  // Test math.add
  console.log("🔢 Testing math.add(10, 5)...");
  const mathResult = await callRpc(ws, "math.add", { a: 10, b: 5 });
  console.log(`Result: ${mathResult}\n`);

  // Test pokemon.fetchPokemon
  console.log("🎮 Testing pokemon.fetchPokemon('pikachu')...");
  const pokemonResult = await callRpc(ws, "pokemon.fetchPokemon", { name: "pikachu" });
  console.log(`Result: ${pokemonResult.name} (ID: ${pokemonResult.id})\n`);

  // Test hello.hello
  console.log("👋 Testing hello.hello('World')...");
  const helloResult = await callRpc(ws, "hello.hello", { value: "World" });
  console.log(`Result: ${helloResult}\n`);

  ws.close();
  console.log("✅ All namespaced calls working correctly!");
}

async function callRpc(ws: WebSocket, method: string, args: unknown): Promise<any> {
  const id = `test_${Date.now()}_${Math.random()}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 10000);

    const handler = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          ws.removeEventListener('message', handler);
          clearTimeout(timeout);

          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.result);
          }
        }
      } catch (e) {
        // Ignore other messages
      }
    };

    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ method, args, id }));
  });
}

if (import.meta.main) {
  try {
    await testNamespacedCalls();
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}