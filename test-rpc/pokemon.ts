// Pokemon API RPC functions - demonstrating network access and data transformation

interface PokemonBasicInfo {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
    total: number;
  };
  abilities: string[];
  sprites: {
    front_default: string;
    front_shiny: string;
  };
}

interface PokemonComparison {
  pokemon1: PokemonBasicInfo;
  pokemon2: PokemonBasicInfo;
  analysis: {
    strongerIn: {
      pokemon1: string[];
      pokemon2: string[];
    };
    typeAdvantages: {
      pokemon1VsPokemon2: string;
      pokemon2VsPokemon1: string;
    };
    recommendation: string;
  };
}

interface TeamAnalysis {
  team: PokemonBasicInfo[];
  strengths: string[];
  weaknesses: string[];
  coverage: {
    offensiveTypes: string[];
    defensiveGaps: string[];
  };
  recommendation: string;
}

// Type effectiveness chart (simplified)
const TYPE_CHART: Record<string, { strong: string[], weak: string[] }> = {
  fire: { strong: ['grass', 'ice', 'bug', 'steel'], weak: ['water', 'ground', 'rock'] },
  water: { strong: ['fire', 'ground', 'rock'], weak: ['grass', 'electric'] },
  grass: { strong: ['water', 'ground', 'rock'], weak: ['fire', 'ice', 'poison', 'flying', 'bug'] },
  electric: { strong: ['water', 'flying'], weak: ['ground'] },
  psychic: { strong: ['fighting', 'poison'], weak: ['bug', 'ghost', 'dark'] },
  ice: { strong: ['grass', 'ground', 'flying', 'dragon'], weak: ['fire', 'fighting', 'rock', 'steel'] },
  dragon: { strong: ['dragon'], weak: ['ice', 'dragon', 'fairy'] },
  dark: { strong: ['psychic', 'ghost'], weak: ['fighting', 'bug', 'fairy'] },
  fighting: { strong: ['normal', 'ice', 'rock', 'dark', 'steel'], weak: ['flying', 'psychic', 'fairy'] },
  poison: { strong: ['grass', 'fairy'], weak: ['ground', 'psychic'] },
  ground: { strong: ['fire', 'electric', 'poison', 'rock', 'steel'], weak: ['water', 'grass', 'ice'] },
  flying: { strong: ['grass', 'fighting', 'bug'], weak: ['electric', 'ice', 'rock'] },
  bug: { strong: ['grass', 'psychic', 'dark'], weak: ['fire', 'flying', 'rock'] },
  rock: { strong: ['fire', 'ice', 'flying', 'bug'], weak: ['water', 'grass', 'fighting', 'ground', 'steel'] },
  ghost: { strong: ['psychic', 'ghost'], weak: ['ghost', 'dark'] },
  steel: { strong: ['ice', 'rock', 'fairy'], weak: ['fire', 'fighting', 'ground'] },
  fairy: { strong: ['fighting', 'dragon', 'dark'], weak: ['poison', 'steel'] },
  normal: { strong: [], weak: ['fighting'] }
};

/**
 * Fetch basic Pokemon data from the PokeAPI
 * @param args Contains the Pokemon name to fetch
 * @returns Complete Pokemon information including stats, types, abilities, and sprites
 * @example fetchPokemon({ name: "pikachu" })
 */
