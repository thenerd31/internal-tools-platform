import Link from "next/link";
import { redirect, forbidden } from "next/navigation";
import { getActor } from "@/platform/auth";
import { getApps } from "@/platform/registry";
import { AppShell } from "@/platform/ui/app-shell";
import { Badge } from "@/platform/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/platform/ui/table";
import { ClaimNextButton } from "./claim-next-button";
import { StatusFilter } from "./status-filter";
import { listCasesFor } from "@/apps/kyc/service";
import type { KycStatus } from "@/apps/kyc/schema";

const validStatuses: KycStatus[] = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "needs_info",
];

export default async function KycQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!["analyst", "supervisor", "admin"].includes(actor.role)) forbidden();

  const params = await searchParams;
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const status = validStatuses.includes(rawStatus as KycStatus)
    ? (rawStatus as KycStatus)
    : undefined;
  const cases = await listCasesFor(actor, status);

  return (
    <AppShell actor={actor} apps={getApps(actor)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">KYC queue</h1>
          <p className="text-sm text-slate-600">
            Review flagged customer sign-ups.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <StatusFilter value={status} />
          <ClaimNextButton />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <Table>
          <THead>
            <Tr>
              <Th>Customer</Th>
              <Th>Risk</Th>
              <Th>Status</Th>
              <Th>Assignee</Th>
              <Th>Created</Th>
            </Tr>
          </THead>
          <TBody>
            {cases.map((kase) => (
              <Tr key={kase.id} data-testid="case-row">
                <Td>
                  <Link
                    href={`/apps/kyc/${kase.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {kase.customerName}
                  </Link>
                  <div className="text-xs text-slate-500">{kase.caseRef}</div>
                </Td>
                <Td>
                  <Badge
                    data-testid="risk-badge"
                    data-risk={kase.riskScore}
                    className={
                      kase.riskScore >= 70 ? "bg-red-600 text-white" : undefined
                    }
                  >
                    {kase.riskScore}
                  </Badge>
                </Td>
                <Td>{kase.status}</Td>
                <Td>{kase.assigneeId ?? "Unassigned"}</Td>
                <Td>{kase.createdAt}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      {cases.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No cases found.</p>
      )}
    </AppShell>
  );
}
