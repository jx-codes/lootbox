// Hacker News Reading Tracker
// Fetches top 10 stories, tracks which ones have been read, and shows status

interface HNStory {
  id: number;
  title: string;
  by: string;
  url?: string;
  score: number;
  time: number;
}

// Fetch top story IDs
const topStoriesResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
const allTopStories: number[] = await topStoriesResponse.json();
const top10Ids = allTopStories.slice(0, 10);

console.log('📰 Fetching top 10 Hacker News stories...\n');

// Fetch story details in parallel
const storyPromises = top10Ids.map(async (id) => {
  const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
  return await response.json() as HNStory;
});

const stories = await Promise.all(storyPromises);

// Get read stories from KV store
const readStoriesResult = await tools.kv.get({ key: 'hn:read_stories' });
const readStories = readStoriesResult.exists ? (readStoriesResult.value as number[]) : [];

console.log(`📚 You have read ${readStories.length} stories total\n`);

// Identify new vs already read
const newStories = stories.filter(s => !readStories.includes(s.id));
const alreadyRead = stories.filter(s => readStories.includes(s.id));

// For demo: if this is first run or we have many new stories, mark first 3 as read
if (newStories.length >= 3) {
  const toMarkAsRead = newStories.slice(0, 3).map(s => s.id);
  const updatedReadStories = [...new Set([...readStories, ...toMarkAsRead])];

  await tools.kv.set({
    key: 'hn:read_stories',
    value: updatedReadStories
  });

  console.log('✅ Marked first 3 stories as read (demo)\n');
  console.log('═══════════════════════════════════════════════════\n');
}

// Display results
console.log('🆕 NEW STORIES:');
console.log('─────────────────────────────────────────────────────');
if (newStories.length === 0) {
  console.log('  (none - you\'ve seen all current top 10!)');
} else {
  newStories.forEach((story, idx) => {
    console.log(`${idx + 1}. ${story.title}`);
    console.log(`   👤 ${story.by} | ⭐ ${story.score} points`);
    console.log(`   🔗 ${story.url || `https://news.ycombinator.com/item?id=${story.id}`}`);
    console.log('');
  });
}

console.log('\n✓ ALREADY READ:');
console.log('─────────────────────────────────────────────────────');
if (alreadyRead.length === 0) {
  console.log('  (none)');
} else {
  alreadyRead.forEach((story, idx) => {
    console.log(`${idx + 1}. ${story.title}`);
    console.log(`   👤 ${story.by} | ⭐ ${story.score} points`);
    console.log('');
  });
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`📊 Summary: ${newStories.length} new, ${alreadyRead.length} already read`);
