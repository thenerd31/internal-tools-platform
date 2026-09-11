---
name: new-internal-tool
description: Scaffold a new internal tool app on this platform — manifest, schema, actions, seed, pages, tests written from the spec's acceptance criteria — then run checks and open the PR. Use when asked to add a new app under src/apps/.
---

# New internal tool

Build one app under `src/apps/<id>/` that plugs into the platform. Do not touch the platform, the generated registry, other apps, or audit rows.

## Steps

1. Read `AGENTS.md` and the app's spec (`docs/NN-spec-<id>.md`). If anything you need is missing, make the safest call, note it in the PR under Decisions, and continue. Stop only if the ambiguity blocks the whole task.
2. Create `src/apps/<id>/` with `manifest.ts`, `schema.ts`, `actions.ts`, `seed.ts`, and `*.test.ts`. Pages go under `app/apps/<id>/`.
3. `manifest.ts` declares `id`, `name`, `basePath`, `roles`, `nav[]`, `policies{}`, `auditActions[]`, `seed?(db)`.
4. Every write follows the platform mutation rule: server action only; `getActor()` then `authorize(actor, "<app>.<action>", resource)` (deny -> `ForbiddenError` 403); validate input and state transition (-> `ValidationError` 422); `withMutation(actor, fn)` wraps the entity update and `audit.append` in one transaction; update `WHERE id AND version`, zero rows -> `ConflictError` 409; `version` rides as a hidden form field. Write each action as an inner `<action>As(actor, ...)` function; the exported server action is a thin wrapper that calls `getActor()` then the inner function. Tests call the inner function.
5. Write tests directly from the spec's numbered acceptance criteria — one test (or more) per criterion, mapped by number.
6. Create a drizzle-kit migration. Run `db:migrate`, then `db:seed` (the seed runner calls each `manifest.seed` after users).
7. Run `check` (typecheck + lint + vitest) until green.
8. Run the `test-before-pr` skill.
9. Open a PR titled `feat(<id>)` containing: the acceptance-criteria mapping (pass/fail per numbered criterion), every ambiguity found and the decision made, screenshots, and a README section for the app.

## Never

- Never edit `src/platform/registry/generated.ts` or any central list — the registry is generated from manifests.
- Never edit another app's files.
- Never update or delete audit rows, and never write audit rows outside `withMutation`.
- Never add features the spec does not list.
