"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActor } from "@/platform/auth";
import { runAction } from "@/platform/authz";
import type { ActionResult } from "@/platform/types";
import type { Decision, KycCase } from "./schema";
import { claimCaseAs, claimNextAs, decideCaseAs } from "./service";

type KycActionState = ActionResult<KycCase> | undefined;

export async function claimCase(
  _previous: KycActionState,
  formData: FormData,
): Promise<ActionResult<KycCase>> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version"));
  const result = await runAction(() => claimCaseAs(actor, id, version));
  if (result.ok) {
    revalidatePath("/apps/kyc");
    revalidatePath(`/apps/kyc/${id}`);
  }
  return result;
}

export async function claimNext(
  _previous: KycActionState,
  _formData: FormData,
): Promise<ActionResult<KycCase>> {
  void _previous;
  void _formData;
  const actor = await getActor();
  if (!actor) redirect("/login");
  const result = await runAction(() => claimNextAs(actor));
  if (result.ok) {
    revalidatePath("/apps/kyc");
    revalidatePath(`/apps/kyc/${result.data.id}`);
    redirect(`/apps/kyc/${result.data.id}`);
  }
  return result;
}

export async function decideCase(
  _previous: KycActionState,
  formData: FormData,
): Promise<ActionResult<KycCase>> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version"));
  const decision = String(formData.get("decision") ?? "") as Decision;
  const reason = String(formData.get("reason") ?? "");
  const result = await runAction(() =>
    decideCaseAs(actor, id, version, decision, reason),
  );
  if (result.ok) {
    revalidatePath("/apps/kyc");
    revalidatePath(`/apps/kyc/${id}`);
  }
  return result;
}
