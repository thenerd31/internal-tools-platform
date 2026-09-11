"use client";

import { useActionState } from "react";
import { claimCase } from "@/apps/kyc/actions";
import { Button } from "@/platform/ui/button";

export function ClaimButton({ id, version }: { id: string; version: number }) {
  const [state, formAction, pending] = useActionState(claimCase, undefined);

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <Button type="submit" variant="secondary" disabled={pending}>
          Claim
        </Button>
      </form>
      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
    </div>
  );
}
