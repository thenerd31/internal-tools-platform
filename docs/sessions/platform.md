# Session: platform build (PR #1, branch `platform`)

## What was built

The shared platform layer from `docs/01-spec-platform.md`. No app screens; `src/apps/` is empty and `gen-registry` emits an empty manifest array.

- **Scaffold**: Next.js 15 App Router, TypeScript strict, npm, Tailwind 4 + shadcn-style components (`src/platform/ui`), ESLint flat config, drizzle-kit migrations.
- **DB**: `users` + `audit_log` tables; better-sqlite3 at `./data/app.db`; `db:migrate`/`db:seed` scripts.
- **Auth**: Auth.js v5, JWT sessions (8h), Credentials provider against seeded users (bcrypt cost 10), OIDC provider registered only when `AUTH_OIDC_ISSUER` is set. `getActor()`, middleware gates `/apps/*` + `/admin/*`.
- **Authz**: `authorize(actor, action, resource)` over `manifest.policies`; unknown denies for everyone including admin. `runAction` maps `ForbiddenError`/`ValidationError`/`ConflictError` to `{ ok: false, code, message }`.
- **DB helpers**: `withMutation(actor, fn)` (one transaction, full rollback), `optimisticUpdate(tx, table, id, expectedVersion, patch)` (the only version-guarded update path; zero rows → `ConflictError`).
- **Audit**: append-only `audit_log` with canonical sha256 chain; `audit:verify` prints `OK <n> rows` / `BROKEN at seq <n>`; `/admin/audit` newest-first with a Verify chain button hitting the same verify function.
- **Registry**: `scripts/gen-registry.ts` globs `src/apps/*/manifest.ts` → gitignored `generated.ts` on `predev`/`prebuild`/`precheck`; `getApps(actor)` filters by role (admin sees all).
- **Adapters**: `FakeKycProvider` (deterministic from `caseRef` hash), `FakePaymentsProvider` (in-memory idempotency map); `*_PROVIDER=real` throws `"not implemented"`.
- **Shell**: `/login`, `/` app cards (empty state), `AppShell` (nav, name+role, sign out), `/admin/audit`, 403 and 404 pages.
- **CI**: `check`, `e2e`, Semgrep `p/default` on `pull_request` + push to `main`, Node 20.

## Decisions where the spec was ambiguous

- **Node 24 local / 20 CI**: spec pins Node 20. Local machine only had 24; verified on 24, then installed 20.20.2 via nvm and re-verified `check` + `e2e` green before pushing the CI fix. `.nvmrc`/`engines`/CI all say 20.
- **bcryptjs** instead of native `bcrypt`: pure-JS, same algorithm, no native build. Spec says "bcrypt" — the hash format is identical.
- **`users.version`**: added so `optimisticUpdate`/`withMutation` have a real mutable platform table to test. Spec defines no other mutable platform table.
- **`setManifestsForTests()`**: test-only registry injection so `authorize` can be unit-tested without app folders on disk.
- **`experimental.authInterrupts: true`**: required for `forbidden()` in Next 15.5 — otherwise `/admin/audit` 403s return 500.
- **Dev auth secret fallback**: `AUTH_SECRET ?? "dev-only-insecure-secret"` so a fresh clone runs dev/e2e/CI with zero setup. Only signs local demo JWTs.
- **No `import "server-only"` in `generated.ts`**: the package hard-throws when `tsx` scripts (`db-seed`) load the registry outside the bundler. Server-only enforced by convention + header comment.
- **`better-sqlite3` pinned to `^12.11.1`**: v13 requires Node ≥22 and segfaulted Node 20 runners. v12 supports 20–26.
- **Action refs pinned to SHAs**: Semgrep `p/default` blocks mutable tags. `checkout@34e1148` (v4.3.1), `setup-node@49933ea` (v4.4.0), `setup-python@a26af69` (v5.6.0).
- **`e2e` script runs migrate+seed first** so it's green from a fresh DB.
- **`buildProviders` split out of `auth/index.ts`**: importing `NextAuth` in vitest pulls `next/server` and crashes; the provider factory lives in `auth/providers.ts` for testability.
- **Auth config split**: `auth/config.ts` is edge-safe (no providers/db) for middleware; `auth/index.ts` adds providers needing better-sqlite3.
- **`documentUrl` fake**: `/placeholder-docs/<caseRef>` — rendered as a link, never fetched (spec 02).
- **PR screenshots**: `gh` has no image-upload API, so screenshots are committed under `docs/pr-assets/` on the branch and embedded via blob URLs. Safe to drop before merge.

## Test counts

- Unit (vitest): **28 tests, 7 files** — audit chain (4), authz+runAction (9), optimisticUpdate/withMutation (4), adapters (3), registry gen + getApps (4), auth providers (2), seed (2).
- E2E (Playwright chromium): **10 tests** — redirects, login, admin audit + verify, analyst 403 (status + page), no audit nav link, sign out, 404, bad-credentials error, screenshots at 1280/375.
- `next build` clean. `audit:verify` → `OK 5 rows`; tampered `reason` at seq 3 → `BROKEN at seq 3` exit 1; re-seeded after.

## CI failure and root causes

First run (`34634735031`) failed all three jobs:

- **check + e2e**: vitest workers and `db-migrate` died with SIGSEGV (exit 139). Root cause: `better-sqlite3@13` engines `node: >=22`; CI runs Node 20. Fixed by pinning `^12.11.1`. Verified under Node 20.20.2 locally.
- **semgrep**: 6 blocking findings, all `github-actions-mutable-action-tag`. Fixed by SHA-pinning the three actions.

Second run (`34635276110`): all green — check 1m49s, e2e 2m19s, semgrep 21s.

## Flags for the reviewer

- `npm audit` reports 6 vulns (5 moderate, 1 high), all transitive dev deps — esbuild via drizzle-kit, PostCSS via Tailwind. `npm audit fix --force` would break drizzle-kit; left as-is.
- Acceptance criterion 13 (hidden `version` field in mutation forms) is **N/A** — no app mutation forms exist yet. The contract is enforced by `optimisticUpdate` + `runAction`; first app PR should prove it end-to-end.
- Criteria 12/14 (no audit mutations, no API-route writes) are manual-review items per spec, not automated tests.
- GitHub annotates that `actions/checkout`/`setup-python` target deprecated Node 20 — that's the actions' own runtime, not the project toolchain (still Node 20 via setup-node).
- `server-only` dep was installed then removed; enforcement is by convention only — a client-component import of `generated.ts` would bundle policies/functions to the client. Worth a lint rule if this becomes real.
