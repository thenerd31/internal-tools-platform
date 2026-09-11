import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { ensureRegistry } from "../src/platform/registry/generate";

// generated.ts must exist before registry/seed modules load.
ensureRegistry();

const { createDb } = await import("../src/platform/db");
const { seed } = await import("../src/platform/db/seed");

const db = createDb();
migrate(db, { migrationsFolder: "./drizzle" });
seed(db);
console.log("db:seed: seeded users and app data");
