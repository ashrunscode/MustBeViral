---
doc_id: quality-gates
---

# Quality gates

## Universal merge gates

- Authority/packet schemas valid; documents registered; links valid; generated outputs current; no secret or legacy fingerprint leakage.
- Preserve transition-receipt history with merge commits or another non-rewriting merge. GitHub squash merging and rebase merging are disabled because they replace the recorded predecessor commit IDs and make receipt evidence unverifiable.
- Formatting, linting, strict types, unit/integration tests, security checks, and affected builds pass from a clean checkout with frozen dependencies.
- Changed behavior has contract and failure-path tests; changed authority has traceability updates.
- Implementation diff stays inside the active packet and introduces no unresolved decision.
- External mutations are explicitly permitted by packet and environment policy; otherwise they are absent. A packet's `remote_mutation: authorized` covers only the guarded release in `deploy-rollback-incidents` under `adr-0009-standing-release-authority`, unless the packet names other exact remote mutations.

## Merge gates under standing release authority

Agents merge without asking again (`adr-0009-standing-release-authority`) once these gates pass for the exact pull request head:

- Required checks run in a fresh single-worktree clone of that head, with frozen dependencies. Check the head out as a local branch named after the pull request's target branch, so `packet:verify` runs its branch and single-worktree gates as it will after merge. Linked worktrees on the workstation otherwise fail those gates.
  - Governance or documentation changes need `pnpm agent:preflight`, `pnpm governance:check`, `pnpm governance:test` and `pnpm format:check`.
  - Product changes also need `pnpm verify` and `pnpm supabase:test`.
  - Any validation error blocks the merge. If a tool crashes instead of reporting a result, rerun that validator alone at the same commit and record both runs. If the rerun also produces no result, the merge is blocked until one does.
  - The pull request records the commit, commands and exit codes.
  - GitHub Actions is disabled; the owner retained that restriction on 2026-09-28. Neither `main` nor `codex/viralgraph-cleanroom` is protected or covered by a ruleset in the current readback. The exact proposed protections and pending authorization are recorded in `governance/evidence/WP-PLATFORM-W2-002/github-branch-protection-2026-09-28.md`. Do not describe proposed settings as applied. The recorded local runs remain the required checks; do not describe them as CI.
- Before merge, a reviewer independent of the author (a different agent session or a person) reviews the exact head of any change that touches authentication, billing or payments, consent, CRM, migrations or RLS, customer data, deployment configuration or governance authority, or more than 20 files. Other changes merge on the required checks alone. A new head needs a new review of what changed, and blocking findings are fixed before merging.
- Merge with a merge commit into the target branch; never use an administrator bypass. Merging never deploys by itself.
- Passing these gates does not approve any action `adr-0009-standing-release-authority` leaves owner-gated.

## Required coverage

| Layer          | Required scenarios                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance     | duplicate authority, unregistered/stale docs, multiple packets, forbidden paths/names, generated drift, secret canary, clean-checkout continuation, blocked handoff |
| Graph/domain   | schema validation, canonical hash, topological plan, cycle/type rejection, affected descendants, patch conflict, immutable restore                                  |
| Database/auth  | migration sequence, RLS cross-tenant denial, role limits, barrier rollback/idempotency, pooled identity reset, immutable ledger balance                             |
| Provider/media | signature verification, deduplication, ambiguous submit, retry/cancel ownership, R2 copy, private access, signed expiry, price/catalog drift                        |
| UI             | component states, keyboard and screen-reader parity, visual goldens, responsive behavior, zoom/contrast/reduced motion, canvas FPS, Core Web Vitals                 |
| Platform       | Vercel staging smoke, Worker binding/types, Supabase migration/RLS tests, deployment rollback, MCP Inspector and two-client parity                                  |

Tests favor behavior and invariants over raw coverage percentages. Unit tests cover pure domain/graph/billing logic; integration tests cover database, HTTP, provider, and storage boundaries; end-to-end tests cover the golden launch-pack flow and critical recovery paths.

Database RLS/RPC suites live under `supabase/tests/database` (pgTAP). The disabled workflow defines
them in the `database-pgtap` job of `.github/workflows/quality.yml` (`pnpm supabase:start` →
`pnpm supabase:test`); it does not currently execute. Required local runs need Docker Desktop
running before `pnpm supabase:test`.

## D0 exit gates

