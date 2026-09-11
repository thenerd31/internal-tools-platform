import { afterEach, describe, expect, it } from "vitest";
import { getKycProvider, getPaymentsProvider } from "../src/platform/adapters";

afterEach(() => {
  delete process.env.KYC_PROVIDER;
  delete process.env.PAYMENTS_PROVIDER;
});

describe("FakeKycProvider", () => {
  it("is deterministic for the same caseRef", () => {
    const p = getKycProvider();
    expect(p.getAssessment("CASE-1")).toEqual(p.getAssessment("CASE-1"));
    expect(p.getAssessment("CASE-1").riskScore).toBeGreaterThanOrEqual(5);
    expect(p.getAssessment("CASE-1").riskScore).toBeLessThanOrEqual(95);
  });
});

describe("FakePaymentsProvider", () => {
  it("returns the same providerRef for a repeated idempotencyKey", () => {
    const p = getPaymentsProvider();
    const a = p.refund({ transactionId: "t1", amountCents: 100, idempotencyKey: "k1" });
    const b = p.refund({ transactionId: "t1", amountCents: 100, idempotencyKey: "k1" });
    expect(b.providerRef).toBe(a.providerRef);
    const c = p.refund({ transactionId: "t1", amountCents: 100, idempotencyKey: "k2" });
    expect(c.providerRef).not.toBe(a.providerRef);
  });
});

describe("real providers", () => {
  it("throw 'not implemented'", () => {
    process.env.KYC_PROVIDER = "real";
    expect(() => getKycProvider()).toThrow("not implemented");
    process.env.PAYMENTS_PROVIDER = "real";
    expect(() => getPaymentsProvider()).toThrow("not implemented");
  });
});
