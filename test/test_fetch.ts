// Test fetch API
const response = await fetch("https://api.github.com/repos/jx-codes/lootbox");
const data = await response.json();

console.log("Repository:", data.name);
console.log("Description:", data.description);
console.log("Stars:", data.stargazers_count);
console.log("Language:", data.language);
