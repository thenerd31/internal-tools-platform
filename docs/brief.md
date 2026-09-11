# Brief: internal-tools-platform

Decisions only. Expand this into AGENTS.md, docs/01-spec-platform.md, docs/02-spec-kyc.md, docs/03-spec-refunds.md, .agents/skills/new-internal-tool/SKILL.md, .agents/skills/test-before-pr/SKILL.md. If this brief doesn't have info u need, write TODO instead of guessing and surface it.

## Context

A prospective Cognition client, a Series C fintech startup with ~60 engineers, currently pays $250K/year for an internal tool platform (e.g. Microsoft Power Apps). Currently, they use Microsoft Power Apps for 3 internal apps – a KYC review queue, a refunds dashboard, and a feature-flag admin panel – however they are planning to build at least 10 more soon. Their VP of Engineering is questioning whether the team can use Devin to build these internal tools, potentially saving the license cost and gaining full customization control.
You've been asked to evaluate this question and deliver a recommendation. 

## My thoughts

Client story:
 Companies buy power apps bc ops teams needs tools faster than eng can build them
They’re paying for all the plumbing alr in power apps (identity, sso, roles, backed up db, audit trail, connectors)
Power apps premium costs $20 / user / month (https://www.microsoft.com/en-us/power-platform/products/power-apps/pricing)
So $250k this business is spending is approx 1041 seats
60 eng are prob not the users, then, most likely it’s kyc analysts, support staff, nontechnical ppl
2 conclusions
Adding 10 apps barely changes bill bc it’s by seat
Pain that justifies building it is customization since the 3 apps mentioned (kyc review queue, refunds dashboard, admin panel) are most likely UIs over company’s own internal systems (their kyc vendor(s), ledger, and flag config - power apps is weakest and code is strongest
Devin replaces labor of writing apps, replaces none of the platform guarantees
The VP should decide whether team should build the plumbing once (as a shared layer) with Devin or keep the power apps 

KYC Review Queue
When new customer signs up, KYC vendor auto approves most and flags some
Flagged ones go in queue
Kyc analyst opens next case, sees customer details, vendor’s risk score and reasons, uploaded ID and decides to approve, reject, or request more info
Higher risk cases usually need supervisor
Compliance also needs record of every decision, who made it, and why
Users of this are a team of analysts and some supervisors
Actions are claiming a case, deciding with reason, and escalating

Refunds Dashboard
Support agents look up customer’s transactions and give refunds
Agent can do small refunds, larger ones need a lead’s approval
Every refund hits payment processor and ledger so shld be idempotent and fully logged
Users are support agents, support leads, finance staff reading the log
Actions are searching customer, viewing transactions, requesting or issuing refund, approving

Feature-flag admin panel
Engineers and pms toggle flags that enable feature for percentage of users or specific segment (like LaunchDarkly)
Users are engineers and PMs
Actions are creating flags, toggling, targeting, and viewing history


## Stack (no substitutions)

- Next.js 15 App Router, TypeScript strict, Node 20
- Drizzle ORM, better-sqlite3, DB at ./data/app.db (gitignored), drizzle-kit migrations
- Auth.js v5: Credentials provider for dev; OIDC provider registered only when AUTH_OIDC_ISSUER is set
- shadcn/ui + Tailwind
- Vitest, Playwright (chromium), ESLint
- GitHub Actions: check, e2e, Semgrep default rules
- Commands: db:migrate, db:seed, dev, check (typecheck+lint+vitest), e2e, audit:verify

## Layout

- src/platform/{auth,authz,audit,registry,adapters,ui,db}
- src/apps/<id>/{manifest.ts,schema.ts,actions.ts,seed.ts,*.test.ts}, pages under app/apps/<id>/
- scripts/gen-registry.ts globs src/apps/*/manifest.ts, writes src/platform/registry/generated.ts (gitignored), runs on predev and prebuild
- No central list of apps anywhere. No hand edits to generated.ts.

## Roles and users

- Roles: analyst, supervisor, agent, lead, admin. Admin passes every policy.
- Seeded: analyst@, supervisor@, agent@, lead@, admin@ at demo.local, password "demo", bcrypt.

## Mutation rule (every write in every app)

1. Server action only. No client writes, no API routes for writes.
2. getActor(), then authorize(actor, "<app>.<action>", resource). Deny throws ForbiddenError (403).
3. Validate input and state transition. Failure throws ValidationError (422).
4. withMutation(actor, fn): one transaction that updates the entity and calls audit.append. Never write audit rows outside it.
5. Every mutable table has integer version. Update WHERE id AND version; zero rows throws ConflictError (409). Version travels as a hidden form field.

## Authorization

- authorize looks up manifest.policies["<app>.<action>"]; Policy = (actor, resource?) => boolean. Unknown action denies.
- Routes under /apps/* and /admin/* require a session; else redirect to /login.

## Audit log

- Table audit_log: seq (autoincrement), actor_id, app, action, entity_type, entity_id, before_json, after_json, reason, created_at, prev_hash, hash.
- hash = sha256 of prev_hash + every field, joined with "|". Genesis prev_hash "0".
- No code path updates or deletes audit rows.
- audit:verify walks rows in seq order, recomputes; prints "OK <n> rows" exit 0, or "BROKEN at seq <n>" exit 1.
- /admin/audit: admin only, newest first, "Verify chain" button showing the same result inline.

## Registry

- AppManifest: id, name, basePath, roles (who sees it in nav), nav[], policies{}, auditActions[], seed?(db).
- getApps(actor) filters by role. Seed runner calls each manifest.seed after users.

## Adapters

- KycProvider.getAssessment(caseRef) -> { riskScore, reasons[], documentUrl }. Fake is deterministic from a hash of caseRef.
- PaymentsProvider.listTransactions(customerId); refund({ transactionId, amountCents, idempotencyKey }) -> { providerRef, status }. Fake keeps an in-memory idempotency map; repeated key returns the same providerRef.
- Fakes by default; env KYC_PROVIDER=real / PAYMENTS_PROVIDER=real throws "not implemented".

## UI shell

- /login, / (app cards the actor can see), AppShell with nav from manifests, header with name and role, sign out, /admin/audit, 403 page, 404 page.

## Platform tests

- Unit: hash chain pass and fail at the tampered seq; authorize allow/deny/unknown/admin; optimisticUpdate stale -> 409; withMutation rollback after audit.append persists nothing.
- e2e: admin sees /admin/audit and Verify OK; analyst gets 403 there.

## App 1: KYC review queue (src/apps/kyc)

- Table kyc_cases: id, case_ref, customer_name, customer_email, risk_score 0-100, vendor_reasons_json, document_url, status, assignee_id, decision_reason, decided_by, decided_at, version, created_at, updated_at.
- Statuses: pending, in_review, approved, rejected, needs_info. Transitions: pending->in_review (claim); in_review->approved|rejected|needs_info (decide); needs_info->in_review (claim). approved and rejected terminal.
- Supervisor threshold: risk_score >= 70.
- Analyst: claim any unassigned pending or needs_info case; decide only own in_review cases with score < 70; sees own cases plus unassigned.
- Supervisor: claim or decide any case; sees all.
- approve/reject require reason >= 10 chars. needs_info requires note >= 10 chars, clears assignee.
- Actions: claimCase(id, version); claimNext() picks highest risk unassigned pending the actor may decide; decideCase(id, version, decision, reason).
- Audit actions: kyc.case.claim, kyc.case.decide. before/after snapshots and reason on every row.
- Screens: /apps/kyc queue (customer, risk badge red at 70+, status, assignee, created; sorted risk desc; status filter; Claim next). /apps/kyc/[id] detail (customer, reasons, document link, score, status, assignee, history from audit rows, decision form; disabled with the reason when not allowed).
- Seed: 30 cases, scores 5-95, about a third at 70+, mostly pending, a few in_review for the seeded analyst, two approved, one rejected, one needs_info. Reasons from a fixed list of four.
- Acceptance must include: analyst claim-next; analyst approve score 40; analyst approve score 80 -> 403 and no audit row; disabled form message on score 80; supervisor approve score 80; reason 5 chars -> 422; concurrent decideCase same version -> one ok one ConflictError; needs_info flow; decision on approved -> 422; analyst cannot see others' assigned cases; e2e analyst+supervisor+admin audit.

## App 2: Refunds, minimal (src/apps/refunds)

- Tables: customers (id, name, email, created_at); transactions (id, customer_id, amount_cents, currency, refunded_cents, created_at, version); refunds (id, transaction_id, amount_cents, reason, idempotency_key unique, status, requested_by, approved_by, provider_ref, version, created_at, updated_at).
- Statuses: pending_approval, issued, rejected.
- Agent ceiling 50000 cents: at or below issues immediately; above creates pending_approval. Lead issues any amount directly. Lead cannot approve own request.
- Amount 1..remaining. Reason >= 10 chars.
- idempotency_key generated client-side when the dialog opens; repeated key returns the existing refund, provider not called again.
- Issuing calls PaymentsProvider.refund with the same key, stores provider_ref, increments refunded_cents under version.
- Actions: requestRefund, approveRefund(id, version), rejectRefund(id, version, reason).
- Audit actions: refunds.refund.request, .issue, .approve, .reject.
- Screens: /apps/refunds search; /apps/refunds/customers/[id] transactions with Refund dialog; /apps/refunds/approvals (lead).
- Seed: 5 customers, 4 transactions each, 1000-250000 cents USD.
- Acceptance must include: small refund issued; large refund pending; lead approve; requester approve -> 403; duplicate key -> one refund, provider called once; over remaining -> 422; concurrent approve -> one ConflictError; e2e agent+lead+admin audit.

## Not building

Feature flags, real SSO login, Postgres, deployment, email, background jobs, any third app.

## Skills

- new-internal-tool: read AGENTS.md and the given spec; create the app folder set above; tests from acceptance criteria; migration; check green; run test-before-pr; PR titled feat(<id>) with acceptance mapping, ambiguities and decisions, screenshots, README section. Never edit the registry, another app, or audit rows.
- test-before-pr: fresh DB; check and e2e green; audit:verify OK; log in as each role touched and click the main flow; one forbidden action per role; screenshots at 1280 and 375; /admin/audit verify; attach to PR.

## Definition of done (all tasks)

check and e2e green from a fresh migrate+seed; logged in as each role touched with screenshots; audit:verify shown passing and then failing after tampering one row; PR lists acceptance criteria pass/fail and every ambiguity with the decision made.