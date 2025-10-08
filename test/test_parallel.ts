// Test parallel execution
console.log("Starting parallel operations...");

const [stats, types, relationTypes] = await Promise.all([
  tools.memory.stats(),
  tools.memory.listTypes(),
  tools.memory.listRelationTypes()
]);

console.log("\nMemory Stats:", stats);
console.log("\nEntity Types:", types);
console.log("\nRelation Types:", relationTypes);
