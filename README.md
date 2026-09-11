# internal-tools-platform

Shared internal-tools platform (auth, authz, audit, registry, adapters, UI shell) with per-tool apps under `src/apps/<id>/`. See `AGENTS.md` for conventions and `docs/` for specs.

## Development

Requires Node 20 (`.nvmrc`). Package manager: npm.

```sh
npm install
npm run db:migrate   # create ./data/app.db and apply migrations
npm run db:seed      # seed demo users (password "demo") and app data
npm run dev          # http://localhost:3000
```

Checks: `npm run check` (registry codegen + typecheck + lint + unit tests), `npm run e2e` (fresh migrate+seed, then Playwright chromium), `npm run audit:verify` (audit hash chain).

Seeded users: `analyst@`, `supervisor@`, `agent@`, `lead@`, `admin@` at `demo.local`, password `demo`.

## Apps

### Refunds

Support agents look up a customer's transactions and issue refunds. Agents issue refunds up to 50000 cents directly; larger refunds go to a `pending_approval` queue that leads approve or reject (a lead cannot approve their own request). Leads and admins issue any amount directly. Every refund is idempotent via a client-generated `idempotency_key` (UUID v4) and is fully audit-logged (`refunds.refund.request/issue/approve/reject`).

Screens:

- `/apps/refunds` — customer search (agent, lead)
- `/apps/refunds/customers/[id]` — transactions, Refund dialog, refund history (agent, lead)
- `/apps/refunds/approvals` — pending approval queue (lead only; others get 403)

Run it: `npm run db:migrate && npm run db:seed && npm run dev`, then sign in as `agent@demo.local` or `lead@demo.local` (password `demo`).
