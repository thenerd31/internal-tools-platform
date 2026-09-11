import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getPaymentsProvider } from "@/platform/adapters";
import type { PaymentsProvider } from "@/platform/adapters/payments";
import { append } from "@/platform/audit";
import { authorize } from "@/platform/authz";
import { getDb, optimisticUpdate, withMutation, type Db } from "@/platform/db";
import { ConflictError, ValidationError } from "@/platform/errors";
import type { Actor } from "@/platform/types";
import { customers, refunds, transactions, type Refund, type Transaction } from "./schema";

export const AGENT_CEILING_CENTS = 50000;
export const MIN_REASON_LENGTH = 10;

export interface RefundDeps {
  db: Db;
  payments: PaymentsProvider;
}

const defaultDeps = (): RefundDeps => ({
  db: getDb(),
  payments: getPaymentsProvider(),
});

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function now(): string {
  return new Date().toISOString();
}

function snapshot(refund: Refund): Refund {
  return { ...refund };
}

function assertReason(reason: string): void {
  if (reason.trim().length < MIN_REASON_LENGTH) {
    throw new ValidationError("Reason must be at least 10 characters");
  }
}

function getRefund(db: Db, id: string): Refund | undefined {
  return db.select().from(refunds).where(eq(refunds.id, id)).get();
}

