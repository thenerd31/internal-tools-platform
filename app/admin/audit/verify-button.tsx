"use client";

import { useState } from "react";
import { verifyAudit } from "@/platform/audit/actions";
import { Button } from "@/platform/ui/button";

export function VerifyButton() {
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        onClick={async () => {
          setRunning(true);
          try {
            setResult(await verifyAudit());
          } finally {
            setRunning(false);
          }
        }}
        disabled={running}
      >
        Verify chain
      </Button>
      {result && <span data-testid="verify-result" className="text-sm">{result}</span>}
    </div>
  );
}
