import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { auditLog } from "@/platform/db/schema";
import { setManifestsForTests } from "@/platform/registry";
import { ConflictError, ForbiddenError, ValidationError } from "@/platform/errors";
import { actors, testDb } from "../../../tests/helpers";
import type { Db } from "@/platform/db";
import { kycCases, type KycCase } from "./schema";
import kycManifest from "./manifest";
import { seedKyc } from "./seed";
import {
  claimCaseAs,
  claimNextAs,
  decideCaseAs,
  decideDisabledReason,
  getCaseFor,
  getCaseHistory,
  listCasesFor,
} from "./service";

function insertCase(db: Db, partial: Partial<KycCase> = {}): KycCase {
  const row: KycCase = {
    id: "case-1",
    caseRef: "KYC-1",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    riskScore: 40,
    vendorReasonsJson: JSON.stringify(["DOCUMENT_UNCLEAR"]),
    documentUrl: "/placeholder-docs/KYC-1",
    status: "pending",
    assigneeId: null,
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    version: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...partial,
  };
  db.insert(kycCases).values(row).run();
  return row;
}

function auditRows(db: Db, id: string) {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.app, "kyc"), eq(auditLog.entityId, id)))
    .all();
}

beforeEach(() => setManifestsForTests([kycManifest]));
afterEach(() => setManifestsForTests(null));

