import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FakePaymentsProvider } from "@/platform/adapters/payments";
import { auditLog } from "@/platform/db/schema";
import type { Db } from "@/platform/db";
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "@/platform/errors";
import { setManifestsForTests } from "@/platform/registry";
import type { Actor } from "@/platform/types";
import { actors, testDb } from "../../../tests/helpers";
import manifest from "./manifest";
import { refunds, transactions } from "./schema";
import {
  approveRefundAs,
  rejectRefundAs,
  requestRefundAs,
} from "./service";

const lead2: Actor = {
  id: "u-lead2",
  email: "lead2@demo.local",
  name: "Demo Lead 2",
  role: "lead",
};

const uuid = () => crypto.randomUUID();
const REASON = "Customer reported a duplicate charge";

function insertTxn(
  db: Db,
  { amountCents = 100000, refundedCents = 0 } = {},
): string {
  const id = `txn_${crypto.randomUUID().slice(0, 12)}`;
  db.insert(transactions)
    .values({
      id,
      customerId: "cust-test",
      amountCents,
      currency: "USD",
      refundedCents,
      createdAt: new Date().toISOString(),
      version: 1,
    })
    .run();
  return id;
}

function auditActionsFor(db: Db, refundId: string): string[] {
  return db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(eq(auditLog.entityId, refundId))
    .all()
    .map((r) => r.action);
}

