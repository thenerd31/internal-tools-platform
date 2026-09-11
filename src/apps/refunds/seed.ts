import { FakePaymentsProvider } from "@/platform/adapters/payments";
import type { Db } from "@/platform/db";
import { customers, transactions } from "./schema";

const SEED_CUSTOMERS = [
  { id: "cust-1", name: "Ada Lovelace", email: "ada@example.com" },
  { id: "cust-2", name: "Grace Hopper", email: "grace@example.com" },
  { id: "cust-3", name: "Alan Turing", email: "alan@example.com" },
  { id: "cust-4", name: "Katherine Johnson", email: "katherine@example.com" },
  { id: "cust-5", name: "Edsger Dijkstra", email: "edsger@example.com" },
];

/** Idempotent: skips when customers already exist. Writes no audit rows. */
export function seed(db: Db): void {
  const existing = db.select({ id: customers.id }).from(customers).limit(1).all();
  if (existing.length > 0) return;

  const payments = new FakePaymentsProvider();
  const now = new Date().toISOString();
  for (const c of SEED_CUSTOMERS) {
    db.insert(customers)
      .values({ id: c.id, name: c.name, email: c.email, createdAt: now })
      .run();
    for (const t of payments.listTransactions(c.id)) {
      db.insert(transactions)
        .values({
          id: t.id,
          customerId: t.customerId,
          amountCents: t.amountCents,
          currency: t.currency,
          refundedCents: 0,
          createdAt: t.createdAt,
          version: 1,
        })
        .run();
    }
  }
}
