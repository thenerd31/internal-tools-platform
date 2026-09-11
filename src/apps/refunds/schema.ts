import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  refundedCents: integer("refunded_cents").notNull().default(0),
  createdAt: text("created_at").notNull(),
  version: integer("version").notNull().default(1),
});

export const refunds = sqliteTable("refunds", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull(),
  requestedBy: text("requested_by").notNull(),
  approvedBy: text("approved_by"),
  providerRef: text("provider_ref"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
