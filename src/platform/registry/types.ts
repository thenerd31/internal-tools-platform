import type { Db } from "../db";
import type { Actor, Role } from "../types";

export type Policy = (actor: Actor, resource?: unknown) => boolean;

export interface NavItem {
  label: string;
  href: string;
}

export interface AppManifest {
  id: string;
  name: string;
  basePath: string;
  /** Roles that see this app in nav and on the home page. */
  roles: Role[];
  nav: NavItem[];
  /** Keyed by "<app>.<action>". Missing key denies. */
  policies: Record<string, Policy>;
  auditActions: string[];
  seed?: (db: Db) => void;
}
