import type { Db } from "@/platform/db";
import { kycCases } from "./schema";

type SeedCase = {
  id: string;
  caseRef: string;
  customerName: string;
  customerEmail: string;
  riskScore: number;
  reasons: string[];
  status: "pending" | "in_review" | "approved" | "rejected" | "needs_info";
  assigneeId?: string;
  decisionReason?: string;
  decidedBy?: string;
  decidedAt?: string;
};

const SEED_CASES: SeedCase[] = [
  { id: "kyc-0001", caseRef: "KYC-1001", customerName: "Customer 01", customerEmail: "customer01@example.com", riskScore: 95, reasons: ["SANCTIONS_REVIEW", "DOCUMENT_UNCLEAR"], status: "pending" },
  { id: "kyc-0002", caseRef: "KYC-1002", customerName: "Customer 02", customerEmail: "customer02@example.com", riskScore: 90, reasons: ["ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0003", caseRef: "KYC-1003", customerName: "Customer 03", customerEmail: "customer03@example.com", riskScore: 85, reasons: ["VELOCITY_HIGH", "ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0004", caseRef: "KYC-1004", customerName: "Customer 04", customerEmail: "customer04@example.com", riskScore: 80, reasons: ["SANCTIONS_REVIEW"], status: "in_review", assigneeId: "seed-analyst" },
  { id: "kyc-0005", caseRef: "KYC-1005", customerName: "Customer 05", customerEmail: "customer05@example.com", riskScore: 80, reasons: ["DOCUMENT_UNCLEAR", "VELOCITY_HIGH"], status: "pending" },
  { id: "kyc-0006", caseRef: "KYC-1006", customerName: "Customer 06", customerEmail: "customer06@example.com", riskScore: 78, reasons: ["ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0007", caseRef: "KYC-1007", customerName: "Customer 07", customerEmail: "customer07@example.com", riskScore: 75, reasons: ["DOCUMENT_UNCLEAR"], status: "pending" },
  { id: "kyc-0008", caseRef: "KYC-1008", customerName: "Customer 08", customerEmail: "customer08@example.com", riskScore: 72, reasons: ["SANCTIONS_REVIEW", "VELOCITY_HIGH"], status: "pending", assigneeId: "seed-supervisor" },
  { id: "kyc-0009", caseRef: "KYC-1009", customerName: "Customer 09", customerEmail: "customer09@example.com", riskScore: 70, reasons: ["ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0010", caseRef: "KYC-1010", customerName: "Customer 10", customerEmail: "customer10@example.com", riskScore: 68, reasons: ["VELOCITY_HIGH"], status: "pending" },
  { id: "kyc-0011", caseRef: "KYC-1011", customerName: "Customer 11", customerEmail: "customer11@example.com", riskScore: 65, reasons: ["DOCUMENT_UNCLEAR", "ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0012", caseRef: "KYC-1012", customerName: "Customer 12", customerEmail: "customer12@example.com", riskScore: 62, reasons: ["SANCTIONS_REVIEW"], status: "pending" },
  { id: "kyc-0013", caseRef: "KYC-1013", customerName: "Customer 13", customerEmail: "customer13@example.com", riskScore: 60, reasons: ["DOCUMENT_UNCLEAR"], status: "pending" },
  { id: "kyc-0014", caseRef: "KYC-1014", customerName: "Customer 14", customerEmail: "customer14@example.com", riskScore: 58, reasons: ["ADDRESS_MISMATCH", "VELOCITY_HIGH"], status: "in_review", assigneeId: "seed-analyst" },
  { id: "kyc-0015", caseRef: "KYC-1015", customerName: "Customer 15", customerEmail: "customer15@example.com", riskScore: 55, reasons: ["SANCTIONS_REVIEW"], status: "pending" },
  { id: "kyc-0016", caseRef: "KYC-1016", customerName: "Customer 16", customerEmail: "customer16@example.com", riskScore: 52, reasons: ["DOCUMENT_UNCLEAR"], status: "pending" },
  { id: "kyc-0017", caseRef: "KYC-1017", customerName: "Customer 17", customerEmail: "customer17@example.com", riskScore: 48, reasons: ["ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0018", caseRef: "KYC-1018", customerName: "Customer 18", customerEmail: "customer18@example.com", riskScore: 45, reasons: ["VELOCITY_HIGH", "SANCTIONS_REVIEW"], status: "in_review", assigneeId: "seed-analyst" },
  { id: "kyc-0019", caseRef: "KYC-1019", customerName: "Customer 19", customerEmail: "customer19@example.com", riskScore: 42, reasons: ["DOCUMENT_UNCLEAR"], status: "pending" },
  { id: "kyc-0020", caseRef: "KYC-1020", customerName: "Customer 20", customerEmail: "customer20@example.com", riskScore: 38, reasons: ["ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0021", caseRef: "KYC-1021", customerName: "Customer 21", customerEmail: "customer21@example.com", riskScore: 35, reasons: ["SANCTIONS_REVIEW"], status: "pending" },
  { id: "kyc-0022", caseRef: "KYC-1022", customerName: "Customer 22", customerEmail: "customer22@example.com", riskScore: 32, reasons: ["VELOCITY_HIGH"], status: "pending" },
  { id: "kyc-0023", caseRef: "KYC-1023", customerName: "Customer 23", customerEmail: "customer23@example.com", riskScore: 28, reasons: ["DOCUMENT_UNCLEAR", "ADDRESS_MISMATCH"], status: "pending" },
  { id: "kyc-0024", caseRef: "KYC-1024", customerName: "Customer 24", customerEmail: "customer24@example.com", riskScore: 24, reasons: ["SANCTIONS_REVIEW"], status: "pending" },
  { id: "kyc-0025", caseRef: "KYC-1025", customerName: "Customer 25", customerEmail: "customer25@example.com", riskScore: 20, reasons: ["VELOCITY_HIGH"], status: "pending" },
  { id: "kyc-0026", caseRef: "KYC-1026", customerName: "Customer 26", customerEmail: "customer26@example.com", riskScore: 15, reasons: ["DOCUMENT_UNCLEAR"], status: "pending" },
  { id: "kyc-0027", caseRef: "KYC-1027", customerName: "Customer 27", customerEmail: "customer27@example.com", riskScore: 12, reasons: ["ADDRESS_MISMATCH"], status: "approved", decisionReason: "Seeded supervisor approval", decidedBy: "seed-supervisor" },
  { id: "kyc-0028", caseRef: "KYC-1028", customerName: "Customer 28", customerEmail: "customer28@example.com", riskScore: 10, reasons: ["SANCTIONS_REVIEW"], status: "approved", decisionReason: "Seeded supervisor approval", decidedBy: "seed-supervisor" },
  { id: "kyc-0029", caseRef: "KYC-1029", customerName: "Customer 29", customerEmail: "customer29@example.com", riskScore: 8, reasons: ["VELOCITY_HIGH"], status: "rejected", decisionReason: "Seeded supervisor rejection", decidedBy: "seed-supervisor" },
  { id: "kyc-0030", caseRef: "KYC-1030", customerName: "Customer 30", customerEmail: "customer30@example.com", riskScore: 5, reasons: ["DOCUMENT_UNCLEAR", "SANCTIONS_REVIEW"], status: "needs_info", decisionReason: "Seeded supervisor request for more information", decidedBy: "seed-supervisor" },
];

export function seedKyc(db: Db): void {
  if (db.select({ id: kycCases.id }).from(kycCases).limit(1).get()) return;

  const base = new Date("2025-01-01T00:00:00.000Z").getTime();
  db.insert(kycCases)
    .values(
      SEED_CASES.map((item, index) => {
        const createdAt = new Date(base - index * 60_000).toISOString();
        const decidedAt = item.decidedBy
          ? new Date(base - index * 60_000 + 30_000).toISOString()
          : null;
        return {
          id: item.id,
          caseRef: item.caseRef,
          customerName: item.customerName,
          customerEmail: item.customerEmail,
          riskScore: item.riskScore,
          vendorReasonsJson: JSON.stringify(item.reasons),
          documentUrl: `/placeholder-docs/${item.caseRef}`,
          status: item.status,
          assigneeId: item.assigneeId ?? null,
          decisionReason: item.decisionReason ?? null,
          decidedBy: item.decidedBy ?? null,
          decidedAt: decidedAt ?? item.decidedAt ?? null,
          version: 1,
          createdAt,
          updatedAt: createdAt,
        };
      }),
    )
    .run();
}
