import { notFound } from "next/navigation";
import { getDb } from "@/platform/db";
import { getApps } from "@/platform/registry";
import { AppShell } from "@/platform/ui/app-shell";
import { Badge } from "@/platform/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/platform/ui/table";
import { requireActorFor } from "@/apps/refunds/access";
import {
  formatCents,
  getCustomer,
  listRefundsForCustomer,
  listTransactions,
} from "@/apps/refunds/service";
import { RefundDialog } from "./refund-dialog";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActorFor("refunds.view");
  const { id } = await params;
  const db = getDb();
  const customer = getCustomer(db, id);
  if (!customer) notFound();

  const txns = listTransactions(db, customer.id);
  const refundRows = listRefundsForCustomer(db, customer.id);

  return (
    <AppShell actor={actor} apps={getApps(actor)}>
      <h1 className="mb-1 text-lg font-semibold">{customer.name}</h1>
      <p className="mb-4 text-sm text-slate-600">{customer.email}</p>
      <div className="mb-6 rounded-lg border border-slate-200 bg-white">
        <Table>
          <THead>
            <Tr>
              <Th>Transaction</Th>
              <Th>Amount</Th>
              <Th>Refunded</Th>
              <Th>Remaining</Th>
              <Th>Created</Th>
              <Th></Th>
            </Tr>
          </THead>
          <TBody>
            {txns.map((t) => {
              const remaining = t.amountCents - t.refundedCents;
              return (
                <Tr key={t.id}>
                  <Td>{t.id}</Td>
                  <Td>{formatCents(t.amountCents, t.currency)}</Td>
                  <Td>{formatCents(t.refundedCents, t.currency)}</Td>
                  <Td>{formatCents(remaining, t.currency)}</Td>
                  <Td>{t.createdAt}</Td>
                  <Td>
                    <RefundDialog
                      transactionId={t.id}
                      remainingCents={remaining}
                    />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
      <h2 className="mb-2 font-semibold">Refunds</h2>
      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <THead>
            <Tr>
              <Th>Refund</Th>
              <Th>Transaction</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Requested by</Th>
              <Th>Provider ref</Th>
            </Tr>
          </THead>
          <TBody>
            {refundRows.map((r) => (
              <Tr key={r.id}>
                <Td>{r.id}</Td>
                <Td>{r.transactionId}</Td>
                <Td>{formatCents(r.amountCents)}</Td>
                <Td>
                  <Badge
                    variant={
                      r.status === "issued"
                        ? "green"
                        : r.status === "rejected"
                          ? "red"
                          : "default"
                    }
                  >
                    {r.status}
                  </Badge>
                </Td>
                <Td>{r.requestedBy}</Td>
                <Td>{r.providerRef ?? ""}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </AppShell>
  );
}
