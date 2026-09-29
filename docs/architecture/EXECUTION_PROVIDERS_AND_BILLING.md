---
doc_id: execution-providers-billing
---

# Execution, providers, artifacts, and billing

## Execution foundation

The platform reuses the Core Worker, transactional Postgres outbox, immediate post-commit dispatch and scheduled reconciliation, plus the existing evidence-gated queue and collaboration mechanisms. Environment gates remain separate from local implementation.

- Normal outbox-to-dispatch p95 target: ≤1 second.
- Abandoned event recovery target: ≤2 minutes.
- Workers claim outbox/attempt rows through short leases; an expired lease is recoverable.
- Unique event, attempt, provider request, webhook, artifact, and ledger keys make duplicate delivery safe.
- External calls never occur inside a database transaction.

W2.1 website/document capture uses `brand_source_jobs` with a 20-second lease, not `provider_jobs` or a new queue. Core fetches on a public-only egress capability after the user command commits, then the service_role `record_brand_source_capture` RPC persists evidence. Local development does not fall back to unrestricted `fetch` when that capability is missing.

New durable workflows require proven multi-step waits/retries. New queue topology requires measured backpressure or fan-out. A separate executor requires a recorded architecture decision, workload benchmark, security boundary, costs and rollback. Existing coordination objects remain recoverable drafts, not durable authority.

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

Preserve the existing curated media catalog. Add model routes only when the real-asset/rendering feasibility gate proves needed capability, input fidelity, rights, retention and cost. Direct media adapters require measured justification. Publishing adapters have a distinct integration contract.

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
- A verified Stripe webhook settles before Core records its `stripe_webhook_events` receipt. A settlement failure records no receipt and returns 5xx, so Stripe retries. A wallet top-up credit is idempotent on the Checkout Session across workspaces, and a subscription update is idempotent on the Stripe event id. A replay that names or resolves a different workspace fails with `STRIPE_EVENT_WORKSPACE_MISMATCH` and applies nothing. That failure, a subscription event whose Stripe customer maps to several workspaces (`STRIPE_CUSTOMER_AMBIGUOUS`), and an event whose workspace cannot be resolved (`WORKSPACE_NOT_FOUND`) return 5xx on every Stripe retry until an operator resolves them. A paid top-up that cannot be credited exactly also returns 5xx, but its payload never changes, so it fails every retry; `deploy-rollback-incidents` describes the operator repair.

Historical launch-pack quotes and price versions remain immutable. The full-platform commercial offer is selected in W11 from measured unit costs and customer evidence; historical pilot prices are not the default platform offer. Until an accepted billing packet implements and validates a new offer, retain existing configured charging containment.

Only an explicit wallet top-up funds the prepaid usage wallet (ADR-0007): a paid `payment`-mode Checkout Session marked `metadata.purpose = "wallet_top_up"` that names its workspace, credited once per Checkout Session in USD micros. The setup fee and subscription invoices never credit the wallet, and `invoice.paid` does not settle. A Stripe customer may be shared across workspaces, so every settled Stripe event names its workspace instead of relying on the customer id.

Stripe does not deliver webhook events in order, and a settlement that failed is applied late when Stripe retries it. The billing profile records the Stripe subscription event that last set its subscription status. A first delivery of an older event is audited as stale and leaves that status alone. For the recorded subscription, lifecycle stage decides first (`customer.subscription.created`, then `.updated`, then `.deleted`), so a later event of a subscription whose deletion is recorded cannot reactivate it. Otherwise the event `created` second decides. Stripe records `created` in whole seconds and advises against ordering by it, so two `.updated` events of one subscription, or events of two subscriptions of one workspace, that share a second still apply in arrival order; the second case can bring back a deleted subscription. Only refetching the subscription from the Stripe API would resolve those. A profile holds one subscription, so a workspace with overlapping subscriptions follows whichever event is judged newest. A stale event still latches the setup fee and fills a missing Stripe customer id, because neither depends on order. Until the Worker sending the event type and `created` time is deployed and the transitional seven-argument settlement function is dropped, a write through that function applies unordered and clears the recorded event.

## Spend and safety controls

P0 default caps are $8 per run, $25 per workspace per day, and $100 globally per day. Core enforces caps transactionally before reservation and again before provider submission. Operations has environment, provider, model, workspace, and global kill switches. Catalog canaries precede model changes; drift in price, license, retention, or moderation disables new quotes until reviewed.

## Publication and commercial boundaries

Content approval and publishing are separate state machines. An approved content revision can have several independently progressing channel deliveries.

`draft → needs_review → approved → scheduled → submitting → processing → published`

Additional explicit states: `changes_requested`, `canceled`, `permission_required`, `manual_completion_required`, `failed_retryable`, `failed_terminal`, and `outcome_unknown`.

Before dispatch, recheck approval hash, rights/offer expiry, channel identity, current permissions, destination validity, schedule, and kill switches. An API acceptance response is not a published post. Record provider IDs and confirm terminal status through supported reads/webhooks. Unknown outcomes enter reconciliation before any resubmission.

Use transactional intent/outbox records, stable idempotency keys, deduplication, per-account locks, retry backoff, bounded attempts, and operator repair paths. Promise controlled duplicate prevention and reconciliation, not mathematically guaranteed exactly-once effects across third-party systems.

Changing media, caption, destination, account, or material offer terms invalidates the relevant approval. Define whether a timing-only change requires reapproval per workspace policy. Store both local scheduling intent and resolved UTC time; daylight-saving ambiguities must be shown and resolved.

## Platform commercial model

### Commercial model

Provide plans appropriate to one brand, a studio portfolio, and larger organizations. Entitlements may cover active brands, channels, seats, storage, reporting history, and automation. Meter costly generation/discovery/rendering transparently. Choose actual prices after measured unit costs and customer evaluation; do not inherit old pilot pricing as the new platform's business model.

Show a clear quote or approved budget policy before paid creation. Allow owner-set recurring budgets and delegated spend limits with receipts and stop controls, so the mature product does not require approving every inexpensive background step individually. Keep provider usage, subscription fees, advertising spend, and creator fees separate.

Support real invoices/receipts, cancellations, credits/refunds, failed payments, entitlements, low-balance recovery, and client-level usage allocation. Display operational charging status truthfully. No live money movement is part of writing this plan.
