import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/platform/db/schema.ts", "./src/apps/*/schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: "./data/app.db" },
});
