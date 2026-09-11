# internal-tools-platform

A shared platform for internal tools: one layer for login, authorization, audit logging, app discovery, external-service adapters and the UI shell, with each tool living in its own folder under `src/apps/<id>/`. Two tools are built on it so far, a KYC review queue and a refunds desk, each written by a coding agent from a spec in `docs/`. The point was to measure what it costs to add a tool this way compared with a Power Apps deployment; `docs/session-log.md` has the numbers.

## Quickstart

Requires Node 20 (`.nvmrc`) and npm.

```sh
npm install
npm run db:migrate   # create ./data/app.db and apply migrations
npm run db:seed      # demo users (password "demo"), 30 KYC cases, refunds customers and transactions
npm run dev          # http://localhost:3000
```

Sign in at `/login`. Admin lands on both apps and the audit log; other roles see only their app.

## Seeded users

| Email | Role | Sees |
| --- | --- | --- |
| `analyst@demo.local` | analyst | KYC queue: unassigned cases and own cases; can claim and decide only below risk 70 |
| `supervisor@demo.local` | supervisor | KYC queue: every case, can decide risk 70 and above |
| `agent@demo.local` | agent | Refunds: customer search, refunds up to 50000 cents |
| `lead@demo.local` | lead | Refunds plus the Approvals queue |
| `admin@demo.local` | admin | Both apps and `/admin/audit`; passes every policy |

Password for all: `demo`.

## Checks

| Command | What it does |
| --- | --- |
| `npm run check` | regenerates the app registry, then `tsc`, `eslint`, and vitest (66 unit tests) |
| `npm run e2e` | fresh migrate and seed, then Playwright chromium (16 tests, screenshots at 1280 and 375px) |
| `npm run audit:verify` | walks `audit_log` in `seq` order and recomputes the hash chain; prints `OK <n> rows` (exit 0) or `BROKEN at seq <n>` (exit 1) |

CI runs `check`, `e2e` and Semgrep on every pull request.

### Tamper demo

Every write goes through one transaction that updates the row and appends an audit row whose `hash` covers the previous row's hash. Changing any stored row breaks the chain from that point on:

```sh
npm run audit:verify                                   # OK 5 rows
node -e "require('better-sqlite3')('data/app.db').prepare(\"UPDATE audit_log SET reason='tampered' WHERE seq=3\").run()"
npm run audit:verify                                   # BROKEN at seq 3   (exit 1)
rm data/app.db* && npm run db:migrate && npm run db:seed
npm run audit:verify                                   # OK 5 rows
```

The same check is behind the "Verify chain" button on `/admin/audit`. Stop `npm run dev` before deleting the database file; SQLite keeps it open.

## How it fits together

![Platform](docs/diagrams/01-platform.png)

![KYC review queue](docs/diagrams/02-kyc.png)

![Refunds](docs/diagrams/03-refunds.png)

Rules every app follows are in `AGENTS.md`. In short: writes are server actions only; each one calls `getActor()`, then `authorize(actor, "<app>.<action>", resource)`, validates input and state, and runs inside `withMutation`, which updates the row `WHERE id AND version` and appends the audit row in the same transaction. Apps are found by globbing `src/apps/*/manifest.ts`; there is no central list.

## Apps

### KYC review queue (`/apps/kyc`)

Analysts claim the highest-risk unassigned case below 70 ("Claim next") or a specific one, then approve, reject, or send it back for more information with a reason of at least 10 characters. Cases at risk 70 and above can only be decided by a supervisor; the form is disabled for analysts with the reason shown, and the server rejects the action with 403 regardless. The case page shows the vendor's risk reasons, a placeholder document link and the case's audit history. Spec: `docs/02-spec-kyc.md`.

### Refunds (`/apps/refunds`)

Agents search customers, open a customer's transactions and issue refunds up to 50000 cents directly. Larger refunds wait in `/apps/refunds/approvals` for a lead who did not request them. Every refund carries a client-generated idempotency key, so a retried request returns the existing refund instead of paying twice. Spec: `docs/03-spec-refunds.md`.