- Three design branches rendered from the accepted design system; one direction explicitly approved by the user.
- Campaign brief, canvas, quote/run, outputs, receipt, and responsive review flows have approved goldens.
- Five to eight qualified users and 20 representative briefs are recruited/defined.
- Enabled model catalog has current price, license, retention, moderation, and capability evidence.
- Data API/RPC baseline and Hyperdrive candidate benchmark include cold/warm p50/p95/p99, concurrency, conflicts, errors, and pooled-identity tests.

## Historical P0 validation gates

### Engineering gates (must be proven in repository; they do not wait on partners)

- At least 16 of 20 representative runs technically complete.
- Median first reviewable static pack ≤10 minutes; p90 ≤15 minutes.
- No hidden mock, silent fallback, duplicate provider submission/charge, unexplained ledger difference, public artifact, or missing lineage receipt.
- Default caps of $8/run, $25/workspace/day, and $100/global/day are transactionally enforced.
- Canvas maintains ≥55 FPS at 100 visible nodes; 500-node stress remains navigable.
- Private MCP proof passes Inspector and two real clients with REST-semantic parity.
- Web Vitals instrumentation exists; p75 LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1 are measured on the agreed production segment only after an authorized P1a production deploy.
- Landed-cost instrumentation computes integer USD micros from immutable receipts. The ≤$5 usable-pack comparison still needs the human usable denominator below.

### Human-only appendix (required to claim P0 product-validation success; not the engineering next action)

- At least 80% of qualified users complete brief → quote → run → review without assistance.
- At least 70% of jobs produce one or more usable concepts under the registered rubric.
- At least 3 of 5 qualified evaluators prefer the workflow to their current process.
- At least one qualified DTC customer or design partner has sanitized durable evidence that it will
  use staging and either intends to pay or has agreed commercial terms. Actual payment and Stripe
  are not required in P0.
- Landed cost ≤$5 for every launch pack counted as usable by those evaluators.
- Operator explicit go/no-go after reading the dossier. Silence is not approval.

Failure of the historical usable-output, economics or paid-demand evidence blocks claims of historical P0 validation success. Full-platform charging requires the current W11 commercial acceptance and release authorization. Missing historical DTC evidence does not stall the accepted platform implementation.

## Historical launch-pack definition of done

A fresh agent can clone, run one preflight command, identify the exact phase/packet/next action/allowed paths/checks within 60 seconds, and safely continue. A DTC user can complete the full launch-pack flow with a versioned graph, explicit quote, private parallel execution, partial/final review, affected-descendant rerun, approval/export, and immutable provider/model/cost/lineage receipt without cross-tenant access, public media, duplicate work, or duplicate money movement.

## Full-platform acceptance

The following supersedes the historical launch-pack scope as the full-platform release definition. Historical results retain their original meaning and are not reclassified.

### Golden journey A: WashBodega

1. Add the approved website and create a durable brand draft.
2. Extract and review business facts, services, locations, voice, and identity candidates with sources.
3. Confirm the real logo, correct palette/fonts, storefront/interior assets, current offers, rights, and service-specific destinations.
4. Connect authorized social profiles and verify their mapping to WashBodega.
5. Create a seven-day campaign plan using approved facts and actual media.
6. Produce an original-media reel, an educational carousel, and a branded static post; include a reviewed EN/ES variation where appropriate.
7. Verify the building/product identity, exact graphic assets, offer conditions, readable text, language, and destination.
8. Review, request a change, compare revisions, and approve the exact final variants.
9. Schedule a supported post and exercise a controlled reconnect or failure scenario.
10. Confirm actual publication through an external post ID/status. Record unsupported/manual steps honestly.
11. Read real available metrics; preserve unavailable fields; connect a measurable business action where authorized.
12. Produce a next-week recommendation linked to the evidence.

Test content and any actual publication require the relevant execution authorization when this journey is run. This document has not posted or changed accounts.

### Golden journey B: independent second brand (UnPile pilot)

Repeat the journey with UnPile, explicitly selected by the owner on September 9, in its own workspace with distinct identity, voice, service context and assets. Switch frequently between brands. Reuse the same operator but test a separate client reviewer. WashBodega and UnPile are both laundry businesses; this pilot does not establish unrelated-industry coverage. The broader local-service and e-commerce brief rubric below still requires separate varied-category cases.

Required evidence: no WashBodega logo, location, prices, prompts, source assets, private messages, or audience assumptions appear in the other brand's work. Search, cached results, embeddings, bulk actions, notifications, exports, and background jobs all respect the same boundary.

### Golden journey C: studio and client

