import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { append } from "../src/platform/audit";
import { optimisticUpdate, withMutation } from "../src/platform/db";
import { auditLog, users } from "../src/platform/db/schema";
import { ConflictError } from "../src/platform/errors";
import { actors, testDb } from "./helpers";

function insertUser(db: ReturnType<typeof testDb>, id: string) {
  db.insert(users)
    .values({
      id,
      email: `${id}@demo.local`,
      name: id,
      role: "analyst",
      passwordHash: "x",
      version: 1,
      createdAt: new Date().toISOString(),
    })
    .run();
}

describe("optimisticUpdate", () => {
  it("increments version on success", () => {
    const db = testDb();
    insertUser(db, "u1");
    optimisticUpdate(db, users, "u1", 1, { name: "Renamed" });
    const row = db.select().from(users).where(eq(users.id, "u1")).get()!;
    expect(row.name).toBe("Renamed");
    expect(row.version).toBe(2);
  });

  it("throws ConflictError on a stale version and changes nothing", () => {
    const db = testDb();
    insertUser(db, "u1");
    expect(() => optimisticUpdate(db, users, "u1", 99, { name: "Nope" })).toThrow(
      ConflictError,
    );
    const row = db.select().from(users).where(eq(users.id, "u1")).get()!;
    expect(row.name).toBe("u1");
    expect(row.version).toBe(1);
  });
});

describe("withMutation", () => {
  it("persists entity update and audit row on success", () => {
    const db = testDb();
    insertUser(db, "u1");
    withMutation(
      actors.analyst,
      (tx) => {
        optimisticUpdate(tx, users, "u1", 1, { name: "Done" });
        append(tx, {
          actorId: actors.analyst.id,
          app: "platform",
          action: "platform.user.rename",
          entityType: "user",
          entityId: "u1",
          before: { name: "u1" },
          after: { name: "Done" },
        });
      },
      db,
    );
    expect(db.select().from(users).get()!.name).toBe("Done");
    expect(db.select().from(auditLog).all()).toHaveLength(1);
  });

  it("rolls back everything when fn throws after audit.append", () => {
    const db = testDb();
    insertUser(db, "u1");
    expect(() =>
      withMutation(
        actors.analyst,
        (tx) => {
          optimisticUpdate(tx, users, "u1", 1, { name: "Boom" });
          append(tx, {
            actorId: actors.analyst.id,
            app: "platform",
            action: "platform.user.rename",
            entityType: "user",
            entityId: "u1",
            before: { name: "u1" },
            after: { name: "Boom" },
          });
          throw new Error("boom");
        },
        db,
      ),
    ).toThrow("boom");
    const row = db.select().from(users).where(eq(users.id, "u1")).get()!;
    expect(row.name).toBe("u1");
    expect(row.version).toBe(1);
    expect(db.select().from(auditLog).all()).toHaveLength(0);
  });
});
