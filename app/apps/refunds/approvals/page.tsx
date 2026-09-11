import { getDb } from "@/platform/db";
import { getApps } from "@/platform/registry";
import { AppShell } from "@/platform/ui/app-shell";
import { Table, TBody, Td, Th, THead, Tr } from "@/platform/ui/table";
import { requireActorFor } from "@/apps/refunds/access";
import { formatCents, listPendingRefunds } from "@/apps/refunds/service";
import { ApprovalActions } from "./approval-actions";

export default async function ApprovalsPage() {
  const actor = await requireActorFor("refunds.approvals.view");
  const rows = listPendingRefunds(getDb());

  return (
    <AppShell actor={actor} apps={getApps(actor)}>
      <h1 className="mb-4 text-lg font-semibold">Approvals</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No refunds pending approval.</p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <THead>
              <Tr>
                <Th>Refund</Th>
                <Th>Customer</Th>
                <Th>Transaction</Th>
                <Th>Amount</Th>
                <Th>Reason</Th>
                <Th>Requested by</Th>
                <Th>Created</Th>
                <Th></Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map(({ refund, transaction, customerName }) => (
                <Tr key={refund.id}>
                  <Td>{refund.id}</Td>
                  <Td>{customerName}</Td>
                  <Td>{transaction.id}</Td>
                  <Td>
                    {formatCents(refund.amountCents)}
                    <div className="text-xs text-slate-500">
                      {refund.amountCents.toLocaleString("en-US")} cents
                    </div>
                  </Td>
                  <Td>{refund.reason}</Td>
                  <Td>{refund.requestedBy}</Td>
                  <Td>{refund.createdAt}</Td>
                  <Td>
                    <ApprovalActions id={refund.id} version={refund.version} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