function getTransaction(db: Db, id: string): Transaction | undefined {
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

function issueWithin(
  tx: Db,
  actor: Actor,
  refund: Refund,
  txn: Transaction,
  payments: PaymentsProvider,
  approvedBy: string | null,
): Refund {
  // Bump status first so a stale version 409s before touching the provider.
  optimisticUpdate(tx, refunds, refund.id, refund.version, {
    status: "issued",
    approvedBy,
    updatedAt: now(),
  });
  const result = payments.refund({
    transactionId: txn.id,
    amountCents: refund.amountCents,
    idempotencyKey: refund.idempotencyKey,
  });
  optimisticUpdate(tx, refunds, refund.id, refund.version + 1, {
    providerRef: result.providerRef,
    updatedAt: now(),
  });
  optimisticUpdate(tx, transactions, txn.id, txn.version, {
    refundedCents: txn.refundedCents + refund.amountCents,
  });
  const updated = getRefund(tx, refund.id)!;
  append(tx, {
    actorId: actor.id,
    app: "refunds",
    action: "refunds.refund.issue",
    entityType: "refund",
    entityId: refund.id,
    before: snapshot(refund),
    after: snapshot(updated),
    reason: refund.reason,
  });
  return updated;
}

export function requestRefundAs(
  actor: Actor,
  input: {
    transactionId: string;
    amountCents: number;
    reason: string;
    idempotencyKey: string;
  },
  deps: RefundDeps = defaultDeps(),
): Refund {
  authorize(actor, "refunds.refund.request");
  if (!UUID_V4_RE.test(input.idempotencyKey)) {
    throw new ValidationError("idempotencyKey must be a UUID v4");
  }
  assertReason(input.reason);
  if (!Number.isInteger(input.amountCents)) {
    throw new ValidationError("amountCents must be an integer");
  }

  return withMutation(
    actor,
    (tx) => {
      const existing = tx
        .select()
        .from(refunds)
        .where(eq(refunds.idempotencyKey, input.idempotencyKey))
        .get();
      if (existing) return existing;

      const txn = getTransaction(tx, input.transactionId);
      if (!txn) throw new ValidationError("Transaction not found");
      const remaining = txn.amountCents - txn.refundedCents;
      if (input.amountCents < 1 || input.amountCents > remaining) {
        throw new ValidationError(
          `Amount must be between 1 and ${remaining} cents`,
        );
      }

      const id = `rf_${crypto.randomUUID()}`;
      const ts = now();
      const row: Refund = {
        id,
        transactionId: txn.id,
        amountCents: input.amountCents,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        status: "pending_approval",
        requestedBy: actor.id,
        approvedBy: null,
        providerRef: null,
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      };
      tx.insert(refunds).values(row).run();
      append(tx, {
        actorId: actor.id,
        app: "refunds",
        action: "refunds.refund.request",
        entityType: "refund",
        entityId: id,
        before: null,
        after: snapshot(row),
        reason: input.reason,
      });

      const issueNow =
        actor.role !== "agent" || input.amountCents <= AGENT_CEILING_CENTS;
      if (issueNow) {
        return issueWithin(tx, actor, row, txn, deps.payments, null);
      }
      return row;
    },
    deps.db,
  );
}

export function approveRefundAs(
  actor: Actor,
  input: { id: string; version: number },
  deps: RefundDeps = defaultDeps(),
): Refund {
  const refund = getRefund(deps.db, input.id);
  if (!refund) throw new ValidationError("Refund not found");
  authorize(actor, "refunds.refund.approve", refund);
  if (refund.version !== input.version) throw new ConflictError();
  if (refund.status !== "pending_approval") {
    throw new ValidationError(`Cannot approve a ${refund.status} refund`);
  }
  return withMutation(
    actor,
    (tx) => {
      const fresh = getRefund(tx, input.id);
      if (!fresh || fresh.version !== input.version) throw new ConflictError();
      const txn = getTransaction(tx, fresh.transactionId);
      if (!txn) throw new ValidationError("Transaction not found");
      const issued = issueWithin(tx, actor, fresh, txn, deps.payments, actor.id);
      append(tx, {
        actorId: actor.id,
        app: "refunds",
        action: "refunds.refund.approve",
        entityType: "refund",
        entityId: fresh.id,
        before: snapshot(fresh),
        after: snapshot(issued),
        reason: fresh.reason,
      });
      return issued;
    },
    deps.db,
  );
}

export function rejectRefundAs(
  actor: Actor,
  input: { id: string; version: number; reason: string },
  deps: RefundDeps = defaultDeps(),
): Refund {
  const refund = getRefund(deps.db, input.id);
  if (!refund) throw new ValidationError("Refund not found");
  authorize(actor, "refunds.refund.reject", refund);
  assertReason(input.reason);
  if (refund.status !== "pending_approval") {
    throw new ValidationError(`Cannot reject a ${refund.status} refund`);
  }

  return withMutation(
    actor,
    (tx) => {
      optimisticUpdate(tx, refunds, refund.id, input.version, {
        status: "rejected",
        approvedBy: actor.id,
        updatedAt: now(),
      });
      const updated = getRefund(tx, refund.id)!;
      append(tx, {
        actorId: actor.id,
        app: "refunds",
        action: "refunds.refund.reject",
        entityType: "refund",
        entityId: refund.id,
        before: snapshot(refund),
        after: snapshot(updated),
        reason: input.reason,
      });
      return updated;
    },
    deps.db,
  );
}

export function formatCents(cents: number, currency = "USD"): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function searchCustomers(db: Db, q: string) {
  const term = q.trim().toLowerCase();
  if (!term) {
    return db.select().from(customers).orderBy(asc(customers.name)).all();
  }
  const pattern = `%${term}%`;
  return db
    .select()
    .from(customers)
    .where(
      or(
        like(sql`lower(${customers.name})`, pattern),
        like(sql`lower(${customers.email})`, pattern),
      ),
    )
    .orderBy(asc(customers.name))
    .all();
}

export function getCustomer(db: Db, id: string) {
  return db.select().from(customers).where(eq(customers.id, id)).get();
}

export function listTransactions(db: Db, customerId: string) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.customerId, customerId))
    .orderBy(asc(transactions.createdAt))
    .all();
}

export function listRefundsForCustomer(db: Db, customerId: string) {
  const txns = listTransactions(db, customerId);
  if (txns.length === 0) return [];
  return db
    .select()
    .from(refunds)
    .where(
      inArray(
        refunds.transactionId,
        txns.map((t) => t.id),
      ),
    )
    .orderBy(desc(refunds.createdAt))
    .all();
}

export function listPendingRefunds(db: Db) {
  return db
    .select({
      refund: refunds,
      transaction: transactions,
      customerName: customers.name,
    })
    .from(refunds)
    .innerJoin(transactions, eq(refunds.transactionId, transactions.id))
    .innerJoin(customers, eq(transactions.customerId, customers.id))
    .where(and(eq(refunds.status, "pending_approval")))
    .orderBy(asc(refunds.createdAt))
    .all();
}
