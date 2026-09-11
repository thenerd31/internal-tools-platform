import { createHash } from "node:crypto";

export interface KycAssessment {
  riskScore: number;
  reasons: string[];
  documentUrl: string;
}

export interface KycProvider {
  getAssessment(caseRef: string): KycAssessment;
}

const VENDOR_REASONS = [
  "DOCUMENT_UNCLEAR",
  "ADDRESS_MISMATCH",
  "SANCTIONS_REVIEW",
  "VELOCITY_HIGH",
] as const;

/** Deterministic fake: assessment derives from a hash of caseRef. */
export class FakeKycProvider implements KycProvider {
  getAssessment(caseRef: string): KycAssessment {
    const h = createHash("sha256").update(caseRef).digest();
    const riskScore = 5 + (h.readUInt32BE(0) % 91); // 5..95
    const count = 1 + (h[4] % 2);
    const reasons = [
      VENDOR_REASONS[h[5] % VENDOR_REASONS.length],
      VENDOR_REASONS[h[6] % VENDOR_REASONS.length],
    ];
    return {
      riskScore,
      reasons: [...new Set(reasons)].slice(0, count),
      documentUrl: `/placeholder-docs/${caseRef}`,
    };
  }
}
