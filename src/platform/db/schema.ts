import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  actorId: text("actor_id").notNull(),
  app: text("app").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
});
