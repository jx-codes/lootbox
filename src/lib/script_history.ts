// Script execution history storage for pattern extraction and library building
// Uses time-based chunking: one JSONL file per day for efficient querying

import { join } from "jsr:@std/path";

export interface ScriptRun {
  id: string;           // Unique identifier (timestamp-randomId)
  timestamp: number;    // Unix timestamp in milliseconds
  script: string;       // The TypeScript code executed
  success: boolean;     // Whether execution succeeded
  output?: unknown;     // Success output (if any)
  error?: string;       // Error message (if failed)
  durationMs?: number;  // Execution duration in milliseconds
  sessionId?: string;   // Optional session identifier for grouping related runs
}

/**
 * Get platform-specific data directory following XDG Base Directory spec
 */
function getDefaultDataDir(): string {
  const platform = Deno.build.os;

  if (platform === "windows") {
    const appData = Deno.env.get("APPDATA") || Deno.env.get("USERPROFILE");
    return appData ? join(appData, "lootbox") : join(Deno.cwd(), "lootbox-data");
  } else if (platform === "darwin") {
    const home = Deno.env.get("HOME");
    return home ? join(home, "Library", "Application Support", "lootbox") : join(Deno.cwd(), "lootbox-data");
  } else {
    // Linux/Unix - follow XDG spec
    const xdgDataHome = Deno.env.get("XDG_DATA_HOME");
    const home = Deno.env.get("HOME");
    if (xdgDataHome) {
      return join(xdgDataHome, "lootbox");
    } else if (home) {
      return join(home, ".local", "share", "lootbox");
    }
    return join(Deno.cwd(), "lootbox-data");
  }
}

/**
 * Get the script history directory path
 * Uses platform-specific standard location or user-provided override
 */
async function getHistoryDir(): Promise<string> {
  const { get_config } = await import("./get_config.ts");
  const config = get_config();
  const baseDir = config.mcp_rpc_data_dir || getDefaultDataDir();
  return join(baseDir, "script-history");
}

/**
 * Ensure the script history directory exists
 */
async function ensureHistoryDir(): Promise<void> {
  const dir = await getHistoryDir();
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

/**
 * Generate a unique ID for a script run
 */
function generateRunId(): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomId}`;
}

/**
 * Get the filename for a given date (YYYY-MM-DD.jsonl)
 */
function getChunkFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}.jsonl`;
}

/**
 * Save a script run to disk (async, non-blocking)
 * Appends to daily JSONL file
 */
export async function saveScriptRun(run: Omit<ScriptRun, "id">): Promise<void> {
  const id = generateRunId();
  const scriptRun: ScriptRun = { id, ...run };

  // Don't await - fire and forget
  (async () => {
    try {
      await ensureHistoryDir();
      const filename = getChunkFilename(new Date(scriptRun.timestamp));
      const filepath = join(await getHistoryDir(), filename);

      // Append as single line JSONL
      const jsonLine = JSON.stringify(scriptRun) + '\n';
      await Deno.writeTextFile(filepath, jsonLine, { append: true });

      console.error(`📝 Saved to ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to save script run ${id}:`, error);
    }
  })();
}

/**
 * Load all script runs from disk (for librarian agent)
 * Returns sorted by timestamp (oldest first)
 */
export async function loadScriptHistory(): Promise<ScriptRun[]> {
  try {
    await ensureHistoryDir();
    const dir = await getHistoryDir();
    const runs: ScriptRun[] = [];

    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith('.jsonl')) {
        try {
          const filepath = join(dir, entry.name);
          const content = await Deno.readTextFile(filepath);

          // Parse JSONL: one JSON object per line
          for (const line of content.split('\n')) {
            if (line.trim()) {
              try {
                const run = JSON.parse(line) as ScriptRun;
                runs.push(run);
              } catch (parseError) {
                console.error(`Failed to parse line in ${entry.name}:`, parseError);
              }
            }
          }
        } catch (error) {
          console.error(`Failed to load script file ${entry.name}:`, error);
        }
      }
    }

    // Sort by timestamp
    return runs.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to load script history:', error);
    return [];
  }
}

/**
 * Get recent script runs (last N runs)
 */
export async function getRecentRuns(count: number): Promise<ScriptRun[]> {
  const allRuns = await loadScriptHistory();
  return allRuns.slice(-count);
}

/**
 * Get script runs in a time range
 */
export async function getRunsInRange(
  startTime: number,
  endTime: number
): Promise<ScriptRun[]> {
  const allRuns = await loadScriptHistory();
  return allRuns.filter(
    (run) => run.timestamp >= startTime && run.timestamp <= endTime
  );
}

/**
 * Delete old script runs (keep only last N days of chunks)
 * Useful for preventing unlimited storage growth
 */
export async function cleanupOldRuns(keepDays: number): Promise<number> {
  try {
    await ensureHistoryDir();
    const dir = await getHistoryDir();
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith('.jsonl')) {
        try {
          // Parse date from filename (YYYY-MM-DD.jsonl)
          const dateMatch = entry.name.match(/^(\d{4})-(\d{2})-(\d{2})\.jsonl$/);
          if (dateMatch) {
            const [_, year, month, day] = dateMatch;
            const fileDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

            if (fileDate.getTime() < cutoffTime) {
              const filepath = join(dir, entry.name);
              await Deno.remove(filepath);
              deletedCount++;
            }
          }
        } catch (error) {
          console.error(`Failed to delete ${entry.name}:`, error);
        }
      }
    }

    if (deletedCount > 0) {
      console.error(`🧹 Cleaned up ${deletedCount} old daily chunk(s)`);
    }
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old runs:', error);
    return 0;
  }
}

/**
 * Load script runs for a specific date
 */
export async function loadRunsForDate(date: Date): Promise<ScriptRun[]> {
  try {
    await ensureHistoryDir();
    const filename = getChunkFilename(date);
    const filepath = join(await getHistoryDir(), filename);

    const content = await Deno.readTextFile(filepath);
    const runs: ScriptRun[] = [];

    for (const line of content.split('\n')) {
      if (line.trim()) {
        try {
          runs.push(JSON.parse(line) as ScriptRun);
        } catch (parseError) {
          console.error(`Failed to parse line:`, parseError);
        }
      }
    }

    return runs.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return [];
    }
    console.error(`Failed to load runs for ${date}:`, error);
    return [];
  }
}