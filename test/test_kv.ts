// Test key-value store
await tools.kv.set({ key: "greeting", value: "Hello from lootbox!" });
console.log("Value set");

const value = await tools.kv.get({ key: "greeting" });
console.log("Got value:", value);

const keys = await tools.kv.list({ prefix: "greet" });
console.log("Keys with prefix 'greet':", keys);
