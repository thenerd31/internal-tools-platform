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
