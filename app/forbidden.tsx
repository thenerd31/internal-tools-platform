import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-4">
      <h1 className="text-2xl font-semibold">403</h1>
      <p className="text-sm text-slate-600">
        You do not have access to this page.
      </p>
      <Link href="/" className="text-sm text-slate-900 underline">
        Back to tools
      </Link>
    </div>
  );
}
