import Link from "next/link";
import { notFound, redirect, forbidden } from "next/navigation";
import { getActor } from "@/platform/auth";
import { authorize } from "@/platform/authz";
import { getApps } from "@/platform/registry";
import { AppShell } from "@/platform/ui/app-shell";
import { Badge } from "@/platform/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/platform/ui/table";
import type { KycCase } from "@/apps/kyc/schema";
import {
  decideDisabledReason,
  getCaseFor,
  getCaseHistory,
} from "@/apps/kyc/service";
import { ClaimButton } from "../claim-button";
import { DecisionForm } from "../decision-form";

function canClaim(actor: Awaited<ReturnType<typeof getActor>>, kase: KycCase) {
  if (!actor) return false;
  try {
    authorize(actor, "kyc.case.claim", kase);
    return true;
  } catch {
    return false;
  }
}

export default async function KycCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!["analyst", "supervisor", "admin"].includes(actor.role)) forbidden();

  const { id } = await params;
  let kase: KycCase | null;
  try {
    kase = await getCaseFor(actor, id);
  } catch {
    forbidden();
  }
  if (!kase) notFound();
  const history = await getCaseHistory(id);
  const reasons = JSON.parse(kase.vendorReasonsJson) as string[];
  const claimable =
    (kase.status === "pending" || kase.status === "needs_info") &&
    canClaim(actor, kase);

  return (
    <AppShell actor={actor} apps={getApps(actor)}>
      <div className="mb-4">
        <Link href="/apps/kyc" className="text-sm text-slate-600 underline">
          Back to KYC queue
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold">{kase.customerName}</h1>
                <p className="text-sm text-slate-600">{kase.customerEmail}</p>
                <p className="mt-2 text-sm text-slate-500">{kase.caseRef}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  data-testid="risk-badge"
                  data-risk={kase.riskScore}
                  className={
                    kase.riskScore >= 70 ? "bg-red-600 text-white" : undefined
                  }
                >
                  Risk {kase.riskScore}
                </Badge>
                <Badge>{kase.status}</Badge>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-700">Assignee</dt>
                <dd>{kase.assigneeId ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">Document</dt>
                <dd>
                  <a
                    href={kase.documentUrl}
                    className="text-slate-900 underline"
                  >
                    View uploaded ID
                  </a>
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <h2 className="font-semibold">Vendor reasons</h2>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            {claimable && (
              <div className="mt-4">
                <ClaimButton id={kase.id} version={kase.version} />
              </div>
            )}
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 font-semibold">History</h2>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>seq</Th>
                    <Th>action</Th>
                    <Th>actor</Th>
                    <Th>reason</Th>
                    <Th>created</Th>
                  </Tr>
                </THead>
                <TBody>
                  {history.map((row) => (
                    <Tr key={row.seq} data-testid="history-row">
                      <Td>{row.seq}</Td>
                      <Td>{row.action}</Td>
                      <Td>{row.actorId}</Td>
                      <Td>{row.reason ?? ""}</Td>
                      <Td>{row.createdAt}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            {history.length === 0 && (
              <p className="text-sm text-slate-500">No history yet.</p>
            )}
          </section>
        </div>
        <section className="h-fit rounded-lg border border-slate-200 bg-white p-4">
          <DecisionForm
            id={kase.id}
            version={kase.version}
            disabledReason={decideDisabledReason(actor, kase)}
          />
        </section>
      </div>
    </AppShell>
  );
}