describe("refunds", () => {
  beforeAll(() => setManifestsForTests([manifest]));
  afterAll(() => setManifestsForTests(null));

  function setup() {
    const db = testDb();
    const payments = new FakePaymentsProvider();
    const spy = vi.spyOn(payments, "refund");
    return { db, payments, spy, deps: { db, payments } };
  }

  it("AC1: agent at ceiling issues immediately", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    const key = uuid();
    const r = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50000,
      reason: REASON,
      idempotencyKey: key,
    }, deps);
    expect(r.status).toBe("issued");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: key }),
    );
    expect(r.providerRef).toBe(spy.mock.results[0].value.providerRef);
    const txn = db.select().from(transactions).where(eq(transactions.id, txnId)).get()!;
    expect(txn.refundedCents).toBe(50000);
    const actions = auditActionsFor(db, r.id);
    expect(actions).toContain("refunds.refund.request");
    expect(actions).toContain("refunds.refund.issue");
  });

  it("AC2: agent above ceiling creates pending_approval", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    const r = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50001,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    expect(r.status).toBe("pending_approval");
    expect(spy).not.toHaveBeenCalled();
    const txn = db.select().from(transactions).where(eq(transactions.id, txnId)).get()!;
    expect(txn.refundedCents).toBe(0);
  });

  it("AC3: lead approves pending refund; stale txn version conflicts", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    const pending = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50001,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    const approved = approveRefundAs(actors.lead, { id: pending.id, version: 1 }, deps);
    expect(approved.status).toBe("issued");
    expect(approved.approvedBy).toBe(actors.lead.id);
    expect(approved.providerRef).toMatch(/^fake_/);
    expect(spy).toHaveBeenCalledTimes(1);
    const txn = db.select().from(transactions).where(eq(transactions.id, txnId)).get()!;
    expect(txn.refundedCents).toBe(50001);
    expect(auditActionsFor(db, pending.id)).toContain("refunds.refund.approve");

    // Second scenario: rows changed underneath the request -> 409. The
    // transaction is re-read inside withMutation so a bump before approve is
    // seen fresh; the stale-write guard trips on the refund's own version.
    const txnId2 = insertTxn(db, { amountCents: 100000 });
    const pending2 = requestRefundAs(actors.agent, {
      transactionId: txnId2,
      amountCents: 50001,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    db.update(transactions).set({ version: 99 }).where(eq(transactions.id, txnId2)).run();
    db.update(refunds).set({ version: 99 }).where(eq(refunds.id, pending2.id)).run();
    expect(() =>
      approveRefundAs(actors.lead, { id: pending2.id, version: 1 }, deps),
    ).toThrow(ConflictError);
  });

  it("AC4: requester cannot approve own refund; another lead can", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    db.insert(refunds)
      .values({
        id: `rf_${crypto.randomUUID()}`,
        transactionId: txnId,
        amountCents: 50001,
        reason: REASON,
        idempotencyKey: uuid(),
        status: "pending_approval",
        requestedBy: actors.lead.id,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();
    const row = db.select().from(refunds).all()[0];
    // Agent is not a lead.
    expect(() =>
      approveRefundAs(actors.agent, { id: row.id, version: 1 }, deps),
    ).toThrow(ForbiddenError);
    // Lead cannot approve their own request.
    expect(() =>
      approveRefundAs(actors.lead, { id: row.id, version: 1 }, deps),
    ).toThrow(ForbiddenError);
    const ok = approveRefundAs(lead2, { id: row.id, version: 1 }, deps);
    expect(ok.status).toBe("issued");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("AC5: repeated idempotency key returns existing refund", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    const key = uuid();
    const first = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50000,
      reason: REASON,
      idempotencyKey: key,
    }, deps);
    const second = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50000,
      reason: REASON,
      idempotencyKey: key,
    }, deps);
    expect(second.id).toBe(first.id);
    expect(db.select().from(refunds).all()).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("AC6: amount out of range or bad key is rejected", () => {
    const { db, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000, refundedCents: 70000 });
    for (const amountCents of [30001, 0, -5]) {
      expect(() =>
        requestRefundAs(actors.agent, {
          transactionId: txnId,
          amountCents,
          reason: REASON,
          idempotencyKey: uuid(),
        }, deps),
      ).toThrow(ValidationError);
    }
    expect(() =>
      requestRefundAs(actors.agent, {
        transactionId: txnId,
        amountCents: 1000,
        reason: REASON,
        idempotencyKey: "not-a-uuid",
      }, deps),
    ).toThrow(ValidationError);
  });

  it("AC7: short reason is rejected", () => {
    const { db, deps } = setup();
    const txnId = insertTxn(db);
    expect(() =>
      requestRefundAs(actors.agent, {
        transactionId: txnId,
        amountCents: 1000,
        reason: "short",
        idempotencyKey: uuid(),
      }, deps),
    ).toThrow(ValidationError);
  });

  it("AC8: lead rejects pending refund; provider not called", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    const pending = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50001,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    const rejected = rejectRefundAs(actors.lead, {
      id: pending.id,
      version: 1,
      reason: "Not a valid refund request",
    }, deps);
    expect(rejected.status).toBe("rejected");
    expect(auditActionsFor(db, pending.id)).toContain("refunds.refund.reject");
    expect(spy).not.toHaveBeenCalled();

    const pending2 = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 40000 + 1,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    expect(() =>
      rejectRefundAs(actors.lead, { id: pending2.id, version: 1, reason: "short" }, deps),
    ).toThrow(ValidationError);
  });

  it("AC9: second approver with stale version gets ConflictError", () => {
    const { db, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    const pending = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50001,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    approveRefundAs(actors.lead, { id: pending.id, version: 1 }, deps);
    expect(() =>
      approveRefundAs(lead2, { id: pending.id, version: 1 }, deps),
    ).toThrow(ConflictError);
  });

  it("AC10: lead requests 200000 and issues directly", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 250000 });
    const r = requestRefundAs(actors.lead, {
      transactionId: txnId,
      amountCents: 200000,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    expect(r.status).toBe("issued");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("AC11: terminal refunds reject further transitions", () => {
    const { db, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 100000 });
    const issued = requestRefundAs(actors.agent, {
      transactionId: txnId,
      amountCents: 50000,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    const v = issued.version;
    expect(() =>
      approveRefundAs(actors.lead, { id: issued.id, version: v }, deps),
    ).toThrow(ValidationError);
    expect(() =>
      rejectRefundAs(actors.lead, { id: issued.id, version: v, reason: REASON }, deps),
    ).toThrow(ValidationError);

    const txnId2 = insertTxn(db, { amountCents: 100000 });
    const pending = requestRefundAs(actors.agent, {
      transactionId: txnId2,
      amountCents: 50001,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    const rejected = rejectRefundAs(actors.lead, {
      id: pending.id,
      version: 1,
      reason: REASON,
    }, deps);
    expect(() =>
      approveRefundAs(actors.lead, { id: rejected.id, version: rejected.version }, deps),
    ).toThrow(ValidationError);
  });

  it("admin passes every policy and issues directly", () => {
    const { db, spy, deps } = setup();
    const txnId = insertTxn(db, { amountCents: 250000 });
    const r = requestRefundAs(actors.admin, {
      transactionId: txnId,
      amountCents: 200000,
      reason: REASON,
      idempotencyKey: uuid(),
    }, deps);
    expect(r.status).toBe("issued");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
