# Spec 02 — KYC review queue (`src/apps/kyc`)

When a new customer signs up, the KYC vendor auto-approves most and flags some. Flagged sign-ups land in this queue. A KYC analyst opens the next case, sees customer details, the vendor's risk score and reasons, and the uploaded ID, then approves, rejects, or requests more info. Higher-risk cases need a supervisor. Compliance needs a record of every decision — who made it and why — which the platform audit log provides.

Users: a team of analysts and some supervisors.

## 1. Data model

Table `kyc_cases`:

| Column | Notes |
| --- | --- |
| `id` | primary key |
| `case_ref` | vendor case reference |
| `customer_name`, `customer_email` | |
| `risk_score` | integer 0–100 |
| `vendor_reasons_json` | vendor's reasons list |
| `document_url` | link to uploaded ID |
| `status` | see state machine |
| `assignee_id` | user who claimed the case |
| `decision_reason` | reason/note from the decider |
| `decided_by`, `decided_at` | |
| `version` | integer, optimistic concurrency |
| `created_at`, `updated_at` | |

## 2. Status state machine

Statuses: `pending`, `in_review`, `approved`, `rejected`, `needs_info`.

Transitions:

- `pending` -> `in_review` on claim
- `in_review` -> `approved` | `rejected` | `needs_info` on decide
- `needs_info` -> `in_review` on claim
- `approved` and `rejected` are terminal

Any other transition is invalid -> `ValidationError` (422).

## 3. Permissions

Supervisor threshold: `risk_score >= 70`.

- `analyst`
  - May claim only unassigned `pending` or `needs_info` cases with `risk_score < 70` (consistent with the decide rule).
  - May decide only own `in_review` cases with `risk_score < 70`.
  - Sees own cases plus unassigned cases. A direct URL to a case the analyst may not see returns the 403 page with no case data rendered.
- `supervisor`
  - May claim or decide any case.
  - Sees all cases.
- `admin` passes every policy (platform rule).

## 4. Validation

- `approve` / `reject` require `reason` >= 10 chars.
- `needs_info` requires a `note` >= 10 chars, stored in `decision_reason`, and clears `assignee_id`.
- Decisions are only valid from `in_review`; deciding an `approved` or `rejected` case -> 422.

## 5. Actions

All writes follow the platform mutation rule (server action, `authorize`, validate, `withMutation`, version check).

- `claimCase(id, version)` — assigns the case to the actor, `pending`/`needs_info` -> `in_review`.
- `claimNext()` — picks the unassigned `pending` case the actor may decide, ordered by `risk_score` desc then `created_at` asc, and claims it.
- `decideCase(id, version, decision, reason)` — `decision` is `approved` | `rejected` | `needs_info`; sets `decision_reason`, `decided_by`, `decided_at`; `needs_info` clears `assignee_id`.

## 6. Audit

Audit actions: `kyc.case.claim`, `kyc.case.decide`. Every row carries `before_json`/`after_json` snapshots and the `reason`.

## 7. Screens

- `/apps/kyc` — queue table: customer, risk badge (red at 70+), status, assignee, created. Sorted by `risk_score` desc. Status filter. "Claim next" button. The analyst sees only own + unassigned cases; the supervisor sees all.
- `/apps/kyc/[id]` — case detail: customer, vendor reasons, document link, score, status, assignee, history built from `audit_log` rows for the case, and the decision form. The form is disabled with the reason shown when the actor is not allowed to decide.
- No pagination. `document_url` is a placeholder string rendered as a link; it is never fetched or served.

## 8. Seed

30 cases:

- `risk_score` 5–95, about a third at 70+
- mostly `pending`
- a few `in_review` assigned to the seeded analyst, including one at `risk_score` 80 (so the forbidden-decide path is reachable)
- two `approved`, one `rejected`, one `needs_info`
- vendor reasons drawn from a fixed list of four

## 9. Acceptance criteria

1. Given unassigned `pending` cases with `risk_score` 80, 60, and 40, when an analyst runs `claimNext()`, then the score-60 case is assigned to the analyst with status `in_review` (the score-80 case is skipped because the analyst may not decide it), and a `kyc.case.claim` audit row exists.
2. Given an analyst's own `in_review` case with `risk_score` 40, when the analyst calls `decideCase(id, version, "approved", reason)` with a reason >= 10 chars, then the case is `approved` with `decided_by`/`decided_at` set, and a `kyc.case.decide` audit row has before/after snapshots and the reason.
3. Given an analyst's own `in_review` case with `risk_score` 80, when the analyst calls `decideCase`, then `ForbiddenError` (403) is thrown, the case is unchanged, and no audit row is written.
4. Given the same score-80 case, when the analyst opens `/apps/kyc/[id]`, then the decision form is disabled and shows the reason it is not allowed.
5. Given an `in_review` case with `risk_score` 80, when a supervisor calls `decideCase(id, version, "approved", reason)`, then the case is `approved`.
6. Given a valid `in_review` case, when `decideCase` is called with a 5-char reason, then `ValidationError` (422) is thrown and nothing changes.
7. Given an analyst's own `in_review` case, when the analyst decides `needs_info` with a note >= 10 chars, then status is `needs_info` and `assignee_id` is cleared; with a note < 10 chars, then 422.
8. Given a `needs_info` case (unassigned), when an analyst calls `claimCase`, then status is `in_review` and the analyst is assignee.
9. Given an `in_review` case at version N, when the test calls `decideCaseAs` twice with the same version N, then exactly one succeeds and the other gets `ConflictError` (409).
10. Given an `approved` case, when `decideCase` is called, then `ValidationError` (422) is thrown (`approved` is terminal); same for `rejected`.
11. Given a `pending` case assigned to another analyst, when a different analyst opens `/apps/kyc`, then that case is not listed; the analyst sees only own cases plus unassigned ones.
12. Given a supervisor on `/apps/kyc`, when the queue loads, then all cases are visible regardless of assignee.
13. Given the queue screen, when it renders, then rows are sorted by `risk_score` desc, cases at 70+ show a red risk badge, and the status filter narrows the list.
14. Given a case with prior claims/decisions, when I open `/apps/kyc/[id]`, then the history section shows the case's `audit_log` rows.
15. Given a seeded analyst on `/apps/kyc`, when I click "Claim next", then the highest-risk unassigned `pending` case I may decide becomes mine and `in_review`.
16. E2E: given a fresh migrate + seed, when an analyst claims and decides a low-risk case, a supervisor approves a score-80 case, and an admin opens `/admin/audit` and clicks "Verify chain", then each step succeeds and the chain shows `OK`.
