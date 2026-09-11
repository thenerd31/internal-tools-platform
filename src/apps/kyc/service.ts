import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";
import { append } from "@/platform/audit";
import { authorize } from "@/platform/authz";
import { getDb, optimisticUpdate, withMutation, type Db } from "@/platform/db";
import { auditLog } from "@/platform/db/schema";
import { ConflictError, ForbiddenError, ValidationError } from "@/platform/errors";
import type { Actor } from "@/platform/types";
import { kycCases, SUPERVISOR_THRESHOLD, type Decision, type KycCase, type KycStatus } from "./schema";

const MAX_REASON_LENGTH = 2000;

function getCase(id: string, db: Db): KycCase | undefined {
  return db.select().from(kycCases).where(eq(kycCases.id, id)).get();
}

function snapshot(kase: KycCase): KycCase {
  return { ...kase };
}

export async function claimCaseAs(
  actor: Actor,
  id: string,
  version: number,
  db: Db = getDb(),
): Promise<KycCase> {
  const kase = getCase(id, db);
  if (!kase) throw new ValidationError("Case not found");
  authorize(actor, "kyc.case.claim", kase);
  if (kase.version !== version) throw new ConflictError();
  if (kase.status !== "pending" && kase.status !== "needs_info") {
    throw new ValidationError("Case is not claimable");
  }

  const now = new Date().toISOString();
  const updated = {
    ...kase,
    status: "in_review" as const,
    assigneeId: actor.id,
    updatedAt: now,
    version: kase.version + 1,
  };
  return withMutation(
    actor,
    (tx) => {
      optimisticUpdate(tx, kycCases, id, version, {
        status: updated.status,
        assigneeId: updated.assigneeId,
        updatedAt: updated.updatedAt,
      });
      append(tx, {
        actorId: actor.id,
        app: "kyc",
        action: "kyc.case.claim",
        entityType: "kyc_case",
        entityId: id,
        before: snapshot(kase),
        after: snapshot(updated),
        reason: null,
      });
      return updated;
    },
    db,
  );
}

export async function claimNextAs(
  actor: Actor,
  db: Db = getDb(),
): Promise<KycCase> {
  let lastConflict: ConflictError | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const conditions = [
      isNull(kycCases.assigneeId),
      eq(kycCases.status, "pending"),
    ];
    if (actor.role === "analyst") {
      conditions.push(lt(kycCases.riskScore, SUPERVISOR_THRESHOLD));
    }
    const candidate = db
      .select()
      .from(kycCases)
      .where(and(...conditions))
      .orderBy(desc(kycCases.riskScore), asc(kycCases.createdAt))
      .limit(1)
      .get();
    if (!candidate) throw new ValidationError("No claimable cases");
    try {
      return await claimCaseAs(actor, candidate.id, candidate.version, db);
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      lastConflict = error;
    }
  }
  if (lastConflict) throw lastConflict;
  throw new ValidationError("No claimable cases");
}

export async function decideCaseAs(
  actor: Actor,
  id: string,
  version: number,
  decision: Decision,
  reason: string,
  db: Db = getDb(),
): Promise<KycCase> {
  const kase = getCase(id, db);
  if (!kase) throw new ValidationError("Case not found");
  authorize(actor, "kyc.case.decide", kase);
  if (kase.version !== version) throw new ConflictError();
  if (
    decision !== "approved" &&
    decision !== "rejected" &&
    decision !== "needs_info"
  ) {
    throw new ValidationError("Invalid decision");
  }
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    throw new ValidationError(
      decision === "needs_info"
        ? "Note must be at least 10 characters"
        : "Reason must be at least 10 characters",
    );
  }
  if (trimmedReason.length > MAX_REASON_LENGTH) {
    throw new ValidationError("Reason must be at most 2000 characters");
  }
  if (kase.status !== "in_review") {
    throw new ValidationError("Case is not in review");
  }

  const now = new Date().toISOString();
  const updated = {
    ...kase,
    status: decision,
    decisionReason: trimmedReason,
    decidedBy: actor.id,
    decidedAt: now,
    assigneeId: decision === "needs_info" ? null : kase.assigneeId,
    updatedAt: now,
    version: kase.version + 1,
  };
  return withMutation(
    actor,
    (tx) => {
      optimisticUpdate(tx, kycCases, id, version, {
        status: updated.status,
        decisionReason: updated.decisionReason,
        decidedBy: updated.decidedBy,
        decidedAt: updated.decidedAt,
        assigneeId: updated.assigneeId,
        updatedAt: updated.updatedAt,
      });
      append(tx, {
        actorId: actor.id,
        app: "kyc",
        action: "kyc.case.decide",
        entityType: "kyc_case",
        entityId: id,
        before: snapshot(kase),
        after: snapshot(updated),
        reason: trimmedReason,
      });
      return updated;
    },
    db,
  );
}

export async function listCasesFor(
  actor: Actor,
  status?: KycStatus,
  db: Db = getDb(),
): Promise<KycCase[]> {
  const conditions = [];
  // Read scope, not authorization: supervisors and admins see every case,
  // everyone else sees their own plus unassigned. Access is still enforced
  // per-case by the kyc.case.view policy in getCaseFor.
  if (actor.role !== "supervisor" && actor.role !== "admin") {
    conditions.push(
      or(eq(kycCases.assigneeId, actor.id), isNull(kycCases.assigneeId)),
    );
  }
  if (status) conditions.push(eq(kycCases.status, status));
  return db
    .select()
    .from(kycCases)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(kycCases.riskScore), asc(kycCases.createdAt))
    .all();
}

export async function getCaseFor(
  actor: Actor,
  id: string,
  db: Db = getDb(),
): Promise<KycCase | null> {
  const kase = getCase(id, db);
  if (!kase) return null;
  authorize(actor, "kyc.case.view", kase);
  return kase;
}

export async function getCaseHistory(
  actor: Actor,
  id: string,
  db: Db = getDb(),
) {
  const kase = getCase(id, db);
  if (!kase) return [];
  authorize(actor, "kyc.case.view", kase);
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.app, "kyc"), eq(auditLog.entityId, id)))
    .orderBy(asc(auditLog.seq))
    .all();
}

export function decideDisabledReason(actor: Actor, kase: KycCase): string | null {
  // authorize is the gate: if the kyc.case.decide policy denies, the form is
  // disabled. The analyst branches below only choose a specific message —
  // policies return boolean, so the denial reason has to be reconstructed here.
  try {
    authorize(actor, "kyc.case.decide", kase);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
    if (actor.role === "analyst" && kase.riskScore >= SUPERVISOR_THRESHOLD) {
      return "Cases with risk score 70+ require a supervisor";
    }
    if (actor.role === "analyst" && kase.assigneeId !== actor.id) {
      return "Only the assignee can decide this case";
    }
    return "Your role cannot decide cases";
  }
  if (kase.status === "approved" || kase.status === "rejected") {
    return "Case is approved/rejected — terminal";
  }
  if (kase.status !== "in_review") return "Case is not in review";
  return null;
}
