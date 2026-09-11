"use client";

import { useRouter } from "next/navigation";

const statuses = [
  ["", "All"],
  ["pending", "Pending"],
  ["in_review", "In review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["needs_info", "Needs info"],
] as const;

export function StatusFilter({ value }: { value?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      Status
      <select
        aria-label="Status"
        className="h-9 rounded-md border border-slate-300 bg-white px-3"
        value={value ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          router.push(next ? `/apps/kyc?status=${next}` : "/apps/kyc");
        }}
      >
        {statuses.map(([status, label]) => (
          <option key={status} value={status}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
