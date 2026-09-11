# Session: KYC review queue

## What was built

- Added the `kyc_cases` Drizzle schema and migration discovery alongside the
  shared platform schema.
- Added a deterministic, idempotent seed with 30 cases and no KYC audit rows.
- Added KYC manifest policies for viewing, claiming, and deciding cases.
- Added optimistic claim and decision service functions with append-only audit
  snapshots, conflict handling, and read helpers.
- Added server actions, queue/detail pages, status filtering, claim controls,
  disabled decision explanations, vendor reasons, document links, and case
  history.
- Added unit and Playwright coverage for the numbered acceptance criteria and
  documented the parallel-safe audit ordering assertion.

## Decisions

- The Drizzle config uses a schema array so app tables are included in
  migrations.
- Inner `claim*As` and `decideCaseAs` functions live in `service.ts`, not the
  `"use server"` action module, so Vitest can import them without loading
  NextAuth.
- Status and transition checks are validation errors (422), while role, risk,
  and ownership checks are authorization errors (403).
- Version mismatches are checked before state validation for decisions, so a
  stale retry returns 409.
- The seed writes no audit rows; seeded audit history is created only through
  user mutations.
- There is one seeded analyst, so the pending case hidden from the analyst
  queue is assigned to `seed-supervisor`.
- The score-80 in-review case is assigned to `seed-analyst` so the forbidden
  decision path is reachable while its supervisor path remains testable.
- The existing audit e2e assertion was relaxed from an exact sequence of 5 to
  newest-first adjacent sequence numbers because Playwright runs spec files in
  parallel and KYC mutations add audit rows.
- Placeholder document URLs are rendered as links and are never fetched.

## Test counts

- Unit/type/lint suite: 45 Vitest tests across 8 files.
- E2E suite: 11 Playwright tests, including KYC workflows and six KYC
  screenshots at 1280px and 375px.

## Reviewer flags

- `npm ci` reports the repository's existing transitive vulnerability count;
  this change does not alter dependency versions.
- Vitest 5 declares a Node 22 engine range even though the project and CI use
  Node 20; the suite is run with Node 20 as specified.
- `src/platform/**` and the generated registry are intentionally untouched.
