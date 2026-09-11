"use client";

import { useActionState } from "react";
import { claimNext } from "@/apps/kyc/actions";
import { Button } from "@/platform/ui/button";

export function ClaimNextButton() {
  const [state, formAction, pending] = useActionState(claimNext, undefined);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <Button type="submit" disabled={pending}>
          Claim next
        </Button>
      </form>
      {state && !state.ok && (
        <p data-testid="claim-next-error" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </div>
  );
}
