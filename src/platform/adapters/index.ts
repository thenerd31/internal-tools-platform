import { FakeKycProvider, type KycProvider } from "./kyc";
import { FakePaymentsProvider, type PaymentsProvider } from "./payments";

let kyc: KycProvider | undefined;
let payments: PaymentsProvider | undefined;

export function getKycProvider(): KycProvider {
  const v = process.env.KYC_PROVIDER ?? "fake";
  if (v === "real") throw new Error("not implemented");
  kyc ??= new FakeKycProvider();
  return kyc;
}

export function getPaymentsProvider(): PaymentsProvider {
  const v = process.env.PAYMENTS_PROVIDER ?? "fake";
  if (v === "real") throw new Error("not implemented");
  payments ??= new FakePaymentsProvider();
  return payments;
}
