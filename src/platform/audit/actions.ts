"use server";

import { getActor } from "../auth";
import { getDb } from "../db";
import { verify } from ".";

export async function verifyAudit(): Promise<string> {
  const actor = await getActor();
  if (actor?.role !== "admin") return "Forbidden";
  const result = verify(getDb());
  return result.ok ? `OK ${result.count} rows` : `BROKEN at seq ${result.brokenSeq}`;
}
