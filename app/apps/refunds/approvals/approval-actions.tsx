"use client";

import { useActionState } from "react";
import { Button } from "@/platform/ui/button";
import { Input } from "@/platform/ui/input";
import { approveRefund, rejectRefund } from "@/apps/refunds/actions";

export function ApprovalActions({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveRefund,
    undefined,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRefund,
    undefined,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={approveAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <Button type="submit" size="sm" disabled={approvePending}>
          Approve
        </Button>
      </form>
      {approveState && !approveState.ok && (
        <p role="alert" className="text-sm text-red-600">
          {approveState.code}: {approveState.message}
        </p>
      )}
      <form action={rejectAction} className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <Input name="reason" placeholder="Rejection reason" required />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={rejectPending}
        >
          Reject
        </Button>
      </form>
      {rejectState && !rejectState.ok && (
        <p role="alert" className="text-sm text-red-600">
          {rejectState.code}: {rejectState.message}
        </p>
      )}
    </div>
  );
}
