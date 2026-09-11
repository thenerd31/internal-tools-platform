import { forbidden, redirect } from "next/navigation";
import { getActor } from "@/platform/auth";
import { authorize } from "@/platform/authz";
import { ForbiddenError } from "@/platform/errors";
import type { Actor } from "@/platform/types";

export async function requireActorFor(
  action: string,
  resource?: unknown,
): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  try {
    authorize(actor, action, resource);
  } catch (e) {
    if (e instanceof ForbiddenError) forbidden();
    throw e;
  }
  return actor;
}
