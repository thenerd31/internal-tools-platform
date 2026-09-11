import type { AppManifest } from "@/platform/registry/types";
import type { Refund } from "./schema";
import { seed } from "./seed";

const manifest: AppManifest = {
  id: "refunds",
  name: "Refunds",
  basePath: "/apps/refunds",
  roles: ["agent", "lead"],
  nav: [
    { label: "Refunds", href: "/apps/refunds" },
    { label: "Approvals", href: "/apps/refunds/approvals", roles: ["lead"] },
  ],
  policies: {
    "refunds.view": (a) => a.role === "agent" || a.role === "lead",
    "refunds.approvals.view": (a) => a.role === "lead",
    "refunds.refund.request": (a) => a.role === "agent" || a.role === "lead",
    "refunds.refund.approve": (a, r) =>
      a.role === "lead" && (r as Refund).requestedBy !== a.id,
    "refunds.refund.reject": (a) => a.role === "lead",
  },
  auditActions: [
    "refunds.refund.request",
    "refunds.refund.issue",
    "refunds.refund.approve",
    "refunds.refund.reject",
  ],
  seed,
};

export default manifest;