export async function fetchPokemon(args: { name: string }): Promise<PokemonBasicInfo> {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${args.name.toLowerCase()}`);

  if (!response.ok) {
    throw new Error(`Pokemon '${args.name}' not found`);
  }

  const data = await response.json();

  const stats = {
    hp: data.stats[0].base_stat,
    attack: data.stats[1].base_stat,
    defense: data.stats[2].base_stat,
    specialAttack: data.stats[3].base_stat,
    specialDefense: data.stats[4].base_stat,
    speed: data.stats[5].base_stat,
    total: data.stats.reduce((sum: number, stat: any) => sum + stat.base_stat, 0)
  };

  return {
    id: data.id,
    name: data.name,
    height: data.height,
    weight: data.weight,
    types: data.types.map((t: any) => t.type.name),
    stats,
    abilities: data.abilities.map((a: any) => a.ability.name),
    sprites: {
      front_default: data.sprites.front_default,
      front_shiny: data.sprites.front_shiny
    }
  };
}

/**
 * Compare two Pokemon with detailed battle analysis
 * Analyzes stats, type advantages, and provides battle recommendations
 * @param args Contains names of two Pokemon to compare
 * @returns Detailed comparison with strengths, weaknesses, and battle recommendation
 */
export async function comparePokemon(args: { pokemon1: string; pokemon2: string }): Promise<PokemonComparison> {
  // Fetch both Pokemon data
  const [p1, p2] = await Promise.all([
    fetchPokemon({ name: args.pokemon1 }),
    fetchPokemon({ name: args.pokemon2 })
  ]);

  // Analyze stats
  const p1Stronger = [];
  const p2Stronger = [];

  if (p1.stats.hp > p2.stats.hp) p1Stronger.push('HP');
  else if (p2.stats.hp > p1.stats.hp) p2Stronger.push('HP');

  if (p1.stats.attack > p2.stats.attack) p1Stronger.push('Attack');
  else if (p2.stats.attack > p1.stats.attack) p2Stronger.push('Attack');

  if (p1.stats.defense > p2.stats.defense) p1Stronger.push('Defense');
  else if (p2.stats.defense > p1.stats.defense) p2Stronger.push('Defense');

  if (p1.stats.speed > p2.stats.speed) p1Stronger.push('Speed');
  else if (p2.stats.speed > p1.stats.speed) p2Stronger.push('Speed');

  // Type effectiveness analysis
  const p1Advantages = [];
  const p2Advantages = [];

  for (const type1 of p1.types) {
    for (const type2 of p2.types) {
      if (TYPE_CHART[type1]?.strong.includes(type2)) {
        p1Advantages.push(`${type1} is strong against ${type2}`);
      }
      if (TYPE_CHART[type2]?.strong.includes(type1)) {
        p2Advantages.push(`${type2} is strong against ${type1}`);
      }
    }
  }

  const p1TypeAdvantage = p1Advantages.length > p2Advantages.length ? 'advantage' :
                          p1Advantages.length < p2Advantages.length ? 'disadvantage' : 'neutral';
  const p2TypeAdvantage = p2Advantages.length > p1Advantages.length ? 'advantage' :
                          p2Advantages.length < p1Advantages.length ? 'disadvantage' : 'neutral';

  // Generate recommendation
  const p1Score = p1Stronger.length + (p1TypeAdvantage === 'advantage' ? 2 : 0);
  const p2Score = p2Stronger.length + (p2TypeAdvantage === 'advantage' ? 2 : 0);

  let recommendation = '';
  if (p1Score > p2Score) {
    recommendation = `${p1.name} has the advantage with superior ${p1Stronger.join(', ')} and ${p1TypeAdvantage} type matchup`;
  } else if (p2Score > p1Score) {
    recommendation = `${p2.name} has the advantage with superior ${p2Stronger.join(', ')} and ${p2TypeAdvantage} type matchup`;
  } else {
    recommendation = 'This would be a close battle! Both Pokemon have comparable strengths.';
  }

  return {
    pokemon1: p1,
    pokemon2: p2,
    analysis: {
      strongerIn: {
        pokemon1: p1Stronger,
        pokemon2: p2Stronger
      },
      typeAdvantages: {
        pokemon1VsPokemon2: p1Advantages.join('; ') || 'No type advantage',
        pokemon2VsPokemon1: p2Advantages.join('; ') || 'No type advantage'
      },
      recommendation
    }
  };
}

// Analyze team composition and synergy
export async function analyzeTeam(args: { teamNames: string[] }): Promise<TeamAnalysis> {
  if (args.teamNames.length === 0) {
    throw new Error('Team must have at least one Pokemon');
  }

  if (args.teamNames.length > 6) {
    throw new Error('Team cannot have more than 6 Pokemon');
  }

  // Fetch all team members
  const team = await Promise.all(
    args.teamNames.map(name => fetchPokemon({ name }))
  );

  // Analyze type coverage
  const allTypes = team.flatMap(p => p.types);
  const uniqueTypes = [...new Set(allTypes)];

  // Find offensive coverage
  const offensiveTypes = new Set<string>();
  for (const type of uniqueTypes) {
    if (TYPE_CHART[type]) {
      TYPE_CHART[type].strong.forEach(strongAgainst => offensiveTypes.add(strongAgainst));
    }
  }

  // Find defensive gaps (types that can easily beat this team)
  const defensiveWeaknesses = new Set<string>();
  for (const type of uniqueTypes) {
    if (TYPE_CHART[type]) {
      TYPE_CHART[type].weak.forEach(weakTo => defensiveWeaknesses.add(weakTo));
    }
  }

  // Calculate team strengths
  const avgStats = {
    hp: team.reduce((sum, p) => sum + p.stats.hp, 0) / team.length,
    attack: team.reduce((sum, p) => sum + p.stats.attack, 0) / team.length,
    defense: team.reduce((sum, p) => sum + p.stats.defense, 0) / team.length,
    speed: team.reduce((sum, p) => sum + p.stats.speed, 0) / team.length
  };

  const strengths = [];
  const weaknesses = [];

  if (avgStats.attack > 100) strengths.push('High offensive power');
  if (avgStats.defense > 100) strengths.push('Strong defensive capabilities');
  if (avgStats.speed > 90) strengths.push('Good speed control');
  if (uniqueTypes.length >= 4) strengths.push('Diverse type coverage');

  if (avgStats.attack < 70) weaknesses.push('Low offensive power');
  if (avgStats.defense < 70) weaknesses.push('Vulnerable to physical attacks');
  if (avgStats.speed < 60) weaknesses.push('Slower team composition');
  if (uniqueTypes.length <= 2) weaknesses.push('Limited type diversity');

  // Generate recommendation
  let recommendation = '';
  if (strengths.length > weaknesses.length) {
    recommendation = `Strong team composition! Focus on: ${strengths.join(', ')}. Consider adding coverage for ${Array.from(defensiveWeaknesses).slice(0, 3).join(', ')} types.`;
  } else {
    recommendation = `Team needs improvement. Address: ${weaknesses.join(', ')}. Consider replacing members to cover ${Array.from(defensiveWeaknesses).slice(0, 2).join(' and ')} weaknesses.`;
  }

  return {
    team,
    strengths,
    weaknesses,
    coverage: {
      offensiveTypes: Array.from(offensiveTypes),
      defensiveGaps: Array.from(defensiveWeaknesses)
    },
    recommendation
  };
}

// Get random Pokemon recommendation based on criteria
export async function recommendPokemon(args: {
  type?: string;
  minStatTotal?: number;
  generation?: number
}): Promise<{ pokemon: PokemonBasicInfo; reason: string }> {
  // For simplicity, we'll use a predefined list of popular Pokemon
  // In a real implementation, you'd query the Pokemon API for all Pokemon and filter
  const popularPokemon = [
    'charizard', 'blastoise', 'venusaur', 'pikachu', 'mewtwo', 'mew',
    'typhlosion', 'feraligatr', 'meganium', 'lugia', 'ho-oh',
    'blaziken', 'swampert', 'sceptile', 'rayquaza', 'kyogre', 'groudon',
    'infernape', 'empoleon', 'torterra', 'dialga', 'palkia', 'giratina',
    'serperior', 'emboar', 'samurott', 'reshiram', 'zekrom', 'kyurem'
  ];

  let candidates = [...popularPokemon];

  // Random selection from candidates
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const chosenName = candidates[randomIndex];

  const pokemon = await fetchPokemon({ name: chosenName });

  // Check if it meets criteria
  let reason = `Recommended ${pokemon.name}`;

  if (args.type && pokemon.types.includes(args.type)) {
    reason += ` - matches requested ${args.type} type`;
  }

  if (args.minStatTotal && pokemon.stats.total >= args.minStatTotal) {
    reason += ` - exceeds minimum stat total of ${args.minStatTotal}`;
  }

  reason += `. Strong in: ${pokemon.types.join(' and ')} types with ${pokemon.stats.total} total stats.`;

  return { pokemon, reason };
}