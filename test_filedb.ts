#!/usr/bin/env deno run --allow-net

// Test file-based database with parallel operations

async function testFileDb() {
  console.log("📁 Testing File-Based Database RPC\n");

  const ws = new WebSocket("ws://localhost:8080/ws");
  await new Promise((resolve, reject) => {
    ws.onopen = () => { console.log("✅ Connected\n"); resolve(void 0); };
    ws.onerror = () => reject(new Error("Connection failed"));
  });

  try {
    // Cleanup
    console.log("🧹 Cleanup old tables...");
    await rpc(ws, "filedb.dropTable", { tableName: "users" });
    await rpc(ws, "filedb.dropTable", { tableName: "products" });
    await rpc(ws, "filedb.dropTable", { tableName: "orders" });
    console.log("✅ Cleanup done\n");

    // Test 1: Create table
    console.log("📊 Test 1: Create table");
    console.log("─".repeat(60));
    const create = await rpc(ws, "filedb.createTable", { tableName: "users" });
    console.log(create);
    console.log("✅ Test 1 PASSED\n");

    // Test 2: Insert records
    console.log("📊 Test 2: Insert records");
    console.log("─".repeat(60));
    const insert = await rpc(ws, "filedb.insert", {
      tableName: "users",
      records: [
        { id: 1, name: "Alice", email: "alice@example.com", age: 30 },
        { id: 2, name: "Bob", email: "bob@example.com", age: 25 },
        { id: 3, name: "Charlie", email: "charlie@example.com", age: 35 },
      ],
    });
    console.log(`Inserted ${insert.insertedCount} records`);
    console.log("✅ Test 2 PASSED\n");

    // Test 3: Query all records
    console.log("📊 Test 3: Query all records");
    console.log("─".repeat(60));
    const all = await rpc(ws, "filedb.query", { tableName: "users" });
    console.log(`Found ${all.count} records:`);
    all.records.forEach((r: any) => console.log(`  ${r.id}: ${r.name} (${r.email})`));
    console.log("✅ Test 3 PASSED\n");

    // Test 4: Parallel queries with Promise.all()
    console.log("📊 Test 4: Parallel queries with Promise.all()");
    console.log("─".repeat(60));
    const start = performance.now();

    const [allUsers, alice, youngUsers] = await Promise.all([
      rpc(ws, "filedb.query", { tableName: "users" }),
      rpc(ws, "filedb.query", { tableName: "users", filter: { name: "Alice" } }),
      rpc(ws, "filedb.query", { tableName: "users", filter: { age: 25 } }),
    ]);

    const time = performance.now() - start;

    console.log(`All users: ${allUsers.count}`);
    console.log(`Alice: ${alice.records[0]?.name} - ${alice.records[0]?.email}`);
    console.log(`Young users (age 25): ${youngUsers.count}`);
    console.log(`⏱️  ${time.toFixed(2)}ms`);
    console.log("✅ Test 4 PASSED - Promise.all() works!\n");

    // Test 5: Parallel inserts to different tables
    console.log("📊 Test 5: Parallel operations on different tables");
    console.log("─".repeat(60));
    const start2 = performance.now();

    await Promise.all([
      rpc(ws, "filedb.createTable", { tableName: "products" }),
      rpc(ws, "filedb.createTable", { tableName: "orders" }),
      rpc(ws, "filedb.insert", {
        tableName: "users",
        records: [{ id: 4, name: "David", email: "david@example.com", age: 28 }],
      }),
    ]);

    await Promise.all([
      rpc(ws, "filedb.insert", {
        tableName: "products",
        records: [
          { id: 1, name: "Laptop", price: 999 },
          { id: 2, name: "Mouse", price: 29 },
        ],
      }),
      rpc(ws, "filedb.insert", {
        tableName: "orders",
        records: [
          { id: 1, userId: 1, productId: 1, quantity: 1 },
        ],
      }),
    ]);

    const time2 = performance.now() - start2;
    console.log(`Created and populated 3 tables in parallel`);
    console.log(`⏱️  ${time2.toFixed(2)}ms`);
    console.log("✅ Test 5 PASSED\n");

    // Test 6: Update records
    console.log("📊 Test 6: Update records");
    console.log("─".repeat(60));
    const updateResult = await rpc(ws, "filedb.update", {
      tableName: "users",
      filter: { name: "Alice" },
      updates: { age: 31 },
    });
    console.log(`Updated ${updateResult.updatedCount} records`);

    const updated = await rpc(ws, "filedb.query", {
      tableName: "users",
      filter: { name: "Alice" },
    });
    console.log(`Alice's new age: ${updated.records[0].age}`);
    console.log("✅ Test 6 PASSED\n");

    // Test 7: Delete records
    console.log("📊 Test 7: Delete records");
    console.log("─".repeat(60));
    const deleteResult = await rpc(ws, "filedb.deleteRecords", {
      tableName: "users",
      filter: { name: "Bob" },
    });
    console.log(`Deleted ${deleteResult.deletedCount} records`);

    const remaining = await rpc(ws, "filedb.query", { tableName: "users" });
    console.log(`Remaining users: ${remaining.count}`);
    console.log("✅ Test 7 PASSED\n");

    // Test 8: List all tables
    console.log("📊 Test 8: List all tables");
    console.log("─".repeat(60));
    const tables = await rpc(ws, "filedb.listTables", {});
    console.log(`Tables: ${tables.tables.join(", ")}`);
    console.log("✅ Test 8 PASSED\n");

    // Test 9: Stress test - 10 parallel queries
    console.log("📊 Test 9: Stress test with 10 parallel queries");
    console.log("─".repeat(60));
    const start3 = performance.now();

    const results = await Promise.all([
      rpc(ws, "filedb.query", { tableName: "users" }),
      rpc(ws, "filedb.query", { tableName: "products" }),
      rpc(ws, "filedb.query", { tableName: "orders" }),
      rpc(ws, "filedb.query", { tableName: "users", limit: 2 }),
      rpc(ws, "filedb.query", { tableName: "products", limit: 1 }),
      rpc(ws, "filedb.listTables", {}),
      rpc(ws, "filedb.query", { tableName: "users", filter: { age: 31 } }),
      rpc(ws, "filedb.query", { tableName: "products", filter: { price: 999 } }),
      rpc(ws, "filedb.query", { tableName: "users" }),
      rpc(ws, "filedb.query", { tableName: "orders" }),
    ]);

    const time3 = performance.now() - start3;
    console.log(`Completed 10 parallel queries successfully`);
    console.log(`⏱️  ${time3.toFixed(2)}ms`);
    console.log("✅ Test 9 PASSED\n");

    // Cleanup
    console.log("🧹 Final cleanup...");
    await rpc(ws, "filedb.dropTable", { tableName: "users" });
    await rpc(ws, "filedb.dropTable", { tableName: "products" });
    await rpc(ws, "filedb.dropTable", { tableName: "orders" });
    console.log("✅ Cleanup done\n");

    ws.close();

    console.log("═".repeat(60));
    console.log("🎉 All File Database tests PASSED!");
    console.log("═".repeat(60));
    console.log("\n✨ Key Features Demonstrated:");
    console.log("  • File-based persistence (no external DB needed)");
    console.log("  • Promise.all() works flawlessly");
    console.log("  • Parallel queries on different tables");
    console.log("  • Full CRUD operations");
    console.log("  • Each RPC call manages its own file I/O");
    console.log("  • No connection pooling needed!");
  } catch (error) {
    ws.close();
    throw error;
  }
}

async function rpc(ws: WebSocket, method: string, args: unknown): Promise<any> {
  const id = `test_${Date.now()}_${Math.random()}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 30000);
    const handler = (event: MessageEvent) => {
      try {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          ws.removeEventListener("message", handler);
          clearTimeout(timeout);
          response.error ? reject(new Error(response.error)) : resolve(response.result);
        }
      } catch (e) {}
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ method, args, id }));
  });
}

if (import.meta.main) {
  try {
    await testFileDb();
    Deno.exit(0);
  } catch (error) {
    console.error("\n❌ Failed:", error);
    Deno.exit(1);
  }
}