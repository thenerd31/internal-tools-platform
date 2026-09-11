"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/platform/auth";
import { runAction } from "@/platform/authz";
import { ForbiddenError, ValidationError } from "@/platform/errors";
import type { ActionResult } from "@/platform/types";
import type { Refund } from "./schema";
import { approveRefundAs, rejectRefundAs, requestRefundAs } from "./service";

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function int(formData: FormData, name: string): number {
  const v = Number(str(formData, name));
  if (!Number.isInteger(v)) {
    throw new ValidationError(`${name} must be a number`);
  }
  return v;
}

export async function requestRefund(
  _prev: ActionResult<Refund> | undefined,
  formData: FormData,
): Promise<ActionResult<Refund>> {
  return runAction(async () => {
    const actor = await getActor();
    if (!actor) throw new ForbiddenError();
    const r = requestRefundAs(actor, {
      transactionId: str(formData, "transaction_id"),
      amountCents: int(formData, "amount_cents"),
      reason: str(formData, "reason"),
      idempotencyKey: str(formData, "idempotency_key"),
    });
    revalidatePath("/apps/refunds", "layout");
    return r;
  });
}

export async function approveRefund(
  _prev: ActionResult<Refund> | undefined,
  formData: FormData,
): Promise<ActionResult<Refund>> {
  return runAction(async () => {
    const actor = await getActor();
    if (!actor) throw new ForbiddenError();
    const r = approveRefundAs(actor, {
      id: str(formData, "id"),
      version: int(formData, "version"),
    });
    revalidatePath("/apps/refunds", "layout");
    return r;
  });
}

export async function rejectRefund(
  _prev: ActionResult<Refund> | undefined,
  formData: FormData,
): Promise<ActionResult<Refund>> {
  return runAction(async () => {
    const actor = await getActor();
    if (!actor) throw new ForbiddenError();
    const r = rejectRefundAs(actor, {
      id: str(formData, "id"),
      version: int(formData, "version"),
      reason: str(formData, "reason"),
    });
    revalidatePath("/apps/refunds", "layout");
    return r;
  });
}
