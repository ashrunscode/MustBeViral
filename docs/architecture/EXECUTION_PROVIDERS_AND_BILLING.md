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

Historical launch-pack quotes and price versions remain immutable. The September 28 provisional
catalog below is the selected implementation input; W11 must validate its economics and commercial
acceptance before live charging. Historical pilot prices are not the default platform offer. Keep
existing customer price mappings and configured charging containment until the accepted billing
packet and release procedure explicitly change them.

Only an explicit wallet top-up funds the prepaid usage wallet (ADR-0007): a paid `payment`-mode Checkout Session marked `metadata.purpose = "wallet_top_up"` that names its workspace, credited once per Checkout Session in USD micros. The setup fee and subscription invoices never credit the wallet, and `invoice.paid` does not settle. A Stripe customer may be shared across workspaces, so every settled Stripe event names its workspace instead of relying on the customer id.

Stripe does not deliver webhook events in order, and a settlement that failed is applied late when Stripe retries it. The billing profile records the Stripe subscription event that last set its subscription status. A first delivery of an older event is audited as stale and leaves that status alone. For the recorded subscription, lifecycle stage decides first (`customer.subscription.created`, then `.updated`, then `.deleted`), so a later event of a subscription whose deletion is recorded cannot reactivate it. Otherwise the event `created` second decides. Stripe records `created` in whole seconds and advises against ordering by it, so two `.updated` events of one subscription, or events of two subscriptions of one workspace, that share a second still apply in arrival order; the second case can bring back a deleted subscription. Only refetching the subscription from the Stripe API would resolve those. A profile holds one subscription, so a workspace with overlapping subscriptions follows whichever event is judged newest. A stale event still latches the setup fee and fills a missing Stripe customer id, because neither depends on order. Until the Worker sending the event type and `created` time is deployed and the transitional seven-argument settlement function is dropped, a write through that function applies unordered and clears the recorded event.

## Spend and safety controls

P0 default caps are $8 per run, $25 per workspace per day, and $100 globally per day. Core enforces caps transactionally before reservation and again before provider submission. Operations has environment, provider, model, workspace, and global kill switches. Catalog canaries precede model changes; drift in price, license, retention, or moderation disables new quotes until reviewed.

The owner's **$100 total external-service development budget** is separate from those daily product
limits. Track cumulative settled and reserved USD micros in the existing governance evidence
receipt `governance/evidence/WP-PLATFORM-W2-002/development-spend-2026-09-28.yaml`. Before a paid call,
record its purpose, provider quote, bounded maximum and remaining ceiling; uncertain costs remain
reserved until reconciled. Never reset this budget at midnight or when a packet changes. Record
actual cost and safe receipt references afterward, without credentials, signed URLs or customer
media. Stop further paid calls at the ceiling and continue zero-additional-spend work. Ad spend is
not authorized from this budget. Applicable packet/provider external-effect gates still apply.

Customer automation uses an explicitly approved immutable budget policy in place of repeated human
confirmation only for work covered by that exact policy. The shared command still pins a current
quote/revision/price snapshot and reserves integer money transactionally; policy authority does not
waive quote expiry, policy limits, rights, subscription health or emergency stops. Record the policy
approval identity rather than creating a fictitious human confirmation.

## Social adapter and credential transport

Keep the network-specific adapter separate from HTTP/credential transport. Every channel adapter
implements this capability-aware interface:

```text
authorize
discoverAccounts
getCapabilities
validateVariant
prepareMedia
submit
getStatus
cancelWhenSupported
readMetrics
verifyNotification
revoke
```

| Platform                | Selected initial transport | Required initial target                                                       |
| ----------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| Google Drive            | Direct Google OAuth        | Selected-folder ingestion and synchronization.                                |
| Facebook                | Hosted Treg                | Page posts, images and supported videos/reels.                                |
| Instagram               | Hosted Treg                | Professional-account images, carousels and reels.                             |
| Google Business Profile | Hosted Treg                | Supported location posts and available metrics.                               |
| YouTube                 | Hosted Treg                | Video/Shorts upload and status.                                               |
| LinkedIn                | Hosted Treg                | Authorized member posts; organization publishing needs its own proven access. |
| TikTok                  | Hosted Treg                | Prepared content with required per-post user consent.                         |
| X                       | Hosted Treg                | Supported posts/media within metered budgets and rate limits.                 |
| Pinterest               | Direct OAuth/API           | Supported pins.                                                               |
| Threads                 | Direct OAuth/API           | Supported text/media posts.                                                   |

Selection is not production acceptance. Before customer activation prove exact provider-account
and brand binding, two-tenant selection/read/invoke/refresh/revoke denial, partial-scope and consent
denial, refresh, revocation, reconnect, outage and uncertainty handling. Server-controlled
connection/tool bindings select the account; customers supply neither arbitrary tool IDs nor
upstream URLs. A host-based default credential lookup must not select a different customer's
account. Backend tokens and service-team membership never reach customers.

