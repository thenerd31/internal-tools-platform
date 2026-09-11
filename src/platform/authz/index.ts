import { ConflictError, ForbiddenError, ValidationError } from "../errors";
import { getManifests } from "../registry";
import type { ActionResult, Actor } from "../types";

/**
 * authorize looks up manifest.policies["<app>.<action>"] across all registered
 * apps. Unknown action denies for everyone including admin. admin passes every
 * known policy. Deny throws ForbiddenError (403).
 */
export function authorize(
  actor: Actor,
  action: string,
  resource?: unknown,
): void {
  let policy: ((actor: Actor, resource?: unknown) => boolean) | undefined;
  for (const manifest of getManifests()) {
    const found = manifest.policies[action];
    if (found) {
      policy = found;
      break;
    }
  }
  if (!policy) throw new ForbiddenError(`Unknown action: ${action}`);
  if (actor.role === "admin") return;
  if (!policy(actor, resource)) {
    throw new ForbiddenError(`Forbidden: ${action}`);
  }
}

/**
 * Every server action wraps its body in runAction so platform errors become
 * the { ok: false, code, message } contract instead of crashing the request.
 */
export async function runAction<T>(
  fn: () => T | Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (
      e instanceof ForbiddenError ||
      e instanceof ValidationError ||
      e instanceof ConflictError
    ) {
      return { ok: false, code: e.code, message: e.message };
    }
    throw e;
  }
}
