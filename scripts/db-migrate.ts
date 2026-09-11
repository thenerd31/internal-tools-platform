import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "../src/platform/db";

const db = createDb();
migrate(db, { migrationsFolder: "./drizzle" });
console.log("db:migrate: applied migrations");
