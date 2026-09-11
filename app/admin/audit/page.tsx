import { desc } from "drizzle-orm";
import { forbidden, redirect } from "next/navigation";
import { getActor } from "@/platform/auth";
import { getDb } from "@/platform/db";
import { auditLog } from "@/platform/db/schema";
import { getApps } from "@/platform/registry";
import { AppShell } from "@/platform/ui/app-shell";
import { Table, TBody, Td, Th, THead, Tr } from "@/platform/ui/table";
import { VerifyButton } from "./verify-button";

export default async function AuditPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") forbidden();

  const rows = getDb()
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.seq))
    .all();

  return (
    <AppShell actor={actor} apps={getApps(actor)}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Audit log</h1>
        <VerifyButton />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <THead>
            <Tr>
              <Th>seq</Th>
              <Th>actor</Th>
              <Th>app</Th>
              <Th>action</Th>
              <Th>entity</Th>
              <Th>reason</Th>
              <Th>created</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <Tr key={row.seq}>
                <Td>{row.seq}</Td>
                <Td>{row.actorId}</Td>
                <Td>{row.app}</Td>
                <Td>{row.action}</Td>
                <Td>
                  {row.entityType}/{row.entityId}
                </Td>
                <Td>{row.reason ?? ""}</Td>
                <Td>{row.createdAt}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </AppShell>
  );
}