describe("KYC review queue", () => {
  it("AC1: claimNext skips high risk and claims the highest eligible score", async () => {
    const db = testDb();
    insertCase(db, { id: "case-80", riskScore: 80, createdAt: "2025-01-01T00:00:00.000Z" });
    insertCase(db, { id: "case-60", riskScore: 60, createdAt: "2025-01-01T00:01:00.000Z" });
    insertCase(db, { id: "case-40", riskScore: 40, createdAt: "2025-01-01T00:02:00.000Z" });

    const result = await claimNextAs(actors.analyst, db);

    expect(result.id).toBe("case-60");
    expect(result.status).toBe("in_review");
    expect(result.assigneeId).toBe(actors.analyst.id);
    expect(auditRows(db, "case-60")).toHaveLength(1);
    expect(auditRows(db, "case-60")[0].action).toBe("kyc.case.claim");
  });

  it("AC2: decide approved stores the decision and full audit snapshots", async () => {
    const db = testDb();
    insertCase(db, { status: "in_review", assigneeId: actors.analyst.id });

    const result = await decideCaseAs(
      actors.analyst,
      "case-1",
      1,
      "approved",
      "Identity documents verified",
      db,
    );

    expect(result.status).toBe("approved");
    expect(result.decisionReason).toBe("Identity documents verified");
    expect(result.decidedBy).toBe(actors.analyst.id);
    expect(result.decidedAt).toBeTruthy();
    const row = auditRows(db, "case-1")[0];
    expect(row.action).toBe("kyc.case.decide");
    expect(JSON.parse(row.beforeJson!)).toMatchObject({ status: "in_review" });
    expect(JSON.parse(row.afterJson!)).toMatchObject({ status: "approved" });
    expect(row.reason).toBe("Identity documents verified");
  });

  it("AC3: analyst cannot decide an own high-risk case", async () => {
    const db = testDb();
    insertCase(db, {
      status: "in_review",
      assigneeId: actors.analyst.id,
      riskScore: 80,
    });

    await expect(
      decideCaseAs(
        actors.analyst,
        "case-1",
        1,
        "approved",
        "Identity documents verified",
        db,
      ),
    ).rejects.toThrow(ForbiddenError);
    expect(db.select().from(kycCases).get()!.status).toBe("in_review");
    expect(auditRows(db, "case-1")).toHaveLength(0);
  });

  it("AC4: disabled reason explains supervisor requirement", () => {
    const kase = {
      ...insertCase(testDb(), {
        status: "in_review",
        assigneeId: actors.analyst.id,
        riskScore: 80,
      }),
    };
    expect(decideDisabledReason(actors.analyst, kase)).toBe(
      "Cases with risk score 70+ require a supervisor",
    );
    expect(decideDisabledReason(actors.supervisor, kase)).toBeNull();
  });

  it("AC5: supervisor can approve a high-risk case", async () => {
    const db = testDb();
    insertCase(db, { status: "in_review", riskScore: 80 });

    const result = await decideCaseAs(
      actors.supervisor,
      "case-1",
      1,
      "approved",
      "Supervisor completed enhanced review",
      db,
    );

    expect(result.status).toBe("approved");
  });

  it("AC6: short decision reasons fail without mutation or audit", async () => {
    const db = testDb();
    insertCase(db, { status: "in_review", assigneeId: actors.analyst.id });

    await expect(
      decideCaseAs(actors.analyst, "case-1", 1, "approved", "short", db),
    ).rejects.toThrow(ValidationError);
    expect(db.select().from(kycCases).get()!.status).toBe("in_review");
    expect(auditRows(db, "case-1")).toHaveLength(0);
  });

  it("AC7: needs_info clears the assignee and validates the note", async () => {
    const db = testDb();
    insertCase(db, { status: "in_review", assigneeId: actors.analyst.id });

    await expect(
      decideCaseAs(actors.analyst, "case-1", 1, "needs_info", "short", db),
    ).rejects.toThrow(ValidationError);
    const result = await decideCaseAs(
      actors.analyst,
      "case-1",
      1,
      "needs_info",
      "Please provide a clearer identity document",
      db,
    );

    expect(result.status).toBe("needs_info");
    expect(result.assigneeId).toBeNull();
  });

  it("AC8: analyst can claim an unassigned needs_info case", async () => {
    const db = testDb();
    insertCase(db, { status: "needs_info", assigneeId: null });

    const result = await claimCaseAs(actors.analyst, "case-1", 1, db);

    expect(result.status).toBe("in_review");
    expect(result.assigneeId).toBe(actors.analyst.id);
  });

  it("AC9: stale sequential and concurrent decisions produce one conflict", async () => {
    const db = testDb();
    insertCase(db, { status: "in_review" });
    const reason = "Supervisor completed enhanced review";

    const first = decideCaseAs(actors.supervisor, "case-1", 1, "approved", reason, db);
    const second = decideCaseAs(actors.supervisor, "case-1", 1, "approved", reason, db);
    const sequential = await Promise.allSettled([first, second]);
    expect(sequential.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(sequential.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(
      sequential.find((item) => item.status === "rejected")!.reason,
    ).toBeInstanceOf(ConflictError);

    const concurrentDb = testDb();
    insertCase(concurrentDb, { status: "in_review" });
    const concurrent = await Promise.allSettled([
      decideCaseAs(actors.supervisor, "case-1", 1, "approved", reason, concurrentDb),
      decideCaseAs(actors.supervisor, "case-1", 1, "approved", reason, concurrentDb),
    ]);
    expect(concurrent.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(
      concurrent.find((item) => item.status === "rejected")!.reason,
    ).toBeInstanceOf(ConflictError);
    expect(concurrentDb.select().from(kycCases).get()).toMatchObject({
      status: "approved",
      version: 2,
    });
    expect(auditRows(concurrentDb, "case-1")).toHaveLength(1);
  });

  it("AC10: terminal cases cannot be decided", async () => {
    for (const status of ["approved", "rejected"] as const) {
      const db = testDb();
      insertCase(db, { status });
      await expect(
        decideCaseAs(
          actors.supervisor,
          "case-1",
          1,
          "approved",
          "Supervisor completed enhanced review",
          db,
        ),
      ).rejects.toThrow(ValidationError);
    }
  });

  it("AC11: analysts see own and unassigned cases, but not another assignee's", async () => {
    const db = testDb();
    insertCase(db, { id: "own", assigneeId: actors.analyst.id });
    insertCase(db, { id: "other", assigneeId: "other-analyst" });
    insertCase(db, { id: "free", assigneeId: null });

    const rows = await listCasesFor(actors.analyst, undefined, db);

    expect(rows.map((row) => row.id)).toEqual(["own", "free"]);
  });

  it("AC12: supervisors see all cases", async () => {
    const db = testDb();
    insertCase(db, { id: "own", assigneeId: actors.analyst.id });
    insertCase(db, { id: "other", assigneeId: "other-analyst" });
    insertCase(db, { id: "free", assigneeId: null });

    expect(await listCasesFor(actors.supervisor, undefined, db)).toHaveLength(3);
  });

  it("AC13: queue ordering and status filter are applied", async () => {
    const db = testDb();
    insertCase(db, { id: "low", riskScore: 20, status: "pending" });
    insertCase(db, { id: "high", riskScore: 90, status: "approved" });
    insertCase(db, { id: "middle", riskScore: 50, status: "pending" });

    const rows = await listCasesFor(actors.supervisor, undefined, db);
    expect(rows.map((row) => row.id)).toEqual(["high", "middle", "low"]);
    expect(
      (await listCasesFor(actors.supervisor, "pending", db)).map((row) => row.id),
    ).toEqual(["middle", "low"]);
  });

  it("AC14: case history returns claim and decision rows in sequence order", async () => {
    const db = testDb();
    insertCase(db, { status: "pending", assigneeId: null });
    await claimCaseAs(actors.analyst, "case-1", 1, db);
    await decideCaseAs(
      actors.analyst,
      "case-1",
      2,
      "approved",
      "Identity documents verified",
      db,
    );

    const history = await getCaseHistory("case-1", db);
    expect(history.map((row) => row.action)).toEqual([
      "kyc.case.claim",
      "kyc.case.decide",
    ]);
    expect(history[0].seq).toBeLessThan(history[1].seq);
  });

  it("AC15: seeded claimNext selects the highest eligible pending case", async () => {
    const db = testDb();
    seedKyc(db);

    const result = await claimNextAs(actors.analyst, db);

    expect(result.id).toBe("kyc-0010");
    expect(result.riskScore).toBe(68);
    expect(result.status).toBe("in_review");
  });

  it("validates transitions and keeps seed idempotent without audit rows", async () => {
    const db = testDb();
    insertCase(db, { status: "pending", assigneeId: null });
    await expect(
      decideCaseAs(
        actors.supervisor,
        "case-1",
        1,
        "approved",
        "Supervisor completed enhanced review",
        db,
      ),
    ).rejects.toThrow(ValidationError);
    await expect(claimCaseAs(actors.supervisor, "case-1", 1, db)).resolves.toMatchObject({
      status: "in_review",
    });
    await expect(
      claimCaseAs(actors.supervisor, "case-1", 2, db),
    ).rejects.toThrow(ValidationError);

    const seeded = testDb();
    seedKyc(seeded);
    seedKyc(seeded);
    expect(seeded.select().from(kycCases).all()).toHaveLength(30);
    expect(seeded.select().from(auditLog).all()).toHaveLength(0);
  });

  it("returns null for missing cases and rejects inaccessible cases", async () => {
    const db = testDb();
    expect(await getCaseFor(actors.analyst, "missing", db)).toBeNull();
    insertCase(db, { assigneeId: "other-analyst" });
    await expect(getCaseFor(actors.analyst, "case-1", db)).rejects.toThrow(
      ForbiddenError,
    );
  });
});
