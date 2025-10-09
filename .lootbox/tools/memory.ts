// Memory/Knowledge Graph RPC functions
// Provides entity and relation storage using SQLite

import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { dirname, resolve } from "https://deno.land/std@0.208.0/path/mod.ts";

// Configure database path
const DB_PATH = resolve(Deno.env.get("MEMORY_DB") || "./storage/memory/graph.db");

// Global database instance
let dbInstance: DB | null = null;

// Get or create database connection
async function getDb(): Promise<DB> {
  if (!dbInstance) {
    await ensureDir(dirname(DB_PATH));
    dbInstance = new DB(DB_PATH);
    await initSchema();
  }
  return dbInstance;
}

// Initialize database schema
async function initSchema(): Promise<void> {
  if (!dbInstance) return;

  dbInstance.execute(`
    CREATE TABLE IF NOT EXISTS entities (
      name TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      properties TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  dbInstance.execute(`
    CREATE TABLE IF NOT EXISTS relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_entity TEXT NOT NULL,
      to_entity TEXT NOT NULL,
      type TEXT NOT NULL,
      properties TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (from_entity) REFERENCES entities(name) ON DELETE CASCADE,
      FOREIGN KEY (to_entity) REFERENCES entities(name) ON DELETE CASCADE,
      UNIQUE(from_entity, to_entity, type)
    )
  `);

  dbInstance.execute(`
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)
  `);

  dbInstance.execute(`
    CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity)
  `);

  dbInstance.execute(`
    CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity)
  `);

  dbInstance.execute(`
    CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type)
  `);
}

// Entity interface (with timestamps)
export interface Entity {
  name: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

// Entity input (without timestamps - generated automatically)
export interface EntityInput {
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

// Relation interface
export interface Relation {
  from: string;
  to: string;
  type: string;
  properties?: Record<string, unknown>;
  created_at?: number;
}

// Create entities
export interface CreateEntitiesArgs {
  entities: EntityInput[];
}

export interface CreateEntitiesResult {
  success: boolean;
  created: number;
  updated: number;
}

export async function createEntities(args: CreateEntitiesArgs): Promise<CreateEntitiesResult> {
  const db = await getDb();
  const now = Date.now();

  let created = 0;
  let updated = 0;

  for (const entity of args.entities) {
    const existing = db.queryEntries<{ name: string }>(
      "SELECT name FROM entities WHERE name = ?",
      [entity.name]
    );

    const propertiesJson = JSON.stringify(entity.properties);

    if (existing.length > 0) {
      db.query(
        "UPDATE entities SET type = ?, properties = ?, updated_at = ? WHERE name = ?",
        [entity.type, propertiesJson, now, entity.name]
      );
      updated++;
    } else {
      db.query(
        "INSERT INTO entities (name, type, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [entity.name, entity.type, propertiesJson, now, now]
      );
      created++;
    }
  }

  return { success: true, created, updated };
}

// Create relations
export interface CreateRelationsArgs {
  relations: Relation[];
}

export interface CreateRelationsResult {
  success: boolean;
  created: number;
  skipped: number;
}

export async function createRelations(args: CreateRelationsArgs): Promise<CreateRelationsResult> {
  const db = await getDb();
  const now = Date.now();

  let created = 0;
  let skipped = 0;

  for (const relation of args.relations) {
    const propertiesJson = relation.properties ? JSON.stringify(relation.properties) : null;

    try {
      db.query(
        "INSERT INTO relations (from_entity, to_entity, type, properties, created_at) VALUES (?, ?, ?, ?, ?)",
        [relation.from, relation.to, relation.type, propertiesJson, now]
      );
      created++;
    } catch {
      // Relation already exists (UNIQUE constraint)
      skipped++;
    }
  }

  return { success: true, created, skipped };
}

// Get entity by name
export interface GetEntityArgs {
  name: string;
}

export interface GetEntityResult {
  entity: Entity | null;
  relations: {
    outgoing: Array<{ to: string; type: string; properties?: Record<string, unknown>; created_at: number }>;
    incoming: Array<{ from: string; type: string; properties?: Record<string, unknown>; created_at: number }>;
  };
}

export async function getEntity(args: GetEntityArgs): Promise<GetEntityResult> {
  const db = await getDb();

  const entities = db.queryEntries<{ name: string; type: string; properties: string; created_at: number; updated_at: number }>(
    "SELECT name, type, properties, created_at, updated_at FROM entities WHERE name = ?",
    [args.name]
  );

  if (entities.length === 0) {
    return { entity: null, relations: { outgoing: [], incoming: [] } };
  }

  const entity: Entity = {
    name: entities[0].name,
    type: entities[0].type,
    properties: JSON.parse(entities[0].properties),
    created_at: entities[0].created_at,
    updated_at: entities[0].updated_at,
  };

  // Get outgoing relations
  const outgoing = db.queryEntries<{ to_entity: string; type: string; properties: string | null; created_at: number }>(
    "SELECT to_entity, type, properties, created_at FROM relations WHERE from_entity = ?",
    [args.name]
  ).map(r => ({
    to: r.to_entity,
    type: r.type,
    properties: r.properties ? JSON.parse(r.properties) : undefined,
    created_at: r.created_at,
  }));

  // Get incoming relations
  const incoming = db.queryEntries<{ from_entity: string; type: string; properties: string | null; created_at: number }>(
    "SELECT from_entity, type, properties, created_at FROM relations WHERE to_entity = ?",
    [args.name]
  ).map(r => ({
    from: r.from_entity,
    type: r.type,
    properties: r.properties ? JSON.parse(r.properties) : undefined,
    created_at: r.created_at,
  }));

  return {
    entity,
    relations: { outgoing, incoming },
  };
}

// Search entities
export interface SearchArgs {
  query?: string;
  type?: string;
  limit?: number;
  offset?: number;
  sort?: "name" | "created_at" | "updated_at";
  order?: "asc" | "desc";
}

export interface SearchResult {
  entities: Entity[];
  total: number;
}

export async function search(args: SearchArgs): Promise<SearchResult> {
  const db = await getDb();

  let sql = "SELECT name, type, properties, created_at, updated_at FROM entities WHERE 1=1";
  const params: unknown[] = [];

  if (args.query) {
    sql += " AND (name LIKE ? OR properties LIKE ?)";
    const queryPattern = `%${args.query}%`;
    params.push(queryPattern, queryPattern);
  }

  if (args.type) {
    sql += " AND type = ?";
    params.push(args.type);
  }

  // Get total count
  const countSql = sql.replace("SELECT name, type, properties, created_at, updated_at", "SELECT COUNT(*) as count");
  const countResult = db.queryEntries<{ count: number }>(countSql, params);
  const total = countResult[0]?.count || 0;

  // Apply sorting
  const sortField = args.sort || "updated_at";
  const sortOrder = args.order || "desc";
  sql += ` ORDER BY ${sortField} ${sortOrder.toUpperCase()} LIMIT ? OFFSET ?`;
  params.push(args.limit || 50, args.offset || 0);

  const results = db.queryEntries<{ name: string; type: string; properties: string; created_at: number; updated_at: number }>(sql, params);

  const entities: Entity[] = results.map(row => ({
    name: row.name,
    type: row.type,
    properties: JSON.parse(row.properties),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return { entities, total };
}

// List all entity types
export interface ListTypesResult {
  types: Array<{ type: string; count: number }>;
}

export async function listTypes(): Promise<ListTypesResult> {
  const db = await getDb();

  const results = db.queryEntries<{ type: string; count: number }>(
    "SELECT type, COUNT(*) as count FROM entities GROUP BY type ORDER BY count DESC"
  );

  return { types: results };
}

// List all relation types
export interface ListRelationTypesResult {
  types: Array<{ type: string; count: number }>;
}

export async function listRelationTypes(): Promise<ListRelationTypesResult> {
  const db = await getDb();

  const results = db.queryEntries<{ type: string; count: number }>(
    "SELECT type, COUNT(*) as count FROM relations GROUP BY type ORDER BY count DESC"
  );

  return { types: results };
}

// Delete entity (and cascade relations)
export interface DeleteEntityArgs {
  name: string;
}

export interface DeleteEntityResult {
  success: boolean;
  existed: boolean;
}

export async function deleteEntity(args: DeleteEntityArgs): Promise<DeleteEntityResult> {
  const db = await getDb();

  const existing = db.queryEntries("SELECT name FROM entities WHERE name = ?", [args.name]);

  if (existing.length === 0) {
    return { success: true, existed: false };
  }

  db.query("DELETE FROM entities WHERE name = ?", [args.name]);

  return { success: true, existed: true };
}

// Delete relation
export interface DeleteRelationArgs {
  from: string;
  to: string;
  type: string;
}

export interface DeleteRelationResult {
  success: boolean;
  existed: boolean;
}

export async function deleteRelation(args: DeleteRelationArgs): Promise<DeleteRelationResult> {
  const db = await getDb();

  const existing = db.queryEntries(
    "SELECT id FROM relations WHERE from_entity = ? AND to_entity = ? AND type = ?",
    [args.from, args.to, args.type]
  );

  if (existing.length === 0) {
    return { success: true, existed: false };
  }

  db.query(
    "DELETE FROM relations WHERE from_entity = ? AND to_entity = ? AND type = ?",
    [args.from, args.to, args.type]
  );

  return { success: true, existed: true };
}

// Get full graph
export interface GetGraphArgs {
  type?: string;
  limit?: number;
}

export interface GetGraphResult {
  entities: Entity[];
  relations: Array<{ from: string; to: string; type: string; properties?: Record<string, unknown>; created_at: number }>;
}

export async function getGraph(args: GetGraphArgs): Promise<GetGraphResult> {
  const db = await getDb();

  let entitySql = "SELECT name, type, properties, created_at, updated_at FROM entities";
  const entityParams: unknown[] = [];

  if (args.type) {
    entitySql += " WHERE type = ?";
    entityParams.push(args.type);
  }

  if (args.limit) {
    entitySql += " LIMIT ?";
    entityParams.push(args.limit);
  }

  const entityRows = db.queryEntries<{ name: string; type: string; properties: string; created_at: number; updated_at: number }>(
    entitySql,
    entityParams
  );

  const entities: Entity[] = entityRows.map(row => ({
    name: row.name,
    type: row.type,
    properties: JSON.parse(row.properties),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const relationRows = db.queryEntries<{
    from_entity: string;
    to_entity: string;
    type: string;
    properties: string | null;
    created_at: number;
  }>("SELECT from_entity, to_entity, type, properties, created_at FROM relations");

  const relations = relationRows.map(row => ({
    from: row.from_entity,
    to: row.to_entity,
    type: row.type,
    properties: row.properties ? JSON.parse(row.properties) : undefined,
    created_at: row.created_at,
  }));

  return { entities, relations };
}

// Clear all data
export interface ClearResult {
  success: boolean;
  entitiesDeleted: number;
  relationsDeleted: number;
}

export async function clear(): Promise<ClearResult> {
  const db = await getDb();

  const entityCount = db.queryEntries<{ count: number }>("SELECT COUNT(*) as count FROM entities");
  const relationCount = db.queryEntries<{ count: number }>("SELECT COUNT(*) as count FROM relations");

  db.query("DELETE FROM relations");
  db.query("DELETE FROM entities");

  return {
    success: true,
    entitiesDeleted: entityCount[0]?.count || 0,
    relationsDeleted: relationCount[0]?.count || 0,
  };
}

// Get stats
export interface StatsResult {
  entities: number;
  relations: number;
  types: number;
  relationTypes: number;
}

export async function stats(): Promise<StatsResult> {
  const db = await getDb();

  const entityCount = db.queryEntries<{ count: number }>("SELECT COUNT(*) as count FROM entities");
  const relationCount = db.queryEntries<{ count: number }>("SELECT COUNT(*) as count FROM relations");
  const typeCount = db.queryEntries<{ count: number }>("SELECT COUNT(DISTINCT type) as count FROM entities");
  const relTypeCount = db.queryEntries<{ count: number }>("SELECT COUNT(DISTINCT type) as count FROM relations");

  return {
    entities: entityCount[0]?.count || 0,
    relations: relationCount[0]?.count || 0,
    types: typeCount[0]?.count || 0,
    relationTypes: relTypeCount[0]?.count || 0,
  };
}