## How this was built

Six sessions with Devin, each documented in `docs/sessions/`:

| # | Session | Where it ran | Notes |
| --- | --- | --- | --- |
| 1 | Platform (PR #1) | Devin CLI, SWE-2 High | [platform.md](docs/sessions/platform.md) |
| 2 | KYC review queue (PR #3) | Devin cloud, Fusion Normal — [session](https://app.devin.ai/sessions/a02a050954c144dc8878bef3b9765eb7) | [kyc.md](docs/sessions/kyc.md) |
| 3 | Refunds (PR #5) | Devin cloud, Fusion Normal — [session](https://app.devin.ai/sessions/13b3c63c501847ae91ce5a7633881821) | [refunds.md](docs/sessions/refunds.md) |
| 4 | Registry regen fix (PR #2) | Devin CLI, SWE-2 High | commit `2b167b8` |
| 5 | Auth hardening (PR #4) | Devin CLI, SWE-2 High | [threat-model.md](docs/threat-model.md) |
| 6 | Integration check | Devin cloud, Fusion Normal — [session](https://app.devin.ai/sessions/a02a050954c144dc8878bef3b9765eb7) | [integration.md](docs/sessions/integration.md) |

Commits from cloud sessions carry a `Co-Authored-By: Devin AI` trailer. Commits from CLI sessions are under my own identity (`Aswin Surya`).

### Cost

From `docs/session-log.md` (times PDT; `__` means not yet read from the usage page):

| Session | Start | End | $ used | Interventions |
| --- | --- | --- | --- | --- |
| Platform | 11:08 | 11:56 | $0 (CLI, in seat) | 1 |
| KYC queue | 11:46 | 14:14 | $__ | 3 |
| Refunds | 12:54 | 14:11 | $__ | 2 |
| Registry fix | 13:1_ | 13:26 | $0 | 0 |
| Auth hardening | 13:2_ | 14:11 | $0 | 0 |
| Integration | 14:25 | __ | $__ | 0 |

Cost of the next app, taken as the smaller of the two app sessions: $__ and about 1h20m wall clock (refunds), including review follow-ups.

## Not built and why

- **Feature flags.** Two apps and five roles did not need them; role checks in manifests cover who sees what.
- **Real SSO.** An OIDC provider is registered when `AUTH_OIDC_ISSUER` is set, but nothing has been tested against a real issuer. Dev login uses seeded passwords and is disabled in production unless `AUTH_ALLOW_DEV_LOGIN=true`.
- **Postgres.** SQLite in a file is enough to evaluate the approach and keeps setup to `npm install`. Drizzle migrations would carry over, but the `withMutation`/`optimisticUpdate` helpers assume better-sqlite3's synchronous transactions.
- **Deployment.** There is no Dockerfile or hosting config; the goal was to measure build cost, not to run it.

## Known limits

- **The audit hash chain only detects tampering, and only from a copy you trust.** Anyone who can rewrite `data/app.db` can recompute the whole chain. Detection needs an external anchor (periodic hash export to a store the app cannot write).
- **Tables are cramped at 375px.** The queue and transaction tables were built for a desktop; on a phone-width screen cells wrap to one word per line and wider tables need horizontal scrolling. See the 375px screenshots in `docs/pr-assets/`.
- **Policies are booleans, so denials cannot say why.** `authorize` returns allow or throw. The KYC form reconstructs a human-readable reason by re-running the same checks in `decideDisabledReason`, which duplicates the policy text.
- **Open `npm audit` findings.** `npm install` reports 6 vulnerabilities (5 moderate, 1 high) in dev dependencies (esbuild via drizzle-kit, PostCSS via Tailwind); `npm audit --omit=dev` reports 2 (1 moderate, 1 high) in PostCSS as bundled by `next`. The only offered fix is a major Next upgrade. Left as-is.
- **Concurrency tests are sequential.** better-sqlite3 runs one transaction at a time, so the "two decisions with the same version" tests prove the version check, not true parallel writers.
