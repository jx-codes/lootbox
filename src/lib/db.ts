// Shared database utilities for lootbox SQLite database
// Provides centralized connection management and schema initialization

import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { join } from "jsr:@std/path";

/**
 * Get platform-specific data directory following XDG Base Directory spec
 */
function getDefaultDataDir(): string {
  const platform = Deno.build.os;

  if (platform === "windows") {
    const appData = Deno.env.get("APPDATA") || Deno.env.get("USERPROFILE");
    return appData
      ? join(appData, "lootbox")
      : join(Deno.cwd(), "lootbox-data");
  } else if (platform === "darwin") {
    const home = Deno.env.get("HOME");
    return home
      ? join(home, "Library", "Application Support", "lootbox")
      : join(Deno.cwd(), "lootbox-data");
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
 * Get the database file path
 */
async function getDbPath(): Promise<string> {
  const { get_config } = await import("./get_config.ts");
  const config = await get_config();
  const baseDir = config.lootbox_data_dir || getDefaultDataDir();
  return join(baseDir, "lootbox.db");
}

/**
 * Ensure the database directory exists
 */
async function ensureDbDir(dbPath: string): Promise<void> {
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

let dbInstance: DB | null = null;
let schemaInitialized = false;

/**
 * Initialize all database schemas
 */
function initializeSchemas(db: DB): void {
  if (schemaInitialized) return;

  // Workflow events table
  db.query(`
    CREATE TABLE IF NOT EXISTS workflow_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      workflow_file TEXT NOT NULL,
      step_number INTEGER,
      loop_iteration INTEGER,
      reason TEXT,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_events_timestamp
    ON workflow_events(timestamp)
  `);

  db.query(`
    CREATE INDEX IF NOT EXISTS idx_workflow_events_workflow_file
    ON workflow_events(workflow_file)
  `);

  // Script runs table
  db.query(`
    CREATE TABLE IF NOT EXISTS script_runs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      script TEXT NOT NULL,
      success INTEGER NOT NULL,
      output TEXT,
      error TEXT,
      duration_ms INTEGER,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.query(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_timestamp
    ON script_runs(timestamp)
  `);

  db.query(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_session_id
    ON script_runs(session_id)
  `);

  db.query(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_success
    ON script_runs(success)
  `);

  schemaInitialized = true;
}

/**
 * Get or create database connection and initialize all schemas
 * This is a singleton - all modules share the same connection
 */
export async function getDb(): Promise<DB> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = await getDbPath();
  await ensureDbDir(dbPath);

  dbInstance = new DB(dbPath);
  initializeSchemas(dbInstance);

  return dbInstance;
}

/**
 * Close the database connection
 * Should be called when shutting down the application
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    schemaInitialized = false;
  }
}
