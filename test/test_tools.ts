// Test tools API - memory is a graph-based knowledge store
const createResult = await tools.memory.createEntities({
  entities: [{
    name: "test-entity",
    type: "demo",
    properties: { message: "Hello World" },
    created_at: Date.now(),
    updated_at: Date.now()
  }]
});
console.log("Create result:", createResult);

const getEntity = await tools.memory.getEntity({ name: "test-entity" });
console.log("Got entity:", getEntity);

const stats = await tools.memory.stats();
console.log("Memory stats:", stats);
