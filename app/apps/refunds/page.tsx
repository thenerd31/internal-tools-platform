import Link from "next/link";
import { getDb } from "@/platform/db";
import { getApps } from "@/platform/registry";
import { AppShell } from "@/platform/ui/app-shell";
import { Button } from "@/platform/ui/button";
import { Input } from "@/platform/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/platform/ui/table";
import { requireActorFor } from "@/apps/refunds/access";
import { searchCustomers } from "@/apps/refunds/service";

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requireActorFor("refunds.view");
  const { q } = await searchParams;
  const rows = searchCustomers(getDb(), q ?? "");

  return (
    <AppShell actor={actor} apps={getApps(actor)}>
      <h1 className="mb-4 text-lg font-semibold">Refunds</h1>
      <form method="get" className="mb-4 flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Search
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search customers by name or email"
          />
        </label>
        <Button type="submit">Search</Button>
      </form>
      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th></Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((c) => (
              <Tr key={c.id}>
                <Td>{c.name}</Td>
                <Td>{c.email}</Td>
                <Td>
                  <Link
                    href={`/apps/refunds/customers/${c.id}`}
                    className="text-slate-900 underline"
                  >
                    Open
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </AppShell>
  );
}
