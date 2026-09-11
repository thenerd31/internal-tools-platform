import { createHash } from "node:crypto";

export interface PaymentTransaction {
  id: string;
  customerId: string;
  amountCents: number;
  currency: string;
  createdAt: string;
}

export interface RefundResult {
  providerRef: string;
  status: string;
}

export interface PaymentsProvider {
  listTransactions(customerId: string): PaymentTransaction[];
  refund(input: {
    transactionId: string;
    amountCents: number;
    idempotencyKey: string;
  }): RefundResult;
}

/** Deterministic fake; in-memory idempotency map returns the same providerRef for a repeated key. */
export class FakePaymentsProvider implements PaymentsProvider {
  private idempotency = new Map<string, RefundResult>();

  listTransactions(customerId: string): PaymentTransaction[] {
    const h = createHash("sha256").update(customerId).digest();
    return Array.from({ length: 4 }, (_, i) => {
      const amountCents = 1000 + (h.readUInt32BE(i * 4) % 250000);
      return {
        id: `txn_${createHash("sha256").update(`${customerId}:${i}`).digest("hex").slice(0, 12)}`,
        customerId,
        amountCents,
        currency: "USD",
        createdAt: new Date(2025, 0, i + 1).toISOString(),
      };
    });
  }

  refund(input: {
    transactionId: string;
    amountCents: number;
    idempotencyKey: string;
  }): RefundResult {
    const hit = this.idempotency.get(input.idempotencyKey);
    if (hit) return hit;
    const result: RefundResult = {
      providerRef: `fake_${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 16)}`,
      status: "succeeded",
    };
    this.idempotency.set(input.idempotencyKey, result);
    return result;
  }
}
