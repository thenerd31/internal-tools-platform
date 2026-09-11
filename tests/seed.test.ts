import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { verify } from "../src/platform/audit";
import { auditLog, users } from "../src/platform/db/schema";
import { seed, SEED_USERS } from "../src/platform/db/seed";
import { testDb } from "./helpers";

describe("seed", () => {
  it("creates all five demo users with bcrypt 'demo' passwords", () => {
    const db = testDb();
    seed(db);
    const rows = db.select().from(users).all();
    expect(rows).toHaveLength(5);
    for (const u of SEED_USERS) {
      const row = rows.find((r) => r.email === u.email)!;
      expect(row.name).toBe(u.name);
      expect(row.role).toBe(u.role);
      expect(bcrypt.compareSync("demo", row.passwordHash)).toBe(true);
    }
  });

  it("appends 'system' audit rows so a fresh DB chain verifies", () => {
    const db = testDb();
    seed(db);
    const logs = db.select().from(auditLog).all();
    expect(logs).toHaveLength(5);
    expect(logs.every((l) => l.actorId === "system")).toBe(true);
    expect(verify(db)).toEqual({ ok: true, count: 5 });
  });
});
