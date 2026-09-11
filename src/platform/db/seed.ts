import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { append } from "../audit";
import { getManifests } from "../registry";
import type { Role } from "../types";
import type { Db } from ".";
import { users } from "./schema";

export const SEED_USERS: { id: string; email: string; name: string; role: Role }[] = [
  { id: "seed-analyst", email: "analyst@demo.local", name: "Demo Analyst", role: "analyst" },
  { id: "seed-supervisor", email: "supervisor@demo.local", name: "Demo Supervisor", role: "supervisor" },
  { id: "seed-agent", email: "agent@demo.local", name: "Demo Agent", role: "agent" },
  { id: "seed-lead", email: "lead@demo.local", name: "Demo Lead", role: "lead" },
  { id: "seed-admin", email: "admin@demo.local", name: "Demo Admin", role: "admin" },
];

/**
 * Seeds users (password "demo", bcrypt cost 10), appends one audit row per
 * user creation with actor_id "system", then calls each manifest.seed.
 */
export function seed(db: Db): void {
  const passwordHash = bcrypt.hashSync("demo", 10);
  db.transaction((tx) => {
    for (const u of SEED_USERS) {
      const existing = tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, u.email))
        .get();
      if (existing) continue;
      const row = { ...u, passwordHash, version: 1, createdAt: new Date().toISOString() };
      tx.insert(users).values(row).run();
      append(tx, {
        actorId: "system",
        app: "platform",
        action: "platform.user.create",
        entityType: "user",
        entityId: u.id,
        before: null,
        after: { id: u.id, email: u.email, name: u.name, role: u.role },
        reason: null,
      });
    }
    for (const manifest of getManifests()) {
      manifest.seed?.(tx);
    }
  });
}
