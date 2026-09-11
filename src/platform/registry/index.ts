import type { Actor } from "../types";
import { manifests as generated } from "./generated";
import type { AppManifest } from "./types";

let testManifests: AppManifest[] | null = null;

/** Unit tests inject manifests here instead of writing app folders. */
export function setManifestsForTests(manifests: AppManifest[] | null): void {
  testManifests = manifests;
}

export function getManifests(): AppManifest[] {
  return testManifests ?? generated;
}

/** Apps the actor sees in nav. admin sees all apps. */
export function getApps(actor: Actor): AppManifest[] {
  const all = getManifests();
  if (actor.role === "admin") return all;
  return all.filter((m) => m.roles.includes(actor.role));
}
