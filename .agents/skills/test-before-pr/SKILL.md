---
name: test-before-pr
description: Pre-PR verification for this platform — fresh DB, check and e2e green, audit chain verify pass and tamper-fail, per-role manual flows with a forbidden action each, screenshots at 1280 and 375, all attached to the PR. Use before opening any pull request.
---

# Test before PR

Run this whole checklist before opening a PR. Attach evidence to the PR.

## Checklist

1. Fresh DB: delete `./data/app.db`, run `db:migrate`, then `db:seed`.
2. `check` (typecheck + lint + vitest) green.
3. `e2e` (Playwright chromium) green.
4. `audit:verify` prints `OK <n> rows`, exit 0.
5. Manual pass: log in as each role touched by the change and click through the main flow end to end.
6. For each of those roles, attempt one forbidden action and confirm it is denied (403 / `ForbiddenError`).
7. Screenshots at 1280px and 375px viewport widths.
8. Log in as admin, open `/admin/audit`, click "Verify chain", and capture the inline result.
9. Tamper check: modify one audit row's field or `hash`, run `audit:verify`, confirm `BROKEN at seq <n>` with exit 1. Restore a clean DB afterward (re-seed).
10. Attach to the PR: screenshots, `audit:verify` output (pass and tamper-fail), and the acceptance-criteria pass/fail list with every ambiguity and the decision made.
