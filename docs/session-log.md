# Session log

| Session | Task | Surface and model | Start | End | $ used | Interventions | Root causes / what went wrong | Self-report |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Platform | Devin CLI, SWE-2 High | 11:08 | 11:56 |  | 1 — CI red on all three jobs after a green local run | `better-sqlite3@13` requires Node ≥22 and segfaulted on Node 20 (pinned to `^12.11.1`); Semgrep `p/default` blocked mutable action tags (pinned to SHAs) | [platform.md](sessions/platform.md) |
| 2 | KYC queue |  |  |  |  |  |  |  |
| 3 | Refunds |  |  |  |  |  |  |  |

Times are PDT from the local transcript (`bitter-lemming`, first step 18:08Z → last step 18:56Z). `$ used` comes from the org usage page — not available in the CLI or transcript; left blank.

## Decisions Devin made that I accepted

1. **Node 24 local / 20 pinned** — verified on 24, then installed 20.20.2 via nvm and re-verified `check` + `e2e` before pushing the CI fix.
2. **bcryptjs** instead of native `bcrypt` — pure JS, same hash format, no native build.
3. **`users.version`** — gives `optimisticUpdate`/`withMutation` a real mutable platform table to test against.
4. **Test manifest injection** — `setManifestsForTests()` so `authorize` is unit-testable without app folders.
5. **`experimental.authInterrupts`** — required for `forbidden()` in Next 15.5; without it 403s return 500.
6. **Dev auth secret fallback** — `AUTH_SECRET ?? "dev-only-insecure-secret"` so a fresh clone runs with zero setup.
7. **No `import "server-only"` in `generated.ts`** — it hard-throws under `tsx` scripts outside the bundler; enforced by convention.
8. **`better-sqlite3` pinned to `^12.11.1`** — v13 needs Node ≥22; v12 covers 20–26.
9. **Action refs pinned to commit SHAs** — Semgrep `p/default` blocks mutable tags.

## Note

My edit adding step 10 (session docs) to `new-internal-tool/SKILL.md` was uncommitted and got folded into Devin's commit `288e776` ("Add platform session doc").
