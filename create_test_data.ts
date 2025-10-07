#!/usr/bin/env deno run --allow-net

const ws = new WebSocket("ws://localhost:3000/ws");
await new Promise((r) => (ws.onopen = r));

const rpc = (method: string, args: any) => {
  const id = String(Date.now() + Math.random());
  return new Promise((resolve) => {
    ws.addEventListener("message", function handler(e) {
      const res = JSON.parse(e.data);
      if (res.id === id) {
        ws.removeEventListener("message", handler);
        resolve(res.result);
      }
    });
    ws.send(JSON.stringify({ method, args, id }));
  });
};

console.log("Creating test data...\n");

await rpc("filedb.createTable", { tableName: "products" });
await rpc("filedb.insert", {
  tableName: "products",
  records: [
    { id: 1, name: "Laptop", price: 999, inStock: true },
    { id: 2, name: "Mouse", price: 29, inStock: true },
    { id: 3, name: "Keyboard", price: 79, inStock: false },
  ],
});
console.log("✅ Created products table");

await rpc("filedb.createTable", { tableName: "orders" });
await rpc("filedb.insert", {
  tableName: "orders",
  records: [
    { orderId: 1001, productId: 1, quantity: 2, customer: "Alice" },
    { orderId: 1002, productId: 2, quantity: 5, customer: "Bob" },
  ],
});
console.log("✅ Created orders table");

await rpc("filedb.createTable", { tableName: "customers" });
await rpc("filedb.insert", {
  tableName: "customers",
  records: [
    { id: 1, name: "Alice", email: "alice@example.com", vip: true },
    { id: 2, name: "Bob", email: "bob@example.com", vip: false },
    { id: 3, name: "Charlie", email: "charlie@example.com", vip: true },
  ],
});
console.log("✅ Created customers table");

console.log("\n📁 Files created in filedb_data/");
console.log("Run: ls -la filedb_data/ && cat filedb_data/products.json");

ws.close();
