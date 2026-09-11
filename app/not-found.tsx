import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-4">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-sm text-slate-600">This page does not exist.</p>
      <Link href="/" className="text-sm text-slate-900 underline">
        Back to tools
      </Link>
    </div>
  );
}
