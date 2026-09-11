import { createHash } from "node:crypto";
import { asc, desc } from "drizzle-orm";
import type { Db } from "../db";
import { auditLog } from "../db/schema";

export interface AuditEntry {
  actorId: string;
  app: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

export type VerifyResult =
  | { ok: true; count: number }
  | { ok: false; brokenSeq: number };

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Snapshots serialize with sorted keys so the hash is canonical. */
export function stableStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(sortDeep(value));
}

type AuditRow = typeof auditLog.$inferSelect;

/** Canonical hash: prev_hash|seq|actor_id|app|action|entity_type|entity_id|before_json|after_json|reason|created_at; nulls as empty string. */
export function hashRow(row: AuditRow): string {
  const fields = [
    row.prevHash,
    String(row.seq),
    row.actorId,
    row.app,
    row.action,
    row.entityType,
    row.entityId,
    row.beforeJson ?? "",
    row.afterJson ?? "",
    row.reason ?? "",
    row.createdAt,
  ];
  return createHash("sha256").update(fields.join("|")).digest("hex");
}

/** Append-only. Call inside withMutation — never outside a mutation transaction. */
export function append(tx: Db, entry: AuditEntry): void {
  const last = tx
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.seq))
    .limit(1)
    .all()[0];
  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.hash ?? "0";
  const row: Omit<AuditRow, "hash"> & { hash: string } = {
    seq,
    actorId: entry.actorId,
    app: entry.app,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeJson: stableStringify(entry.before ?? null),
    afterJson: stableStringify(entry.after ?? null),
    reason: entry.reason ?? null,
    createdAt: new Date().toISOString(),
    prevHash,
    hash: "",
  };
  row.hash = hashRow(row as AuditRow);
  tx.insert(auditLog).values(row).run();
}

/** Walks rows in seq order: checks prev_hash linkage and recomputes each hash. */
export function verify(db: Db): VerifyResult {
  const rows = db.select().from(auditLog).orderBy(asc(auditLog.seq)).all();
  let prevHash = "0";
  for (const row of rows) {
    if (row.prevHash !== prevHash || hashRow(row) !== row.hash) {
      return { ok: false, brokenSeq: row.seq };
    }
    prevHash = row.hash;
  }
  return { ok: true, count: rows.length };
}
