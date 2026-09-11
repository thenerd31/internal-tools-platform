import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { append, hashRow, verify } from "../src/platform/audit";
import { auditLog } from "../src/platform/db/schema";
import { testDb } from "./helpers";

function appendRow(db: ReturnType<typeof testDb>, entityId: string) {
  db.transaction((tx) => {
    append(tx, {
      actorId: "system",
      app: "platform",
      action: "platform.test",
      entityType: "user",
      entityId,
      before: null,
      after: { b: 1, a: 2 }, // unsorted keys; canonical stringify sorts them
      reason: null,
    });
  });
}

describe("audit hash chain", () => {
  it("verifies OK on an untouched log", () => {
    const db = testDb();
    appendRow(db, "e1");
    appendRow(db, "e2");
    appendRow(db, "e3");
    const result = verify(db);
    expect(result).toEqual({ ok: true, count: 3 });
  });

  it("fails at exactly the tampered seq when a field is modified", () => {
    const db = testDb();
    appendRow(db, "e1");
    appendRow(db, "e2");
    appendRow(db, "e3");
    db.update(auditLog).set({ reason: "tampered" }).where(eq(auditLog.seq, 2)).run();
    const result = verify(db);
    expect(result).toEqual({ ok: false, brokenSeq: 2 });
  });

  it("fails at exactly the tampered seq when the hash is modified", () => {
    const db = testDb();
    appendRow(db, "e1");
    appendRow(db, "e2");
    db.update(auditLog).set({ hash: "deadbeef" }).where(eq(auditLog.seq, 1)).run();
    const result = verify(db);
    expect(result).toEqual({ ok: false, brokenSeq: 1 });
  });

  it("stores genesis prev_hash '0' and serializes snapshots with sorted keys", () => {
    const db = testDb();
    appendRow(db, "e1");
    const row = db.select().from(auditLog).all()[0];
    expect(row.prevHash).toBe("0");
    expect(row.afterJson).toBe('{"a":2,"b":1}');
    expect(hashRow(row)).toBe(row.hash);
  });
});