Treg's hosted integration guidance permits a SaaS backend integration but describes customer tags
as accounting metadata and does not make connected-account isolation a consequence of pinned
customer tokens. Its advisory caps do not replace Must Be Viral's atomic customer budgets.
Therefore prove isolation and persist provider IDs/unknown outcomes independently of transport
success. [Treg hosted integration guidance](https://treg.to/llms.txt).

If that proof or commercial suitability fails for a platform, keep the path disabled and implement
its direct adapter behind this interface. Pin existing connections to their transport until an
explicit reconnect/migration; never switch transports during a publication attempt. Treg billing
idempotency alone does not prove that a social post was published once. Postiz/Sendible are excluded
launch dependencies; source embedding/self-hosting is not selected.

Canva import uses official OAuth and design-export APIs; copy completed exports into private R2
and preserve rights/provenance. Temporary export URLs never become canonical assets.
[Canva REST APIs](https://www.canva.dev/docs/apps/rest-apis/).

## Publication and commercial boundaries

Content approval and publishing are separate state machines. An approved content revision can have several independently progressing channel deliveries.

`draft → needs_review → approved → scheduled → submitting → processing → published`

Additional explicit states: `changes_requested`, `canceled`, `permission_required`, `manual_completion_required`, `failed_retryable`, `failed_terminal`, and `outcome_unknown`.

Before dispatch, recheck approval hash, rights/offer expiry, channel identity, current permissions, destination validity, schedule, and kill switches. An API acceptance response is not a published post. Record provider IDs and confirm terminal status through supported reads/webhooks. Unknown outcomes enter reconciliation before any resubmission.

Use transactional intent/outbox records, stable idempotency keys, deduplication, per-account locks, retry backoff, bounded attempts, and operator repair paths. Promise controlled duplicate prevention and reconciliation, not mathematically guaranteed exactly-once effects across third-party systems.

Changing media, caption, destination, account, or material offer terms invalidates the relevant approval. Define whether a timing-only change requires reapproval per workspace policy. Store both local scheduling intent and resolved UTC time; daylight-saving ambiguities must be shown and resolved.

Each delivery pins content revision, approval/policy hash, media hashes, destination, exact account
and schedule. Must Be Viral owns the timer. Acquire a per-account dispatch lease, persist attempt
identity before calling the provider, then recheck permissions, rights, offer validity, subscription,
budget, account health and workspace/brand/account stop controls immediately before submission.
Unknown outcomes block resubmission until reconciliation proves failure or identifies the existing
post. Honor `Retry-After`; retry confirmed transient failures with bounded backoff and visible
exceptions after repeated failure. Successful channels are not resubmitted because another failed.
Cancellation after submission remains requested until confirmed; never automatically delete public
posts. Reconnect to a different account invalidates affected approvals instead of silently rebinding.

TikTok requires the applicable per-post account identity, preview, privacy choice, disclosures and
controls. General automation approval does not replace platform consent. Preserve a manual-completion
state where the permitted integration requires it, with the customer action clearly shown.
[TikTok content-sharing requirements](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

## Platform commercial model

### Commercial model

The owner approved these provisional implementation inputs on September 28. Store them as a
versioned catalog with stable internal IDs, effective dates, integer prices and entitlements; do
not scatter constants across UI and server code. Monthly subscription fees are separate from
dollar-denominated prepaid production credits. No included production allowance, automatic top-up
or surprise overage is enabled by default.

| Plan      | Monthly subscription | Active brands | Operator seats | Connected accounts | Storage |
| --------- | -------------------- | ------------- | -------------- | ------------------ | ------- |
| Solo      | $49                  | 1             | 2              | 9                  | 10 GB   |
| Studio    | $149                 | 5             | 5              | 45                 | 50 GB   |
| Portfolio | $399                 | 20            | 15             | 180                | 200 GB  |

Brand-scoped client reviewers consume no operator seat. Storage is measured consistently in
decimal GB (1,000,000,000 bytes) and the UI shows the quota basis. Preserve existing customer price
and subscription mappings. New subscriptions do not inherit historical pilot setup fees. Live
activation requires measured production/operating costs against this catalog, commercial acceptance
and the existing release gates; provisional prices do not authorize silently changing any customer.

Checkout and each verified webhook bind to one exact workspace. Only a paid top-up credits the
wallet, once under the existing Checkout Session settlement identity; subscriptions never fund
production. Duplicate/reordered events cannot duplicate funds or resurrect an obsolete subscription.
The currently documented same-second/overlapping-subscription limitation above is a required W11.1
repair: reconcile ambiguous updates against Stripe's current authoritative state, preserve event
deduplication and reject changed workspace metadata or ambiguous customer mapping.

Upgrade/downgrade screens show effective dates and any charge before confirmation. Downgrades
retain brands/media/history and require the customer to select active resources rather than
deleting them. Failed payment stops new paid production and automatic dispatch while retaining
history/export access; accepted external work continues reconciliation and correct settlement.
Studio sponsorship pins the funding workspace and client allocation, with both limits and current
permissions checked atomically under concurrency. Keep platform, workspace, client, program and
per-job boundaries explicit instead of treating a portfolio total as a spendable balance.

Show a clear quote or approved budget policy before paid creation. Allow owner-set recurring budgets and delegated spend limits with receipts and stop controls, so the mature product does not require approving every inexpensive background step individually. Keep provider usage, subscription fees, advertising spend, and creator fees separate.

Support real invoices/receipts, cancellations, credits/refunds, failed payments, entitlements, low-balance recovery, and client-level usage allocation. Display operational charging status truthfully. No live money movement is part of writing this plan.

The selected initial creator model records externally settled payments, agreements, deliverables
and actual versus estimated costs. W11.5 records this applicability decision; it does not create a
creator wallet or money-transfer service or claim an untested payout rail. Paid-media submission in
W11.4 remains separately gated by exact ad-account/budget authority, outside the development budget.
