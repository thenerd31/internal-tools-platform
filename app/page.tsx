import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/platform/auth";
import { getApps } from "@/platform/registry";
import { AppShell } from "@/platform/ui/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/card";

export default async function HomePage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const apps = getApps(actor);

  return (
    <AppShell actor={actor} apps={apps}>
      {apps.length === 0 ? (
        <p className="text-sm text-slate-500">No tools available.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link key={app.id} href={app.basePath}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>{app.name}</CardTitle>
                </CardHeader>
                <CardContent>{app.id}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
