# Session log

| Session | Task | Surface and model | Start | End | $ used | Interventions | Root causes / what went wrong | Self-report |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Platform | Devin CLI, SWE-2 High | 11:08 | 11:56 | $0 | 1 — CI red on all three jobs after a green local run | `better-sqlite3@13` requires Node ≥22 and segfaulted on Node 20 (pinned to `^12.11.1`); Semgrep `p/default` blocked mutable action tags (pinned to SHAs) | [platform.md](sessions/platform.md) |
| 2 | KYC queue | Devin cloud, Fusion Normal — [session](https://app.devin.ai/sessions/a02a050954c144dc8878bef3b9765eb7) | 11:46 | 14:14 | $16.41 (includes environment setup) | 3 — registry heads-up; review follow-ups (7 Devin Review threads: 5 fixed, 2 answered); admin scoping decision | Registry regen bug on `e2e`/`seed` (fixed in PR #2 in parallel, and by the session itself); migration journal collision with refunds' `0001` on merge, resolved by regenerating KYC as `0002`; Insights size __ | [kyc.md](sessions/kyc.md) |
| 3 | Refunds | Devin cloud, Fusion Normal — [session](https://app.devin.ai/sessions/13b3c63c501847ae91ce5a7633881821) | 12:54 | 14:11 | $17.47 | 2 — rebase instructions after PR #2/#4 landed; nav gating (Approvals link hidden from agents) | Same registry regen bug, fixed in-session; Devin Review found approval could over-refund a partially refunded transaction (re-validates remaining balance inside `withMutation`); Insights size __ | [refunds.md](sessions/refunds.md) |
| 4 | Registry fix (PR #2) | Devin CLI, SWE-2 High | 13:17 | 13:26 | $0 | 0 | `gen-registry` only ran on `predev`/`prebuild`, so `db:seed` and `e2e` from a clean checkout saw a stale or empty `generated.ts`; now regenerated unconditionally before seed/e2e | commit `2b167b8` |
| 5 | Auth hardening (PR #4) | Devin CLI, SWE-2 High | 13:28 | 14:11 | $0 | 0 | Two gaps found by writing the threat model: Credentials provider stayed registered next to OIDC in production; `AUTH_SECRET` silently fell back to a public dev constant. Both fixed in `2b820a1` | [threat-model.md](threat-model.md) |
| 6 | Integration | Devin cloud, Fusion Normal — [session](https://app.devin.ai/sessions/a02a050954c144dc8878bef3b9765eb7) (same session as row 2, continued) | 14:25 | 14:45 | included in row 2 (same session) | 0 | Nothing failed. Fresh clone of `main`: 66 unit, 16 e2e, `audit:verify` OK → BROKEN after tamper → OK after re-seed; role nav verified in the browser | [integration.md](sessions/integration.md) |

Times are PDT. Session 1 times come from the local transcript (`bitter-lemming`,
first step 18:08Z → last step 18:56Z). Sessions 2, 3 and 6 use the cloud session
creation time and the last commit/merge time on `main`; sessions 4 and 5 use
commit times. `$ used` is $0 for CLI sessions (SWE-2 free tier; the
transcript records tokens only: 8.6M prompt / 94k completion for session 1).
Cloud costs are from the org usage page: total cloud spend for the day was
$33.88 (KYC $16.41, which includes the initial environment setup; refunds
$17.47). Insights sizes are not filled in yet (`__`).

## Cost of app N+1

Take the smaller of the two app sessions (rows 2 and 3) as the cost of adding
the next tool on this platform: **$16.41 or less, about 1h20m wall clock** (session 3,
refunds at $17.47 was the shorter session; KYC at $16.41 was cheaper but that
figure includes environment setup, so the marginal app cost is under $16.41).
The KYC session ran longer because it also set up the environment and was interrupted
by the registry and merge issues, both of which are fixed on `main` now.

## Findings

1. **CI Node mismatch on day one.** Local Node 24 passed everything; CI on
   Node 20 segfaulted in `better-sqlite3@13`. Pinning `^12.11.1` and the
   `.nvmrc`/`engines`/CI at 20 fixed it. The lesson: run the pinned version
   locally before the first push.
2. **Registry regen bug found in human review, not by the agent.** `gen-registry`
   ran on `predev`/`prebuild` only, so `db:seed` and `e2e` on a clean checkout
   used a stale `generated.ts`. Both app sessions hit it and fixed it
   themselves, which meant touching the platform — the `new-internal-tool`
   skill says an app session must not do that. The CLI fix (PR #2) is the one
   that landed; the app branches were rebased onto it.
3. **Migration journal collision.** Both app sessions generated a `0001_*`
   migration from the same base. Refunds merged first; KYC regenerated its
   migration as `0002_kyc_cases` while merging `main`. Sequential integers in
   `drizzle/meta/_journal.json` are a coordination point between parallel
   sessions.
4. **Devin Review caught the over-refund on approval.** `approveRefundAs`
   trusted the amount validated at request time; a second refund in between
   could push the total past the transaction balance. Fixed by re-validating
   against the remaining balance inside the approval transaction
   (`9253293`), with a unit test.
5. **Threat model found two auth gaps.** Writing `docs/threat-model.md`
   surfaced that the dev Credentials login stayed active in production and
   that `AUTH_SECRET` fell back to a public constant. Both fixed in PR #4.
6. **Devin declined an instruction that would have broken admin access.** Asked
   to scope visibility by role, the session pointed out the change as worded
   would also lock out `admin` (who must pass every policy per `AGENTS.md`)
   and proposed a narrower fix instead. The refunds `NavItem.roles` gating
   keeps admin visibility the same way.
7. **Review follow-ups are cheap but not free.** The KYC PR took seven Devin
   Review threads across three rounds (reason length cap, `ForbiddenError`-only
   403 mapping, document link scheme guard, claim-next retry, history read
   inside the 403 boundary). Each round was under ten minutes; two findings
   were answered rather than changed (bounded retry, seed "skip if any row").

## Decisions Devin made that I accepted

1. **Node 24 local / 20 pinned** — verified on 24, then installed 20.20.2 via nvm and re-verified `check` + `e2e` before pushing the CI fix.
2. **bcryptjs** instead of native `bcrypt` — pure JS, same hash format, no native build.
3. **`users.version`** — gives `optimisticUpdate`/`withMutation` a real mutable platform table to test against.
4. **Test manifest injection** — `setManifestsForTests()` so `authorize` is unit-testable without app folders.
5. **`experimental.authInterrupts`** — required for `forbidden()` in Next 15.5; without it 403s return 500.
6. **Dev auth secret fallback** — `AUTH_SECRET ?? "dev-only-insecure-secret"` so a fresh clone runs with zero setup. (Narrowed to dev/test only in PR #4.)
7. **No `import "server-only"` in `generated.ts`** — it hard-throws under `tsx` scripts outside the bundler; enforced by convention.
8. **`better-sqlite3` pinned to `^12.11.1`** — v13 needs Node ≥22; v12 covers 20–26.
9. **Action refs pinned to commit SHAs** — Semgrep `p/default` blocks mutable tags.
10. **Inner `*As` functions in `service.ts`, not the `"use server"` file** — both app sessions, independently: exporting them from an action file would expose actor-spoofing endpoints.
11. **Version check before status check in decide/approve** — a stale retry gets 409, not 422 (KYC AC9, refunds AC9).

## Note

My edit adding step 10 (session docs) to `new-internal-tool/SKILL.md` was uncommitted and got folded into Devin's commit `288e776` ("Add platform session doc").
