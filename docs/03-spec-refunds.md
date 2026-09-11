# Spec 03 — Refunds dashboard, minimal (`src/apps/refunds`)

Support agents look up a customer's transactions and give refunds. An agent can issue small refunds directly; larger ones need a lead's approval. Every refund hits the payment processor and is idempotent and fully logged.

Users: support agents and support leads. There is no `finance` role; `admin` reads the log.

## 1. Data model

Table `customers`: `id`, `name`, `email`, `created_at`.

Table `transactions`: `id`, `customer_id`, `amount_cents`, `currency`, `refunded_cents`, `created_at`, `version`.

Table `refunds`: `id`, `transaction_id`, `amount_cents`, `reason`, `idempotency_key` (unique), `status`, `requested_by`, `approved_by`, `provider_ref`, `version`, `created_at`, `updated_at`.

## 2. Status state machine

Statuses: `pending_approval`, `issued`, `rejected`.

Transitions:

- create -> `issued` (agent at/below ceiling, or any lead request)
- create -> `pending_approval` (agent above ceiling)
- `pending_approval` -> `issued` on approve
- `pending_approval` -> `rejected` on reject

All other transitions are invalid -> `ValidationError` (422).

## 3. Permissions and limits

- Agent ceiling: 50000 cents. At or below issues immediately; above creates `pending_approval`.
- `lead` issues any amount directly and approves/rejects `pending_approval` refunds — but cannot approve their own request.
- `admin` passes every policy (platform rule).
- The approvals screen is lead-only; a non-lead gets 403.

## 4. Validation

- Refund amount must be within `1..remaining`, where `remaining = amount_cents - refunded_cents` on the transaction.
- `reason` >= 10 chars. Same minimum for the `rejectRefund` reason.

## 5. Idempotency

- `idempotency_key` is generated client-side when the refund dialog opens: UUID v4 from `crypto.randomUUID()`. The server rejects non-UUID keys (422).
- A repeated key returns the existing refund row; the provider is not called again.
- Issuing calls `PaymentsProvider.refund` with the same key, stores `provider_ref`, and increments `transactions.refunded_cents`. On approve, the transaction is read inside `withMutation` and updated `WHERE version = <read value>`; zero rows -> `ConflictError` (409). The form carries only the refund's `version`.

## 6. Actions

All writes follow the platform mutation rule (server action, `authorize`, validate, `withMutation`, version check).

- `requestRefund` — creates the refund row; issues immediately when allowed, else `pending_approval`.
- `approveRefund(id, version)` — `pending_approval` -> `issued`; calls the provider, stores `provider_ref`, increments `refunded_cents`.
- `rejectRefund(id, version, reason)` — `pending_approval` -> `rejected`.

## 7. Audit

Audit actions: `refunds.refund.request`, `refunds.refund.issue`, `refunds.refund.approve`, `refunds.refund.reject`. Every row carries before/after snapshots and the reason.

No ledger table or adapter exists; `transactions.refunded_cents` is the record of refunded amounts.

## 8. Screens

- `/apps/refunds` — customer search.
- `/apps/refunds/customers/[id]` — the customer's transactions with a Refund dialog (generates `idempotency_key` on open).
- `/apps/refunds/approvals` — `pending_approval` queue (lead).

## 9. Seed

5 customers, 4 transactions each, amounts 1000–250000 cents USD.

## 10. Acceptance criteria

1. Given a transaction with `amount_cents` 100000 and `refunded_cents` 0, when an agent requests a refund of 50000 cents with a valid reason, then the refund is `issued` immediately: the provider was called with the same `idempotency_key`, `provider_ref` is stored, `refunded_cents` is 50000, and `refunds.refund.request` + `refunds.refund.issue` audit rows exist.
2. Given the same transaction, when an agent requests a refund of 50001 cents, then the refund is created as `pending_approval` and the provider is not called.
3. Given a `pending_approval` refund requested by someone else, when a lead calls `approveRefund(id, version)` (the form carries only the refund's `version`), then inside `withMutation` the transaction is read and updated `WHERE version = <read value>` — zero rows -> `ConflictError` (409) — and the refund is `issued` via the provider, `approved_by` is set, `provider_ref` is stored, `refunded_cents` is incremented, and a `refunds.refund.approve` audit row exists.
4. Given a `pending_approval` refund, when the actor listed in `requested_by` calls `approveRefund`, then `ForbiddenError` (403) is thrown — a lead cannot approve their own request.
5. Given a refund created with `idempotency_key` K, when the same request is submitted again with K, then the existing refund is returned, exactly one refund row exists, and the provider was called once.
6. Given a transaction with `remaining` 30000 cents, when a refund of 30001 cents (or 0, or negative) is requested, then `ValidationError` (422) is thrown.
7. Given any refund request, when `reason` is under 10 chars, then `ValidationError` (422) is thrown.
8. Given a `pending_approval` refund, when a lead calls `rejectRefund(id, version, reason)`, then status is `rejected`, a `refunds.refund.reject` audit row exists, and the provider is not called.
9. Given a `pending_approval` refund at version N, when two leads call `approveRefund` concurrently with version N, then exactly one succeeds and the other gets `ConflictError` (409).
10. Given a lead, when they request 200000 cents within remaining, then it issues immediately.
11. Given an `issued` or `rejected` refund, when `approveRefund` or `rejectRefund` is called, then `ValidationError` (422) is thrown.
12. Given an agent on `/apps/refunds`, when I search a customer and open `/apps/refunds/customers/[id]`, then their transactions render; when I open the Refund dialog, then an `idempotency_key` is generated at that moment.
13. Given a lead on `/apps/refunds/approvals`, when the page loads, then all `pending_approval` refunds are listed.
14. E2E: given a fresh migrate + seed, when an agent requests a refund above the ceiling, a lead approves it, and an admin opens `/admin/audit` and clicks "Verify chain", then each step succeeds and the chain shows `OK`.
