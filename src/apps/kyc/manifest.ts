import type { Actor } from "@/platform/types";
import type { AppManifest } from "@/platform/registry/types";
import type { KycCase } from "./schema";
import { seedKyc } from "./seed";

function caseResource(resource: unknown): KycCase {
  return resource as KycCase;
}

const kycManifest: AppManifest = {
  id: "kyc",
  name: "KYC review queue",
  basePath: "/apps/kyc",
  roles: ["analyst", "supervisor"],
  nav: [{ label: "KYC queue", href: "/apps/kyc" }],
  auditActions: ["kyc.case.claim", "kyc.case.decide"],
  policies: {
    "kyc.case.view": (actor: Actor, resource?: unknown) => {
      const kase = caseResource(resource);
      if (actor.role === "supervisor") return true;
      if (actor.role === "analyst") {
        return kase.assigneeId === actor.id || kase.assigneeId === null;
      }
      return false;
    },
    "kyc.case.claim": (actor: Actor, resource?: unknown) => {
      const kase = caseResource(resource);
      if (actor.role === "supervisor") return true;
      if (actor.role === "analyst") {
        return (
          kase.riskScore < 70 &&
          kase.assigneeId === null
        );
      }
      return false;
    },
    "kyc.case.decide": (actor: Actor, resource?: unknown) => {
      const kase = caseResource(resource);
      if (actor.role === "supervisor") return true;
      if (actor.role === "analyst") {
        return kase.riskScore < 70 && kase.assigneeId === actor.id;
      }
      return false;
    },
  },
  seed: seedKyc,
};

export default kycManifest;
