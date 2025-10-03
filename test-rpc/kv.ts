// KV Store RPC functions
// Provides a simple key-value store using JSON file storage

import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { dirname, join, resolve } from "https://deno.land/std@0.208.0/path/mod.ts";

// Configure KV storage directory (can be set via environment variables)
const KV_DIR = resolve(Deno.env.get("KV_DIR") || "./storage/kv");
const KV_FILE = join(KV_DIR, "store.json");

// In-memory cache of the KV store
let kvCache: Record<string, unknown> | null = null;

// Load KV store from disk
async function loadKv(): Promise<Record<string, unknown>> {
  if (kvCache !== null) {
    return kvCache;
  }

  try {
    const data = await Deno.readTextFile(KV_FILE);
    kvCache = JSON.parse(data);
    return kvCache;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Initialize empty store
      kvCache = {};
      await saveKv();
      return kvCache;
    }
    throw error;
  }
}

// Save KV store to disk
async function saveKv(): Promise<void> {
  if (kvCache === null) {
    return;
  }

  await ensureDir(KV_DIR);
  const data = JSON.stringify(kvCache, null, 2);
  await Deno.writeTextFile(KV_FILE, data);
}

// Get a value from the KV store
export interface GetArgs {
  key: string;
}

export interface GetResult {
  value: unknown;
  exists: boolean;
}

export async function get(args: GetArgs): Promise<GetResult> {
  const store = await loadKv();
  const value = store[args.key];

  return {
    value: value !== undefined ? value : null,
    exists: value !== undefined,
  };
}

// Set a value in the KV store
export interface SetArgs {
  key: string;
  value: unknown;
}

export interface SetResult {
  success: boolean;
  key: string;
}

export async function set(args: SetArgs): Promise<SetResult> {
  const store = await loadKv();
  store[args.key] = args.value;
  await saveKv();

  return {
    success: true,
    key: args.key,
  };
}

// Delete a key from the KV store
export interface DeleteArgs {
  key: string;
}

export interface DeleteResult {
  success: boolean;
  existed: boolean;
}

export async function deleteKey(args: DeleteArgs): Promise<DeleteResult> {
  const store = await loadKv();
  const existed = args.key in store;
  delete store[args.key];
  await saveKv();

  return {
    success: true,
    existed,
  };
}

// List all keys with optional prefix filter
export interface ListArgs {
  prefix?: string;
  limit?: number;
  offset?: number;
}

export interface KvEntry {
  key: string;
  value: unknown;
}

export interface ListResult {
  entries: KvEntry[];
  totalCount: number;
  returnedCount: number;
}

export async function list(args: ListArgs): Promise<ListResult> {
  const store = await loadKv();
  let keys = Object.keys(store);

  // Filter by prefix if provided
  if (args.prefix) {
    keys = keys.filter(key => key.startsWith(args.prefix));
  }

  const totalCount = keys.length;

  // Apply pagination
  const offset = args.offset || 0;
  const limit = args.limit || 100;
  keys = keys.slice(offset, offset + limit);

  const entries: KvEntry[] = keys.map(key => ({
    key,
    value: store[key],
  }));

  return {
    entries,
    totalCount,
    returnedCount: entries.length,
  };
}

// Get multiple keys at once
export interface GetManyArgs {
  keys: string[];
}

export interface GetManyResult {
  entries: Array<{
    key: string;
    value: unknown;
    exists: boolean;
  }>;
}

export async function getMany(args: GetManyArgs): Promise<GetManyResult> {
  const store = await loadKv();

  return {
    entries: args.keys.map(key => ({
      key,
      value: store[key] !== undefined ? store[key] : null,
      exists: store[key] !== undefined,
    })),
  };
}

// Set multiple key-value pairs at once
export interface SetManyArgs {
  entries: Array<{
    key: string;
    value: unknown;
  }>;
}

export interface SetManyResult {
  success: boolean;
  count: number;
}

export async function setMany(args: SetManyArgs): Promise<SetManyResult> {
  const store = await loadKv();

  for (const entry of args.entries) {
    store[entry.key] = entry.value;
  }

  await saveKv();

  return {
    success: true,
    count: args.entries.length,
  };
}

// Delete multiple keys at once
export interface DeleteManyArgs {
  keys: string[];
}

export interface DeleteManyResult {
  success: boolean;
  deletedCount: number;
}

export async function deleteMany(args: DeleteManyArgs): Promise<DeleteManyResult> {
  const store = await loadKv();
  let deletedCount = 0;

  for (const key of args.keys) {
    if (key in store) {
      delete store[key];
      deletedCount++;
    }
  }

  await saveKv();

  return {
    success: true,
    deletedCount,
  };
}

// Delete all entries with a given prefix
export interface DeletePrefixArgs {
  prefix: string;
}

export interface DeletePrefixResult {
  success: boolean;
  deletedCount: number;
}

export async function deletePrefix(args: DeletePrefixArgs): Promise<DeletePrefixResult> {
  const store = await loadKv();
  const keysToDelete = Object.keys(store).filter(key => key.startsWith(args.prefix));

  for (const key of keysToDelete) {
    delete store[key];
  }

  await saveKv();

  return {
    success: true,
    deletedCount: keysToDelete.length,
  };
}

// Check if a key exists
export interface HasArgs {
  key: string;
}

export interface HasResult {
  exists: boolean;
}

export async function has(args: HasArgs): Promise<HasResult> {
  const store = await loadKv();

  return {
    exists: args.key in store,
  };
}

// Count all keys or keys with a given prefix
export interface CountArgs {
  prefix?: string;
}

export interface CountResult {
  count: number;
}

export async function count(args: CountArgs): Promise<CountResult> {
  const store = await loadKv();
  let keys = Object.keys(store);

  if (args.prefix) {
    keys = keys.filter(key => key.startsWith(args.prefix));
  }

  return {
    count: keys.length,
  };
}

// Clear all entries in the store
export interface ClearResult {
  success: boolean;
  deletedCount: number;
}

export async function clear(): Promise<ClearResult> {
  const store = await loadKv();
  const deletedCount = Object.keys(store).length;

  kvCache = {};
  await saveKv();

  return {
    success: true,
    deletedCount,
  };
}

// Get store info
export interface InfoResult {
  keyCount: number;
}

export async function info(): Promise<InfoResult> {
  const store = await loadKv();

  return {
    keyCount: Object.keys(store).length,
  };
}

// Reload store from disk (invalidate cache)
export interface ReloadResult {
  success: boolean;
  keyCount: number;
}

export async function reload(): Promise<ReloadResult> {
  kvCache = null;
  const store = await loadKv();

  return {
    success: true,
    keyCount: Object.keys(store).length,
  };
}
