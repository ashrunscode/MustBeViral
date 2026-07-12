---
doc_id: execution-providers-billing
---

# Execution, providers, artifacts, and billing

## P0 execution model

P0 uses the Core Worker, a transactional Postgres outbox, immediate post-commit dispatch, and a scheduled reconciler. It does not use durable workflow, queue, or coordination products.

- Normal outbox-to-dispatch p95 target: ≤1 second.
- Abandoned event recovery target: ≤2 minutes.
- Workers claim outbox/attempt rows through short leases; an expired lease is recoverable.
- Unique event, attempt, provider request, webhook, artifact, and ledger keys make duplicate delivery safe.
- External calls never occur inside a database transaction.

Durable workflows enter P1a only for proven multi-step waits/retries. Queues require measured backpressure or fan-out. A separate executor requires independently scaling load, CPU limits, or deploy isolation. Coordination objects wait until P2 collaboration.

## State machines and ownership

| Entity       | Legal progression                                        | Terminal/exception behavior                                                                                                                                                         |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run          | `queued → dispatching → running → succeeded`             | `running → partial_succeeded`; active states may enter `cancel_requested`, `failed`, or `reconciliation_required`; `partial_succeeded` may end `succeeded`, `failed`, or `canceled` |
| Run node     | `pending → ready → queued → running → succeeded`         | may end `failed`, `canceled`, or `skipped`; ambiguous external state becomes `reconciliation_required`                                                                              |
| Attempt      | `created → submitting → submitted → running → succeeded` | may become `failed`, `cancel_requested`, `canceled`, or `ambiguous`; a new attempt requires policy approval and a new attempt number                                                |
| Provider job | `submitted → running → succeeded`                        | may become `failed`, `cancel_requested`, `canceled`, or `unknown`; provider events cannot move a terminal state backward                                                            |
| Artifact     | `pending → verifying → available`                        | failed verification becomes `quarantined`; policy deletion becomes `deleted` while evidence is retained as allowed                                                                  |
| Reservation  | `active → captured`                                      | may become `partially_captured`, `released`, or `refunded`; captured value never exceeds quote maximum                                                                              |
| Outbox event | `pending → leased → published`                           | lease expiry returns to `pending`; repeated policy failure becomes `dead` and alerts operations                                                                                     |

The execution engine alone derives run/run-node state. An attempt runner owns submission and polling. Verified webhooks append normalized provider evidence. The reconciler resolves missed webhooks, expired leases, and provider uncertainty. Billing policy alone writes ledger transactions. Manual operator actions use explicit audited commands, never direct row edits.

Blind retry is forbidden after an ambiguous submit when a provider lacks a safe idempotency guarantee. The attempt enters reconciliation and blocks its branch until status is proven or an authorized operator records a resolution.

## Provider interfaces

```text
ProviderTransport
  authenticate
  submit
  status
  cancel
  verifyWebhook

ModelDriver
  capabilities
  validateInputs
  encodeRequest
  normalizeOutput
  quote
  idempotencyPolicy
```

`FalTransport` is the first implementation. A common transport is not a common model schema: every enabled model has a driver and versioned catalog entry covering provider model ID, capability, input/output schema, limits, moderation, license, retention, price source, health, and idempotency behavior.

Enable only 3–5 models required for the launch pack. Direct adapters are added model-by-model when measured volume, margin, control, or SLA justifies them without changing the command layer.

## Run reproducibility

Each run pins the graph revision/hash, graph/node/parameter schema versions, transport/driver versions, model route/provider model ID, normalized input and artifact hashes, safety policy, quote and price snapshot, quote expiry, provider request IDs, and full artifact lineage. Credentials and raw secret-bearing headers are never persisted.

## Artifact pipeline

1. Inputs use exact-key, short-lived signed uploads after auth, size/MIME/purpose checks, and workspace quota validation.
2. Post-upload verification calculates a content hash, confirms media shape, scans according to policy, and records provenance/rights attestation.
3. Provider outputs are fetched server-side from allowlisted HTTPS origins, bounded by size/time, verified, and copied immediately to private R2.
4. An artifact becomes available only after the R2 object and durable metadata agree.
5. Customer downloads and exports use short-lived signed URLs; bucket listing and public access are disabled.
6. Export bundles contain deterministic filenames, content hashes, copy, QA, lineage, and receipt manifests.

## Quote and ledger contract

All money is integer USD micros. A quote is immutable, tied to workspace/revision/model/price versions, and expires after 15 minutes. The displayed total is the maximum customer charge for that run; a revision or price change requires a new quote and confirmation.

Ledger transaction types are `credit`, `reserve`, `capture`, `release`, and `refund`. They are append-only, balanced, uniquely keyed to the causative command/provider evidence, and reconciled against reservations and Stripe settlement.

- Confirmation creates a reservation; no negative wallet is allowed.
- Cancellation before provider acceptance releases the reservation.
- After provider acceptance, capture only verified provider cost plus the applicable pinned markup, never more than the quote.
- Provider refusal creates no customer charge.
- Partial success captures completed/accepted branch cost and releases the remainder.
- Duplicate command, webhook, poll, or operator replay returns the existing ledger result.

P0 exercises the complete semantic ledger without automated customer charging. P1a pilot pricing is $500 setup, $149/month, and a prepaid usage wallet. Usage begins at landed provider cost plus 25% with model-specific minimums; pricing is reconsidered only after 30 paid runs, targeting at least 60% blended gross margin without rewriting historical receipts.

## Spend and safety controls

P0 default caps are $8 per run, $25 per workspace per day, and $100 globally per day. Core enforces caps transactionally before reservation and again before provider submission. Operations has environment, provider, model, workspace, and global kill switches. Catalog canaries precede model changes; drift in price, license, retention, or moderation disables new quotes until reviewed.
