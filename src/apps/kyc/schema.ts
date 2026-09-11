import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const kycCases = sqliteTable("kyc_cases", {
  id: text("id").primaryKey(),
  caseRef: text("case_ref").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  riskScore: integer("risk_score").notNull(),
  vendorReasonsJson: text("vendor_reasons_json").notNull(),
  documentUrl: text("document_url").notNull(),
  status: text("status").notNull(),
  assigneeId: text("assignee_id"),
  decisionReason: text("decision_reason"),
  decidedBy: text("decided_by"),
  decidedAt: text("decided_at"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type KycCase = typeof kycCases.$inferSelect;
export type KycStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "needs_info";
export type Decision = "approved" | "rejected" | "needs_info";

export const SUPERVISOR_THRESHOLD = 70;
