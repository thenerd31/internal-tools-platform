"use client";

import { useActionState, useState } from "react";
import { Button } from "@/platform/ui/button";
import { Input } from "@/platform/ui/input";
import { requestRefund } from "@/apps/refunds/actions";

export function RefundDialog({
  transactionId,
  remainingCents,
}: {
  transactionId: string;
  remainingCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [state, formAction, pending] = useActionState(requestRefund, undefined);

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        disabled={remainingCents <= 0}
        onClick={() => {
          setKey(crypto.randomUUID());
          setOpen(true);
        }}
      >
        Refund
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Refund transaction"
          className="mt-2 rounded-lg border border-slate-200 bg-white p-4"
        >
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="transaction_id" value={transactionId} />
            <input
              type="hidden"
              name="idempotency_key"
              value={key}
              data-testid="idempotency-key"
            />
            <label className="flex flex-col gap-1 text-sm">
              Amount (cents)
              <Input name="amount_cents" type="number" required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Reason
              <Input name="reason" required />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                Submit refund
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
          {state &&
            (state.ok ? (
              <p data-testid="refund-result" className="mt-2 text-sm">
                Refund{" "}
                {state.data.status === "issued" ? "issued" : "pending approval"}
              </p>
            ) : (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {state.code}: {state.message}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
