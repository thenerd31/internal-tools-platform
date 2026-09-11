# Spec 01 — Platform

Shared layer every internal tool runs on: auth, authorization, audit log, app registry, external-service adapters, and the UI shell. Apps live in `src/apps/<id>/` and plug in via a manifest; the platform supplies everything else.

## 1. Stack (no substitutions)

- Next.js 15 App Router, TypeScript strict, Node 20
- Drizzle ORM, better-sqlite3, DB at `./data/app.db` (gitignored), drizzle-kit migrations
- Auth.js v5: Credentials provider for dev; OIDC provider registered only when `AUTH_OIDC_ISSUER` is set
- shadcn/ui + Tailwind
- Vitest, Playwright (chromium), ESLint
- GitHub Actions: `check`, `e2e`, Semgrep default rules
- Commands: `db:migrate`, `db:seed`, `dev`, `check` (typecheck + lint + vitest), `e2e`, `audit:verify`

## 2. Repository layout

- `src/platform/{auth,authz,audit,registry,adapters,ui,db}`
- `src/apps/<id>/{manifest.ts,schema.ts,actions.ts,seed.ts,*.test.ts}`; pages under `app/apps/<id>/`
- `scripts/gen-registry.ts` globs `src/apps/*/manifest.ts` and writes `src/platform/registry/generated.ts` (gitignored). It runs on `predev` and `prebuild`.
- No central list of apps anywhere. No hand edits to `generated.ts`.

## 3. Authentication and users

- Auth.js v5 with two providers:
  - Credentials provider (dev). Seeded users log in with email + password.
  - OIDC provider, registered only when `AUTH_OIDC_ISSUER` is set. Real SSO login is out of scope beyond registration.
- Roles: `analyst`, `supervisor`, `agent`, `lead`, `admin`.
- Seeded users: `analyst@demo.local`, `supervisor@demo.local`, `agent@demo.local`, `lead@demo.local`, `admin@demo.local`; password `demo`, stored bcrypt.
- Routes under `/apps/*` and `/admin/*` require a session; unauthenticated requests redirect to `/login`.
- Sessions: JWT, 8-hour lifetime.
- bcrypt cost factor 10.
- Display names: `Demo Analyst`, `Demo Supervisor`, `Demo Agent`, `Demo Lead`, `Demo Admin` (the header shows name and role).

## 4. Authorization

- `authorize(actor, "<app>.<action>", resource?)` looks up `manifest.policies["<app>.<action>"]`.
- `Policy = (actor, resource?) => boolean`.
- Unknown action (no matching policy key) denies.
- `admin` passes every policy, but an unknown action denies for everyone including `admin`.
- Deny throws `ForbiddenError` -> HTTP 403 / 403 page.

## 5. Mutation rule (every write in every app)

1. Server action only. No client writes, no API routes for writes.
2. `getActor()`, then `authorize(actor, "<app>.<action>", resource)`. Deny throws `ForbiddenError` (403).
3. Validate input and state transition. Failure throws `ValidationError` (422).
4. `withMutation(actor, fn)`: one transaction that updates the entity and calls `audit.append`. Never write audit rows outside `withMutation`.
5. Every mutable table has integer `version`. Update `WHERE id AND version`; zero matching rows throws `ConflictError` (409). `version` travels as a hidden form field.

Order matters: authorization before validation, so a forbidden action produces 403 (and no audit row) even when the input would also fail validation.

- Missing or malformed `version` is a `ValidationError` (422).
- Server actions return `{ ok: false, code, message }` on failure; the form renders `message` inline. The 409 message tells the user the record changed and to reload.
- Page-level 403 (a route the role may not see) renders the 403 page.

Every action is written as an inner `<action>As(actor, ...)` function that takes the actor explicitly; the exported server action is a thin wrapper that calls `getActor()` then the inner function. Tests call the inner function.

## 6. Audit log

Table `audit_log`:

| Column | Notes |
| --- | --- |
| `seq` | autoincrement |
| `actor_id` | user who performed the write |
| `app` | app id, e.g. `kyc` |
| `action` | e.g. `kyc.case.claim` |
| `entity_type`, `entity_id` | mutated entity |
| `before_json`, `after_json` | snapshots |
| `reason` | actor-supplied reason, when required |
| `created_at` | timestamp |
| `prev_hash`, `hash` | hash chain |

- `hash` = sha256 of these fields joined with `|`: `prev_hash`, `seq`, `actor_id`, `app`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `reason`, `created_at`. Nulls serialize as empty string; `created_at` as ISO 8601 UTC; `before_json`/`after_json` serialized with sorted keys. Genesis `prev_hash` is `"0"`.
- No code path updates or deletes audit rows. Append-only.
- `audit:verify` walks rows in `seq` order and recomputes each `hash`; prints `OK <n> rows` and exits 0, or prints `BROKEN at seq <n>` and exits 1.
- `/admin/audit`: admin only. Rows newest first. "Verify chain" button runs the same check and shows the result inline.
- Seed appends audit rows for user creation with `actor_id` = `system`, so the chain has content on a fresh DB. `actor_id` is not a foreign key, so the `system` actor is valid.

## 7. Registry

`AppManifest` fields: `id`, `name`, `basePath`, `roles` (who sees the app in nav), `nav[]`, `policies{}`, `auditActions[]`, `seed?(db)`.

