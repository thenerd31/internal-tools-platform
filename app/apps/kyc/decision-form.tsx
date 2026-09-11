"use client";

import { useActionState } from "react";
import { decideCase } from "@/apps/kyc/actions";
import { Button } from "@/platform/ui/button";

export function DecisionForm({
  id,
  version,
  disabledReason,
}: {
  id: string;
  version: number;
  disabledReason: string | null;
}) {
  const [state, formAction, pending] = useActionState(decideCase, undefined);
  const disabled = Boolean(disabledReason) || pending;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <fieldset disabled={disabled} className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Decision</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="decision" value="approved" defaultChecked />
          Approve
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="decision" value="rejected" />
          Reject
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="decision" value="needs_info" />
          Request more info
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Reason
          <textarea
            name="reason"
            required
            rows={4}
            className="rounded-md border border-slate-300 bg-white p-2"
          />
        </label>
        <Button type="submit">Submit decision</Button>
      </fieldset>
      {disabledReason && (
        <p data-testid="decision-disabled-reason" className="text-sm text-amber-700">
          {disabledReason}
        </p>
      )}
      {state && !state.ok && (
        <p data-testid="decision-error" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
