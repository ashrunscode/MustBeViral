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
- External mutations are explicitly permitted by packet and environment policy; otherwise they are absent.

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

Database RLS/RPC suites live under `supabase/tests/database` (pgTAP). CI runs them in the
`database-pgtap` job of `.github/workflows/quality.yml` (`pnpm supabase:start` →
`pnpm supabase:test`) on the ashrunscode GitHub account. Local operators need Docker Desktop
running before `pnpm supabase:test`.

## D0 exit gates

- Three SuperDesign branches rendered from the accepted design system; one direction explicitly approved by the user.
- Campaign brief, canvas, quote/run, outputs, receipt, and responsive review flows have approved goldens.
- Five to eight qualified users and 20 representative briefs are recruited/defined.
- Enabled model catalog has current price, license, retention, moderation, and capability evidence.
- Data API/RPC baseline and Hyperdrive candidate benchmark include cold/warm p50/p95/p99, concurrency, conflicts, errors, and pooled-identity tests.

## P0 validation gates

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

Failure of usable output, economics, or paid-demand **evidence** blocks claiming P0 validation success and blocks customer charging. It does not stall remaining accepted product implementation (onboarding through P1a/P1b/P2). Partner recruiting is never the next engineering action.

## Initial paid-release definition of done

A fresh agent can clone, run one preflight command, identify the exact phase/packet/next action/allowed paths/checks within 60 seconds, and safely continue. A DTC user can complete the full launch-pack flow with a versioned graph, explicit quote, private parallel execution, partial/final review, affected-descendant rerun, approval/export, and immutable provider/model/cost/lineage receipt without cross-tenant access, public media, duplicate work, or duplicate money movement.