- `getApps(actor)` returns the manifests whose `roles` include the actor's role.
- `scripts/gen-registry.ts` globs `src/apps/*/manifest.ts` and writes `src/platform/registry/generated.ts` (gitignored); runs on `predev` and `prebuild`. Adding an app means adding its folder and manifest — never editing `generated.ts` or any central list.
- The seed runner seeds users first, then calls each manifest's `seed?(db)`.
- `admin` sees all apps in nav regardless of `manifest.roles`.
- `generated.ts` is server-only: policies are functions, so it must never be imported from client components.
- `check` runs `scripts/gen-registry.ts` first so tests see the registry.
- With no apps present, `gen-registry` writes an empty array and the platform boots.

## 8. Adapters

External services are behind provider interfaces. Fakes are the default.

- `KycProvider.getAssessment(caseRef)` -> `{ riskScore, reasons[], documentUrl }`. The fake is deterministic: derived from a hash of `caseRef`, so the same `caseRef` always returns the same assessment.
- `PaymentsProvider.listTransactions(customerId)`; `PaymentsProvider.refund({ transactionId, amountCents, idempotencyKey })` -> `{ providerRef, status }`. The fake keeps an in-memory idempotency map; a repeated `idempotencyKey` returns the same `providerRef` without performing the refund again.
- `KYC_PROVIDER=real` or `PAYMENTS_PROVIDER=real` throws `"not implemented"`.

## 9. UI shell

- `/login` — credentials sign-in.
- `/` — app cards for the apps the actor can see (`getApps`).
- `AppShell` — nav built from manifests, header with the actor's name and role, sign out.
- `/admin/audit` — audit log viewer (admin only).
- 403 page, 404 page.

## 10. Platform tests (required)

Unit:

- Hash chain passes on an untampered log and fails at exactly the tampered `seq`.
- `authorize`: allow, deny, unknown action, admin.
- Optimistic update with a stale version -> 409.
- `withMutation` rollback: when `fn` throws after `audit.append`, nothing persists — neither the entity update nor the audit row.

E2E:

- Admin sees `/admin/audit` and Verify shows OK.
- Analyst gets 403 at `/admin/audit`.

## 11. CI

GitHub Actions run `check`, `e2e`, and Semgrep. Triggers: `pull_request` and `push` to `main`. Semgrep runs `semgrep scan --config p/default --error`.

## 12. Not building

Feature flags, real SSO login, Postgres, deployment, email, background jobs, any third app.

## 13. Acceptance criteria

1. Given no session, when I request any route under `/apps/*` or `/admin/*`, then I am redirected to `/login`.
2. Given seeded user `admin@demo.local` with password `demo`, when I submit `/login`, then a session is created and I land on `/` with app cards.
3. Given a logged-in `analyst`, when I open `/`, then I see only the apps whose `manifest.roles` include `analyst`, and the nav shows only those apps.
4. Given a policy `kyc.case.claim` that returns true for `analyst`, when `authorize(analyst, "kyc.case.claim", resource)` runs, then it does not throw.
5. Given a policy that returns false for `analyst`, when `authorize` runs, then it throws `ForbiddenError` (403).
6. Given an action with no key in `manifest.policies`, when `authorize` runs for any actor including `admin`, then it denies.
7. Given actor `admin`, when `authorize` runs for any defined policy, then it passes.
8. Given an entity at version 3, when an update runs with version 2, then zero rows match and `ConflictError` (409) is thrown and the entity is unchanged.
9. Given `withMutation(actor, fn)` where `fn` calls `audit.append` then throws, when the transaction settles, then neither the entity update nor the audit row exists in the database.
10. Given an untouched audit log, when `audit:verify` runs, then it prints `OK <n> rows` and exits 0.
11. Given one audit row whose field or `hash` was modified, when `audit:verify` runs, then it prints `BROKEN at seq <n>` at the first tampered row and exits 1.
12. Given the platform code, when I search for any path that updates or deletes `audit_log` rows, then none exists. (Reviewed manually — not an automated test.)
13. Given a mutation form, when it renders, then `version` is present as a hidden field and is submitted with the form.
14. Given the app tree, when I inspect route handlers, then no API route performs a write; all writes are server actions. (Reviewed manually — not an automated test.)
15. Given a logged-in `admin`, when I open `/admin/audit`, then rows appear newest first; when I click "Verify chain", then the same result as `audit:verify` is shown inline.
16. Given a logged-in `analyst`, when I open `/admin/audit`, then I get the 403 page.
17. Given `AUTH_OIDC_ISSUER` is unset, when auth initializes, then only the Credentials provider is registered; given it is set, then the OIDC provider is also registered.
18. Given the fake `KycProvider`, when `getAssessment` is called twice with the same `caseRef`, then both results are identical.
19. Given the fake `PaymentsProvider`, when `refund` is called twice with the same `idempotencyKey`, then the same `providerRef` is returned and the refund is performed once.
20. Given `KYC_PROVIDER=real`, when the provider is used, then it throws `"not implemented"`; same for `PAYMENTS_PROVIDER=real`.
21. Given a new `src/apps/<id>/manifest.ts`, when `scripts/gen-registry.ts` runs (or `predev`/`prebuild` fires), then the app appears in the registry with no hand edits to `generated.ts` and no central list anywhere.
22. Given a fresh `db:migrate` + `db:seed`, when I inspect users, then `analyst@`, `supervisor@`, `agent@`, `lead@`, `admin@` at `demo.local` exist and password `demo` verifies against the bcrypt hash for each.
23. Given a logged-in user, when I click sign out, then the session is cleared and `/apps/*` redirects to `/login`.
24. Given a logged-in user, when I request an unknown route, then the 404 page renders.
