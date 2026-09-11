export type Role = "analyst" | "supervisor" | "agent" | "lead" | "admin";

export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: number; message: string };