An operator creates a campaign, assigns creation, requests client review, receives changes, approves a final revision, and schedules it. The client can see only its own permitted work. Changing the approved media invalidates approval. Revoking the reviewer removes access. Offboarding preserves client ownership and reconciles future schedules.

### Golden journey D: creator

Find/import a creator, explain fit with sourced evidence, shortlist, prepare authorized outreach, record agreement/rights, assign a deliverable, receive media, review revisions, approve, verify publication, and record actual available performance and cost. Private audience information is never fabricated to complete the card.

### Golden journey E: partnership

Two brands share selected assets for one campaign, approve a co-branded deliverable, coordinate supported publishing, and receive only agreed reporting. Expiry or withdrawal blocks future reuse without pretending previously public posts can be recalled automatically.

### Mandatory negative and recovery cases

| Area           | Cases                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingestion      | Wrong domain, inaccessible website, malicious page text, unsafe redirect, duplicate pages, conflicting sources, missing image rights.                                               |
| Knowledge      | Stale offer, unsupported claim, incorrect service price, location mismatch, disputed fact, missing evidence.                                                                        |
| Asset fidelity | Wrong logo variant, substituted storefront, distorted product, generated incorrect text, wrong crop, unreadable captions, expired license.                                          |
| Tenancy        | Cross-workspace IDs, brand-scope violation, unauthorized search/export, cached data leak, background job after revocation.                                                          |
| Identity       | Fresh signup/sign-in as applicable, verification, recovery, expired session, return to intended resource, logout.                                                                   |
| Approval       | Stale version, changed destination/account, reviewer revocation, simultaneous decisions, insufficient participant approval.                                                         |
| Publishing     | Duplicate request, webhook replay, timeout after submission, partial channel success, expired token, provider rejection, manual path, cancellation race, daylight-saving ambiguity. |
| Measurement    | True zero versus unavailable, delayed metrics, changed definition, duplicate conversion, incompatible totals, missing attribution.                                                  |
| Money          | Concurrent reservations, over-budget job, failed payment, duplicate webhook, cancellation/refund, provider usage reconciliation.                                                    |
| Operations     | Queue backlog, provider outage, dead-letter repair, render crash, restore, adapter migration, kill switch.                                                                          |
| UX             | No brand/assets/accounts, deep links, reload, browser back, unsaved edits, mobile approval, keyboard, zoom, screen reader, loading/error states.                                    |

### Quality targets

Proposed acceptance targets should be ratified in W0 and measured; these are not current performance claims:

- All factual promotional claims in release fixtures resolve to approved evidence and applicable dates.
- All required logos/graphic identity elements use approved source assets and permitted transforms.
- No cross-tenant/unauthorized brand access succeeds in the defined adversarial test suite.
- Every scheduled publication points to an approved immutable payload and exact account.
- No blind resubmission occurs after an ambiguous external outcome in failure-injection tests.
- No supported release-critical screen depends on browser storage as its sole durable record.
- Common portfolio/brand reads meet the agreed workload-specific performance target.
- At least 80% of a defined pilot cohort can complete onboarding through approval without assistance; failed sessions become product fixes, not exclusions from the result.
- Brand owners evaluate usefulness and fidelity across at least 20 varied briefs, including local service and e-commerce cases. Agree a rubric before reviewing outputs and do not invent the denominator after the fact.
- Proposed output rubric: factual correctness, recognizable identity, audience relevance, natural appearance, editing burden, and willingness to publish. A beautiful generic render fails brand fidelity.

### Evidence ledger for every feature

Use the existing governance evidence mechanism to record:

**Specified → implemented → locally verified → connected staging verified → authorized production verified.**

Record unsupported, blocked, or not configured explicitly. These states are evidence classifications, not user-facing marketing badges. Mark a full feature complete only at the evidence level required by its release contract.

Final release requires an executable user journey, working data and recovery paths, relevant behavioral tests, connected evidence, accessible responsive UX, truthful copy, support/rollback procedures, and owner acceptance. Keep local test success separate from provider activation, deployment, public traffic, and actual live behavior.

## Carried release obligations

WP-P3-009 observation-window and fresh-traffic-decision are pending in its immutable supersession snapshot. Re-establish appropriate continuous observation for the eventual release deployment and record the owner ruling before traffic activation. Local platform work does not require those release checks to pass first. Existing production containment, actual required GitHub reviews, migration/RLS verification and exact-resource rollout/rollback gates remain in force. Standing release authority (`adr-0009-standing-release-authority`) does not satisfy these obligations; the traffic ruling still needs its own owner sentence.
