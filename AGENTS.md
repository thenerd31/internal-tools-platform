# AGENTS.md — internal-tools-platform

Internal-tools platform: one shared layer (auth, authz, audit, registry, adapters, UI shell) plus per-tool apps under `src/apps/<id>/`. Built to evaluate replacing a Power Apps deployment with code.

## Source of truth

- `docs/brief.md` is the original brief.
- `docs/01-spec-platform.md`, `docs/02-spec-kyc.md`, `docs/03-spec-refunds.md` are the specs.
- If the brief or a spec lacks information you need, make the safest call, note it in the PR under Decisions, and continue. Stop only if the ambiguity blocks the whole task.

## Stack (no substitutions)

- Next.js 15 App Router, TypeScript strict, Node 20
- Drizzle ORM, better-sqlite3, DB at `./data/app.db` (gitignored), drizzle-kit migrations
- Auth.js v5: Credentials provider for dev; OIDC provider registered only when `AUTH_OIDC_ISSUER` is set
- shadcn/ui + Tailwind. Do not add UI libraries.
- Vitest, Playwright (chromium), ESLint
- GitHub Actions: check, e2e, Semgrep default rules
- Do not touch another app's folder.

## Commands

`db:migrate`, `db:seed`, `dev`, `check` (typecheck + lint + vitest), `e2e`, `audit:verify`.

Package manager: npm. `check` runs `scripts/gen-registry.ts` first so tests see the registry.

## Layout

- `src/platform/{auth,authz,audit,registry,adapters,ui,db}`
- `src/apps/<id>/{manifest.ts,schema.ts,actions.ts,seed.ts,*.test.ts}`, pages under `app/apps/<id>/`
- `scripts/gen-registry.ts` globs `src/apps/*/manifest.ts`, writes `src/platform/registry/generated.ts` (gitignored), runs on `predev` and `prebuild`
- No central list of apps anywhere. No hand edits to `generated.ts`.

## Roles and users

Roles: `analyst`, `supervisor`, `agent`, `lead`, `admin`. Admin passes every policy.

Seeded users: `analyst@`, `supervisor@`, `agent@`, `lead@`, `admin@` at `demo.local`, password `demo`, bcrypt.

## Mutation rule (every write in every app)

1. Server action only. No client writes, no API routes for writes.
2. `getActor()`, then `authorize(actor, "<app>.<action>", resource)`. Deny throws `ForbiddenError` (403).
3. Validate input and state transition. Failure throws `ValidationError` (422).
4. `withMutation(actor, fn)`: one transaction that updates the entity and calls `audit.append`. Never write audit rows outside it.
5. Every mutable table has integer `version`. Update `WHERE id AND version`; zero rows throws `ConflictError` (409). Version travels as a hidden form field.

Every action is written as an inner `<action>As(actor, ...)` function that takes the actor explicitly. The exported server action is a thin wrapper: `getActor()`, then the inner function (which authorizes, validates, and runs `withMutation`). Tests call the inner function.

## Authorization

- `authorize` looks up `manifest.policies["<app>.<action>"]`; `Policy = (actor, resource?) => boolean`. Unknown action denies.
- Routes under `/apps/*` and `/admin/*` require a session; else redirect to `/login`.

## Audit log

- Table `audit_log`: `seq` (autoincrement), `actor_id`, `app`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `reason`, `created_at`, `prev_hash`, `hash`.
- `hash` = sha256 of these fields joined with `|`: `prev_hash`, `seq`, `actor_id`, `app`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `reason`, `created_at`. Nulls serialize as empty string; `created_at` as ISO 8601 UTC; `before_json`/`after_json` serialized with sorted keys. Genesis `prev_hash` is `"0"`.
- No code path updates or deletes audit rows.
- `audit:verify` walks rows in `seq` order, recomputes; prints `OK <n> rows` exit 0, or `BROKEN at seq <n>` exit 1.
- `/admin/audit`: admin only, newest first, "Verify chain" button showing the same result inline.

## Registry

`AppManifest`: `id`, `name`, `basePath`, `roles` (who sees it in nav), `nav[]`, `policies{}`, `auditActions[]`, `seed?(db)`.

`getApps(actor)` filters by role. Seed runner calls each `manifest.seed` after users. `generated.ts` is server-only: policies are functions, so it must never be imported from client components.

## Adapters

- `KycProvider.getAssessment(caseRef)` -> `{ riskScore, reasons[], documentUrl }`. Fake is deterministic from a hash of `caseRef`.
- `PaymentsProvider.listTransactions(customerId)`; `refund({ transactionId, amountCents, idempotencyKey })` -> `{ providerRef, status }`. Fake keeps an in-memory idempotency map; repeated key returns the same `providerRef`.
- Fakes by default; env `KYC_PROVIDER=real` / `PAYMENTS_PROVIDER=real` throws `"not implemented"`.

## UI shell

`/login`, `/` (app cards the actor can see), `AppShell` with nav from manifests, header with name and role, sign out, `/admin/audit`, 403 page, 404 page.

## Not building

Feature flags, real SSO login, Postgres, deployment, email, background jobs, any third app.

## Definition of done (all tasks)

- `check` and `e2e` green from a fresh migrate + seed.
- Logged in as each role touched, with screenshots.
- `audit:verify` shown passing, then failing after tampering one row.
- PR lists acceptance criteria pass/fail and every ambiguity with the decision made.

## Adding a new internal tool

Use the `new-internal-tool` skill (`.agents/skills/new-internal-tool/SKILL.md`). Before any PR, run the `test-before-pr` skill (`.agents/skills/test-before-pr/SKILL.md`).
