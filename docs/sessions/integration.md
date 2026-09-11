# Session: integration check on `main`

Fresh clone of `main` at `85a6a94` (merge of PR #3), after PRs #1–#5 landed.
Node `v20.20.2`, npm `10.8.2`. Raw command output is summarized below; no code
was changed in this session.

## Commands

| Step | Command | Exit | Result |
| --- | --- | ---: | --- |
| 1 | `git clone` | 0 | clean clone, `drizzle/` has `0000_damp_boomerang`, `0001_brown_risque` (refunds), `0002_kyc_cases` (KYC) |
| 2 | `npm install` | 0 | installs; reports 6 vulnerabilities (5 moderate, 1 high) |
| 3 | `npm run db:migrate` | 0 | `applied migrations` |
| 4 | `npm run db:seed` | 0 | `seeded users and app data` |
| 5 | `npm run check` | 0 | registry codegen, tsc, eslint, vitest: 66 tests / 9 files passed |
| 6 | `npm run e2e` | 0 | fresh migrate+seed, Playwright chromium: 16 tests passed |
| 7 | `npm run audit:verify` | 0 | `OK 11 rows` (5 seed rows + 6 rows written by the e2e run) |
| 8 | `UPDATE audit_log SET reason='tampered' WHERE seq=3` | 0 | 1 row changed |
| 9 | `npm run audit:verify` | 1 | `BROKEN at seq 3` |
| 10 | delete `data/app.db*`, `db:migrate`, `db:seed`, `audit:verify` | 0 | `OK 5 rows` |

`npm audit --omit=dev` (production deps only): 2 vulnerabilities (1 moderate,
1 high), both PostCSS advisories reached through `next`'s bundled `postcss`. The
only offered fix is `next@16`, a breaking change. Left as-is; listed under
"Known limits" in the README.

## Browser checks (dev server from the fresh clone, 1280px)

Logged in as each role at `/` and read the nav links and app cards.

| Role | Nav links seen | Expected | Screenshot |
| --- | --- | --- | --- |
| admin | KYC queue, Refunds, Approvals, Audit log | both apps + admin audit | `docs/pr-assets/integration-admin-nav-1280.png` |
| analyst | KYC queue | KYC only | `docs/pr-assets/integration-analyst-nav-1280.png` |
| agent | Refunds | Refunds only, no Approvals | `docs/pr-assets/integration-agent-nav-1280.png` |
| lead | Refunds, Approvals | Refunds + Approvals | `docs/pr-assets/integration-lead-nav-1280.png` |

Audit tamper demo through the UI (`/admin/audit`, "Verify chain" button, as admin):

| State | Result shown | Screenshot |
| --- | --- | --- |
| clean seed | `OK 5 rows` | `docs/pr-assets/integration-audit-clean-1280.png` |
| after `UPDATE audit_log ... WHERE seq=3` | `BROKEN at seq 3` | `docs/pr-assets/integration-audit-tampered-1280.png` |

The database was deleted and re-seeded after the tampered screenshot; the final
`audit:verify` reads `OK 5 rows`.

## Notes

- The SQLite file cannot be deleted and recreated while the dev server holds it
  open (`SQLITE_IOERR_SHORT_READ` on the next migrate). Stop the server before
  removing `data/app.db`, `data/app.db-shm`, `data/app.db-wal`.
- Both apps and the platform tests coexist without changes: the KYC migration
  was renumbered to `0002` when PR #3 merged `main`, so the journal has no
  duplicate index.
- Nothing failed. No follow-up code changes are needed from this check.
