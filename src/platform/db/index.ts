import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, eq, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { ConflictError } from "../errors";
import type { Actor } from "../types";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;
export { schema };

const DB_PATH = process.env.DB_PATH ?? "./data/app.db";

export function createDb(dbPath: string = DB_PATH): Db {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  if (dbPath !== ":memory:") sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as { __db?: Db };

export function getDb(): Db {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}

type VersionedTable = SQLiteTable & {
  id: SQLiteColumn;
  version: SQLiteColumn;
};

/**
 * The only sanctioned way to update a mutable row: WHERE id AND version,
 * bumping version. Zero matching rows means a stale write -> 409.
 */
export function optimisticUpdate(
  tx: Db,
  table: VersionedTable,
  id: string,
  expectedVersion: number,
  patch: Record<string, unknown>,
): void {
  const res = tx
    .update(table)
    .set({ ...patch, version: sql`${table.version} + 1` })
    .where(and(eq(table.id, id), eq(table.version, expectedVersion)))
    .run();
  if (res.changes === 0) throw new ConflictError();
}

/**
 * One transaction per mutation: entity updates plus audit.append live in fn.
 * If fn throws, nothing persists — including the audit row.
 */
export function withMutation<T>(
  actor: Actor,
  fn: (tx: Db) => T,
  db: Db = getDb(),
): T {
  return db.transaction((tx) => fn(tx));
}
