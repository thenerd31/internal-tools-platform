import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb, type Db } from "../src/platform/db";
import type { Actor } from "../src/platform/types";

export function testDb(): Db {
  const db = createDb(":memory:");
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

export const actors: Record<string, Actor> = {
  analyst: { id: "u-analyst", email: "analyst@demo.local", name: "Demo Analyst", role: "analyst" },
  supervisor: { id: "u-supervisor", email: "supervisor@demo.local", name: "Demo Supervisor", role: "supervisor" },
  agent: { id: "u-agent", email: "agent@demo.local", name: "Demo Agent", role: "agent" },
  lead: { id: "u-lead", email: "lead@demo.local", name: "Demo Lead", role: "lead" },
  admin: { id: "u-admin", email: "admin@demo.local", name: "Demo Admin", role: "admin" },
};
