// Simple file-based database RPC functions
// Each "table" is a JSON file, operations are atomic file reads/writes

import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

const DB_DIR = "./filedb_data";

// Ensure DB directory exists
async function ensureDbDir() {
  try {
    await Deno.mkdir(DB_DIR, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

function getTablePath(tableName: string): string {
  return join(DB_DIR, `${tableName}.json`);
}

export interface CreateTableArgs {
  tableName: string;
}

export interface CreateTableResult {
  success: boolean;
  tableName: string;
  message: string;
}

export async function createTable(
  args: CreateTableArgs
): Promise<CreateTableResult> {
  await ensureDbDir();
  const path = getTablePath(args.tableName);

  // Create empty table file
  await Deno.writeTextFile(path, JSON.stringify([], null, 2));

  return {
    success: true,
    tableName: args.tableName,
    message: `Table '${args.tableName}' created`,
  };
}

export interface InsertArgs {
  tableName: string;
  records: Record<string, unknown>[];
}

export interface InsertResult {
  success: boolean;
  insertedCount: number;
}

export async function insert(args: InsertArgs): Promise<InsertResult> {
  const path = getTablePath(args.tableName);

  // Read existing records
  const content = await Deno.readTextFile(path);
  const records = JSON.parse(content);

  // Add new records
  records.push(...args.records);

  // Write back
  await Deno.writeTextFile(path, JSON.stringify(records, null, 2));

  return {
    success: true,
    insertedCount: args.records.length,
  };
}

export interface QueryArgs {
  tableName: string;
  filter?: Record<string, unknown>;
  limit?: number;
}

export interface QueryResult {
  records: Record<string, unknown>[];
  count: number;
}

export async function query(args: QueryArgs): Promise<QueryResult> {
  const path = getTablePath(args.tableName);

  // Read records
  const content = await Deno.readTextFile(path);
  let records: Record<string, unknown>[] = JSON.parse(content);

  // Apply filter if provided
  if (args.filter) {
    records = records.filter((record) => {
      return Object.entries(args.filter!).every(([key, value]) => {
        return record[key] === value;
      });
    });
  }

  // Apply limit if provided
  if (args.limit !== undefined && args.limit > 0) {
    records = records.slice(0, args.limit);
  }

  return {
    records,
    count: records.length,
  };
}

export interface UpdateArgs {
  tableName: string;
  filter: Record<string, unknown>;
  updates: Record<string, unknown>;
}

export interface UpdateResult {
  success: boolean;
  updatedCount: number;
}

export async function update(args: UpdateArgs): Promise<UpdateResult> {
  const path = getTablePath(args.tableName);

  // Read records
  const content = await Deno.readTextFile(path);
  const records: Record<string, unknown>[] = JSON.parse(content);

  // Update matching records
  let updatedCount = 0;
  const updatedRecords = records.map((record) => {
    const matches = Object.entries(args.filter).every(([key, value]) => {
      return record[key] === value;
    });

    if (matches) {
      updatedCount++;
      return { ...record, ...args.updates };
    }

    return record;
  });

  // Write back
  await Deno.writeTextFile(path, JSON.stringify(updatedRecords, null, 2));

  return {
    success: true,
    updatedCount,
  };
}

export interface DeleteArgs {
  tableName: string;
  filter: Record<string, unknown>;
}

export interface DeleteResult {
  success: boolean;
  deletedCount: number;
}

export async function deleteRecords(args: DeleteArgs): Promise<DeleteResult> {
  const path = getTablePath(args.tableName);

  // Read records
  const content = await Deno.readTextFile(path);
  const records: Record<string, unknown>[] = JSON.parse(content);

  // Filter out matching records
  const filteredRecords = records.filter((record) => {
    return !Object.entries(args.filter).every(([key, value]) => {
      return record[key] === value;
    });
  });

  const deletedCount = records.length - filteredRecords.length;

  // Write back
  await Deno.writeTextFile(path, JSON.stringify(filteredRecords, null, 2));

  return {
    success: true,
    deletedCount,
  };
}

export interface DropTableArgs {
  tableName: string;
}

export interface DropTableResult {
  success: boolean;
  message: string;
}

export async function dropTable(args: DropTableArgs): Promise<DropTableResult> {
  const path = getTablePath(args.tableName);

  try {
    await Deno.remove(path);
    return {
      success: true,
      message: `Table '${args.tableName}' dropped`,
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {
        success: true,
        message: `Table '${args.tableName}' does not exist`,
      };
    }
    throw error;
  }
}

export interface ListTablesResult {
  tables: string[];
}

export async function listTables(
  args: Record<string, never>
): Promise<ListTablesResult> {
  await ensureDbDir();

  const tables: string[] = [];

  for await (const entry of Deno.readDir(DB_DIR)) {
    if (entry.isFile && entry.name.endsWith(".json")) {
      tables.push(entry.name.replace(".json", ""));
    }
  }

  return { tables };
}
