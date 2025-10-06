// SQLite RPC functions
// Provides direct SQL execution using SQLite

import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { dirname, resolve } from "https://deno.land/std@0.208.0/path/mod.ts";

// Configure database path (can be set via environment variables)
const DB_PATH = resolve(Deno.env.get("SQLITE_DB") || "./storage/sqlite/database.db");

// Global database instance
let dbInstance: DB | null = null;

// Get or create database connection
async function getDb(): Promise<DB> {
  if (!dbInstance) {
    await ensureDir(dirname(DB_PATH));
    dbInstance = new DB(DB_PATH);
  }
  return dbInstance;
}

// Execute arbitrary SQL (INSERT, UPDATE, DELETE, CREATE, etc.)
export interface ExecuteArgs {
  sql: string;
  params?: unknown[];
}

export interface ExecuteResult {
  success: boolean;
  changes: number;
  lastInsertRowId: number;
}

export async function execute(args: ExecuteArgs): Promise<ExecuteResult> {
  const db = await getDb();

  try {
    db.query(args.sql, args.params || []);

    return {
      success: true,
      changes: db.changes,
      lastInsertRowId: db.lastInsertRowId,
    };
  } catch (error) {
    throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Query data (SELECT statements)
export interface QueryArgs {
  sql: string;
  params?: unknown[];
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
}

export async function query(args: QueryArgs): Promise<QueryResult> {
  const db = await getDb();

  try {
    const results = db.queryEntries(args.sql, args.params || []);

    // Get column names from first row or empty array
    const columns = results.length > 0 ? Object.keys(results[0]) : [];

    return {
      rows: results,
      columns,
      rowCount: results.length,
    };
  } catch (error) {
    throw new Error(`SQL query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Execute multiple statements in a transaction
export interface TransactionArgs {
  statements: Array<{
    sql: string;
    params?: unknown[];
  }>;
}

export interface TransactionResult {
  success: boolean;
  executedCount: number;
  totalChanges: number;
}

export async function transaction(args: TransactionArgs): Promise<TransactionResult> {
  const db = await getDb();

  let executedCount = 0;
  let totalChanges = 0;

  try {
    db.query("BEGIN TRANSACTION");

    for (const stmt of args.statements) {
      db.query(stmt.sql, stmt.params || []);
      totalChanges += db.changes;
      executedCount++;
    }

    db.query("COMMIT");

    return {
      success: true,
      executedCount,
      totalChanges,
    };
  } catch (error) {
    db.query("ROLLBACK");
    throw new Error(`Transaction failed at statement ${executedCount + 1}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Execute raw SQL and return first row (useful for SELECT single values)
export interface QueryOneArgs {
  sql: string;
  params?: unknown[];
}

export interface QueryOneResult {
  row: Record<string, unknown> | null;
}

export async function queryOne(args: QueryOneArgs): Promise<QueryOneResult> {
  const db = await getDb();

  try {
    const results = db.queryEntries(args.sql, args.params || []);

    return {
      row: results.length > 0 ? results[0] : null,
    };
  } catch (error) {
    throw new Error(`SQL query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get list of all tables in the database
export interface ListTablesResult {
  tables: string[];
}

export async function listTables(): Promise<ListTablesResult> {
  const db = await getDb();

  const results = db.queryEntries<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );

  return {
    tables: results.map(row => row.name),
  };
}

// Get schema information for a table
export interface GetSchemaArgs {
  tableName: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: unknown;
  primaryKey: boolean;
}

export interface GetSchemaResult {
  tableName: string;
  columns: ColumnInfo[];
}

export async function getSchema(args: GetSchemaArgs): Promise<GetSchemaResult> {
  const db = await getDb();

  const results = db.queryEntries<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
  }>(`PRAGMA table_info(${args.tableName})`);

  return {
    tableName: args.tableName,
    columns: results.map(col => ({
      name: col.name,
      type: col.type,
      notNull: col.notnull === 1,
      defaultValue: col.dflt_value,
      primaryKey: col.pk === 1,
    })),
  };
}

// Vacuum the database (cleanup and optimize)
export interface VacuumResult {
  success: boolean;
}

export async function vacuum(): Promise<VacuumResult> {
  const db = await getDb();

  try {
    db.query("VACUUM");
    return { success: true };
  } catch (error) {
    throw new Error(`Vacuum failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get database info
export interface InfoResult {
  tables: number;
}

export async function info(): Promise<InfoResult> {
  const db = await getDb();

  const tables = db.queryEntries<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );

  return {
    tables: tables[0]?.count || 0,
  };
}

// Close the database connection
export interface CloseResult {
  success: boolean;
  message: string;
}

export async function close(): Promise<CloseResult> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    return {
      success: true,
      message: "Database connection closed",
    };
  }
  return {
    success: true,
    message: "Database was not open",
  };
}
