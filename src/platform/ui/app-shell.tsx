import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "../auth/actions";
import type { AppManifest } from "../registry/types";
import type { Actor } from "../types";
import { Badge } from "./badge";
import { Button } from "./button";

export function AppShell({
  actor,
  apps,
  children,
}: {
  actor: Actor;
  apps: AppManifest[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <nav className="flex items-center gap-4">
          <Link href="/" className="font-semibold">
            Internal Tools
          </Link>
          {apps.flatMap((app) =>
            app.nav
              .filter(
                (item) =>
                  !item.roles ||
                  actor.role === "admin" ||
                  item.roles.includes(actor.role),
              )
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              )),
          )}
          {actor.role === "admin" && (
            <Link
              href="/admin/audit"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Audit log
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm">{actor.name}</span>
          <Badge>{actor.role}</Badge>
          <form action={logout}>
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
