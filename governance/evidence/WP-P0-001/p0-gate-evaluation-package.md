# The P0 exit is decision-ready but not yet eligible for a go decision

Work packet: WP-P0-001, step p0-007-p0-gate-evaluation
Recorded 2026-08-11

## Current status — 2026-08-20

This current-status block supersedes the opening roll-up and Gate 1 verdict below without erasing
their historical sequence. Amendment 18 and the machine summary prove 16 of 20 registered runs
complete, with 101.631-second median and 122.314-second p90 first-reviewable latency. The
representative completion and latency gate is proven, and `p0-005-golden-launch-pack-runs` is
complete. The packet is now on `p0-007-p0-gate-evaluation`.

Current roll-up:

| Packet gate                                    | Verdict             | Decisive fact                                                                 |
| ---------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| Representative completion and latency          | proven              | 16/20 complete; median 101.631 seconds and p90 122.314 seconds pass           |
| Transactional spend, deduplication, and ledger | proven              | Caps, replay, settlement, and zero-residual evidence pass                     |
| Private artifact trust and lineage             | proven              | Completed registered packs pass private artifact/export/receipt assertions    |
| Canvas and web performance                     | pending-remediation | 100-node and 500-node budgets pass; production-segment Web Vitals are absent  |
| Private MCP and REST semantic parity           | proven              | Exactly five tools; shared vectors plus Inspector and two SDK clients pass    |
| Usable-pack landed cost                        | pending-remediation | No qualified usable denominator or complete fully landed provider cost exists |
| Unassisted workflow completion                 | pending-human       | Zero qualified sessions completed                                             |
| Usable concept rate                            | pending-human       | Zero qualified usable-concept judgments                                       |
| Evaluator workflow preference                  | pending-human       | The fixed first-five cohort has not completed                                 |
| Qualified customer commitment                  | pending-human       | No qualified staging-use and commercial-intent evidence exists                |

Current canvas evidence is 60.16 FPS for 100 nodes and 60.26 FPS for the 500-node stress fixture,
with 30 DOM nodes mounted and 29.9 ms selection latency. These values supersede the earlier passing
samples in Gate 4. See `launch-readiness-verification-2026-08-20.md`.

## 1. Package boundary and gate mapping

This is the p0-007 evaluation dossier. It makes no step transition and records no operator exit
decision. The representative-run criterion is proven; `GB-02` remains retired and historical runs
are not reused as customer proof. The evaluator and customer-commitment gates still require human
evidence.

`docs/delivery/QUALITY_GATES.md` lines 46–56 contain eleven bullet statements. The active packet
normalizes them into ten P0 acceptance criteria by combining technical completion with latency and
by representing the shared trust bullet in the transactional-money and artifact-trust criteria.
The packet's separate `operator-p0-exit-decision` criterion comes after these ten gates and is not
silently counted as an eleventh validation result. Every authority bullet is quoted verbatim below.

Current roll-up:

| Packet gate                                    | Verdict             | Decisive fact                                                                                      |
| ---------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| Representative completion and latency          | pending-remediation | 14/20 complete; median 101.641 seconds and p90 122.314 seconds pass                                |
| Transactional spend, deduplication, and ledger | proven              | 246 unique T5 attempts/provider registrations; 68,700,000 captured; 4,100,000 released; residual 0 |
| Private artifact trust and lineage             | proven              | 14/14 completed registered T5 runs passed private artifact/export/receipt assertions               |
| Canvas and web performance                     | pending-remediation | 100-node and 500-node browser budgets pass; production-segment Core Web Vitals are absent          |
| Private MCP and REST semantic parity           | proven              | Exactly five tools; 14 vectors; Inspector plus two SDK clients                                     |
| Usable-pack landed cost                        | pending-remediation | 4,550,000 catalog micros per complete pack; external fully landed cost and usability are unknown   |
| Unassisted workflow completion                 | pending-human       | 0 qualified sessions; all eight recruitment slots remain `PENDING`                                 |
| Usable concept rate                            | pending-human       | 0/20 jobs have a qualified-evaluator usable-concept judgment                                       |
| Evaluator workflow preference                  | pending-human       | 0/5 predeclared core evaluators have completed a forced-choice comparison                          |
| Qualified customer commitment                  | pending-human       | No qualified staging-use and commercial-intent evidence exists                                     |

## 2. Gate 1 — representative completion and latency

Verbatim authority text:

> At least 16 of 20 representative runs technically complete.
>
> Median first reviewable static pack ≤10 minutes; p90 ≤15 minutes.

**Verdict: pending-remediation.** Fourteen registered briefs completed, `GB-02` reached
`partial_succeeded`, and `GB-16` through `GB-20` were cap-deferred rather than attempted failures.
Across the 14 completed runs, median time to first reviewable static was 101.641 seconds and p90 was
122.314 seconds, both inside the thresholds. Completion is 14/20, two below the required floor.

Evidence:

- `governance/evidence/WP-P0-001/golden-20-run-proof.md` sections 1, 3, and 8.
- `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/summary.json` (`completed=14`,
  `failed=1`, `cap_deferred=5`, and the latency values above).
- `governance/evidence/WP-P0-001/golden-20-defect-analysis.md` sections 6 and 7.

What remains: one governed `GB-02` rerun must prove the narrowed image prompt on fal, and one fresh
`GB-16` run must complete. The two attempts require at most 9,100,000 reserved micros on a fresh UTC
day. Until both complete, this combined packet criterion stays pending even though its latency half
already passes.

## 3. Gate 2 — transactional spend, deduplication, and ledger

Verbatim authority text:

> No hidden mock, silent fallback, duplicate provider submission/charge, unexplained ledger
> difference, public artifact, or missing lineage receipt.
>
> Default caps of $8/run, $25/workspace/day, and $100/global/day are transactionally enforced.

**Verdict: proven for the transactional-money and duplicate-proof portion.** T5 recorded 246
provider jobs, 246 unique attempt IDs, and 246 unique provider-registration/request-ID pairs. Its
243 capture causative keys were unique across 243 `usage_expense` rows totaling 68,700,000 micros.
The 72,800,000 reserved micros reconciled as 68,700,000 captured plus 4,100,000 released, with no
refund and zero residual.

The apparent `GB-05` duplicate was two separate harness invocations: different workspaces, quotes,
runs, attempts, outbox/dedupe keys, provider request IDs, idempotency scopes, reservations, and
ledger causative keys. Each run had 16 internally unique provider requests and captured exactly
4,550,000 micros with zero residual. It is an extra paid harness run, not a duplicate provider
submission inside one run or a duplicate charge.

The harness used a privileged PostgREST cap audit before every paid brief. The final UTC-day audit
reported the unchanged 100,000,000-micro global cap, 73,250,000 micros exposure, 26,750,000
remaining, 22,750,000 micros reserved as operator headroom, and zero unsettled reservations. Every
registered attempt used a disposable workspace and a 4,550,000-micro quote, below both the
8,000,000-micro run cap and 25,000,000-micro workspace-day cap.

Evidence:

- `governance/evidence/WP-P0-001/golden-20-run-proof.md` sections 2, 4, 7, and 8.
- `governance/evidence/WP-P0-001/golden-20-defect-analysis.md` sections 2 through 4.
- `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/summary.json`.

What remains: no P0 validation gap for this criterion. The harness double-run remains in gross
money totals and its checkpoint-before-poll repair remains part of the permanent regression lane.

## 4. Gate 3 — private artifact trust and lineage

Verbatim authority text:

> No hidden mock, silent fallback, duplicate provider submission/charge, unexplained ledger
> difference, public artifact, or missing lineage receipt.

**Verdict: proven for the artifact, provider, and lineage portion.** All 14 completed registered T5
runs used real enabled providers and each produced 16 available private approved outputs, a
deterministic private export, 17 successful customer artifact metadata reads, 16 capture-to-artifact
links, and a customer receipt with 30 lineage rows. That is 224 provider outputs across the
registered completed set. The partial `GB-02` record separately proves its three available copy
artifacts were private, content-addressed, approved, deterministically exported, and linked to its
three capture rows. The extra `GB-05` harness run records 16 real provider jobs, 16 approved outputs,
a deterministic export, 16 capture rows, 30 lineage rows, and zero residual.

The underlying capability proof showed that the bucket has no external reader: the Worker served
one exact private R2 object only when a short-lived HMAC capability bound artifact ID, object key,
content hash, byte size, MIME type, purpose, and expiry. Wrong-object, tampered, expired, and absent
tokens failed closed; fal itself fetched the valid exact-key capability and completed a real edit.
The T2 full pack independently reconciled 16 real provider/model rows, 16 approved artifacts, 16
capture rows totaling 4,550,000 micros, 30 receipt lineage rows, and a byte-identical re-export.

Evidence:

- `governance/evidence/WP-P0-001/golden-20-run-proof.md` sections 5 through 8.
- `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/GB-01.json`, `GB-02.json`, and
  `GB-05-duplicate.json`, representative machine records for the completed, partial, and extra-run
  shapes.
- `governance/evidence/WP-P0-001/full-pack-proof.md` sections 4 and 5.
- `governance/evidence/WP-P0-001/signed-artifact-access.md` sections 1 through 3.

What remains: no automated P0 trust gap is known. Whether the creative itself is usable remains a
separate evaluator judgment and is not inferred from technical approval.

## 5. Gate 4 — canvas and web performance

Verbatim authority text:

> Canvas maintains ≥55 FPS at 100 visible nodes; 500-node stress remains navigable; p75 LCP ≤2.5s,
> INP ≤200ms, CLS ≤0.1.

**Verdict: pending-remediation.** The locked browser lane measured 56.29 FPS at 100 visible nodes.
The 500-node stress graph measured 51.65 FPS with 30 nodes mounted and 30.2-millisecond selection
latency, passing its committed navigability threshold without relaxing the goldens. However, no
committed evidence reports p75 LCP, INP, and CLS for the authority's agreed production measurement
segment. A staging smoke or local build is not that production-segment measurement.

Evidence:

- `governance/evidence/WP-P0-001/real-web-client-wiring.md` sections 3, 4, 6, and 8.
- `docs/ux/EXPERIENCE_CONTRACT.md` performance budgets.
- `governance/evidence/WP-P0-001/go-live-orchestration-plan.md` section 7.

What remains: define and capture the agreed production measurement segment, then prove p75 LCP at
most 2.5 seconds, INP at most 200 milliseconds, and CLS at most 0.1. The canvas halves pass; the
combined gate does not.

## 6. Gate 5 — private MCP and REST semantic parity

Verbatim authority text:

> Private MCP proof passes Inspector and two real clients with REST-semantic parity.

**Verdict: proven.** Authenticated `tools/list` returned exactly five operations through MCP
Inspector 2.1.0, the official TypeScript SDK 1.30.0, and the official Python SDK 1.29.0. Fourteen
committed vectors covered canvas read, patch, quote, run read, validation, authorization, revision
conflict, quote expiry, explicit confirmation, invalid token, idempotent replay, rate limit,
provider ambiguity, opaque internal error, and fixture-only valid-confirmation shape. Each matched
the REST envelope after normalizing only request IDs.

The live staging boundary made twelve paid-start refusal calls and created zero run rows,
reservations, captures, or provider submissions. Valid-confirmation success, deterministic rate
limit, provider ambiguity, and thrown internal error used the exact local route adapters over a
fixture handler because inducing those states live would violate the no-spend/safety boundary.

Evidence:

- `governance/evidence/WP-P0-001/mcp-parity-proof.md` sections 1 through 5.
- `governance/evidence/WP-P0-001/mcp-parity-vectors.json`.

What remains: no P0 parity gap. Production OAuth and a broader public MCP surface remain P1b scope
and are not prerequisites for this gate.

## 7. Gate 6 — usable-pack landed cost

Verbatim authority text:

> Landed cost ≤$5 per usable launch pack.

**Verdict: pending-remediation.** Every technically complete T5 registered pack captured exactly
4,550,000 catalog micros, which is below 5,000,000 micros. That number is the immutable P0 catalog
charge, not an observed external provider invoice or a fully landed cost. Every T5 machine record
correctly stores `external_provider_cost_micros=null` and `not_observable`.

The accepted pricing evidence estimates one-pass inference at approximately $0.64–$0.71 per pack.
It explicitly excludes retries, billable policy failures, private-R2 storage, moderation, rejected
variants, and operator QA. No qualified evaluator has yet marked any of the 20 jobs usable, so there
is also no valid usable-pack denominator. Technical approval labels are not concept-quality votes.

Evidence:

- `governance/evidence/WP-P0-001/golden-20-run-proof.md` sections 4, 5, 8, and 10.
- `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/summary.json` and the per-brief JSON
  records.
- `governance/evidence/WP-P0-001/pricing-decision.md`, especially the inference-cost and margin
  guardrail sections.

What remains: obtain external provider invoice/usage truth and the remaining fully landed cost
components, then apply them only to packs counted as usable under the qualified-evaluator rubric.
The $5 ceiling is not proven by the $4.55 catalog capture.

## 8. Gate 7 — unassisted workflow completion

Verbatim authority text:

> At least 80% of users complete brief → quote → run → review without assistance.

**Verdict: pending-human.** Zero qualified evaluator sessions have completed. All eight candidate
slots (`EV-01` through `EV-08`) remain `PENDING`. The real staging web product and repeatable
evaluator-zero click path are ready, but operator self-sessions explicitly do not count toward this
gate.

Evidence and prepared materials:

- `governance/evidence/WP-P0-001/self-session-kit.md` and
  `governance/evidence/WP-P0-001/self-sessions/TEMPLATE.md`.
- `docs/research/EVALUATOR_RECRUITMENT.md` qualification definition, session protocol, and log.
- `governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md` sections 3 and 4.

What remains: complete five to eight independently qualified sessions against the real product and
record whether the primary brief-to-review task required any navigation cue, interpretation, or
other assistance. At least 80% of the fixed denominator must be unassisted.

## 9. Gate 8 — usable concept rate

Verbatim authority text:

> At least 70% of jobs produce one or more usable concepts.

**Verdict: pending-human.** Zero of the 20 registered jobs has a qualified-evaluator usable-concept
judgment. The T5 approvals were technical automation labels used to test export and receipt paths;
they do not answer whether an evaluator would advance a concept without rebuilding its core idea.

Evidence and prepared materials:

- `docs/research/GOLDEN_BRIEFS.md` for the fixed 20-brief corpus.
- `docs/research/EVALUATOR_RECRUITMENT.md` evaluation-session protocol and fixed usable definition.
- `governance/evidence/WP-P0-001/self-session-kit.md` sections 4, 5, and 7 for rehearsal only.
- `governance/evidence/WP-P0-001/golden-20-run-proof.md` section 1 for the no-substitution boundary.

What remains: distribute `GB-01` through `GB-20` across the qualified cohort, obtain `none`, `one`,
or `multiple` judgments under the registered rubric, and prove at least 14 of 20 jobs have one or
more usable concepts without changing the denominator after observation.

## 10. Gate 9 — evaluator workflow preference

Verbatim authority text:

> At least 3 of 5 qualified evaluators prefer the workflow to their current process.

**Verdict: pending-human.** None of the predeclared first five qualified completed evaluators exists
yet, so the current result is 0/5 observed rather than 0/5 negative. The protocol fixes the first
five completed qualified sessions as the core cohort and prohibits replacing a negative result
with a supplementary evaluator.

Evidence and prepared materials:

- `docs/research/EVALUATOR_RECRUITMENT.md` cohort composition, forced-choice protocol, and
  recruitment log.
- `governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md` sections 3 and 4.

What remains: recruit the qualified cohort, capture `prefer this workflow`, `prefer current
workflow`, or `no preference` after hands-on work, and obtain at least three `prefer this workflow`
results among the predeclared first five.

## 11. Gate 10 — qualified customer commitment

Verbatim authority text:

> At least one qualified DTC customer or design partner has sanitized durable evidence that it will
> use staging and either intends to pay or has agreed commercial terms. Actual payment and Stripe
> are not required in P0.

**Verdict: pending-human.** No committed evidence yet proves both qualification and a durable
staging-use commitment with commercial intent or agreed terms. Self-session wallet credit,
provider spend, a staging identity, an unqualified lead, a verbal claim, or the operator decision
alone cannot satisfy this gate.

Evidence and prepared materials:

- `docs/research/EVALUATOR_RECRUITMENT.md` session-protocol step 7 and recruitment log.
- `governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md` section 4 and `Left open`.
- `governance/evidence/WP-P0-001/operator-decisions-2026-08-30.md` section 1.

What remains: obtain sanitized durable proof from one qualified DTC customer or design partner that
it will use staging and either intends to pay or has agreed commercial terms, without exposing
customer data, payment secrets, customer media, tokens, or signed URLs.

## 12. Money appendix — every spend-ladder capture

All ledger amounts below are integer USD micros. The rung labels describe external-provider spend
scale; they are not substitutes for catalog quote, reservation, or capture truth.

| Track / evidence event                                     |         Quoted |       Reserved |       Captured |      Released | Refunded | Residual | External provider cost                                       |
| ---------------------------------------------------------- | -------------: | -------------: | -------------: | ------------: | -------: | -------: | ------------------------------------------------------------ |
| Track B direct Kontext capability probe (`$0.04`)          |              — |              — |              0 |             0 |        0 |      N/A | Approximately $0.04; direct provider probe outside a run     |
| Track D copy-only run (`$0.0004` external)                 |        450,000 |        450,000 |        450,000 |             0 |        0 |        0 | Approximately $0.0004 in capture metadata                    |
| Track E approval/export run (`$0.075` external)            |        700,000 |        700,000 |        700,000 |             0 |        0 |        0 | Approximately $0.075                                         |
| Track F interrupted run `143e6229` (`$0.67` scale)         |      4,550,000 |      4,550,000 |      4,550,000 |             0 |        0 |        0 | Invoice not recorded; 2,000,000 was stranded before recovery |
| Track F acceptance run `8e724e99` (`$0.67` scale)          |      4,550,000 |      4,550,000 |      4,550,000 |             0 |        0 |        0 | Invoice not observable                                       |
| T5 golden-20, including the extra `GB-05` harness run      |     72,800,000 |     72,800,000 |     68,700,000 |     4,100,000 |        0 |        0 | Invoice not observable                                       |
| **Ledger total, excluding the direct provider-only probe** | **83,050,000** | **83,050,000** | **78,950,000** | **4,100,000** |    **0** |    **0** | No complete external invoice total exists                    |

Traceability:

- Track B: `governance/evidence/WP-P0-001/signed-artifact-access.md` section 3. It created no P0
  quote, reservation, or capture, so it contributes zero micros to the ledger total.
- Track D: `governance/evidence/WP-P0-001/copy-only-money-path-proof.md` section 1.
- Track E: `governance/evidence/WP-P0-001/approval-export-proof.md` section 1.
- Interrupted Track F: `governance/evidence/WP-P0-001/truth-sync-and-settlement-closure.md`
  sections 1 and 5. The run first stalled with 2,000,000 micros stranded, then the sweeper recovered
  it to 4,550,000 captured and zero outstanding; this table records final ledger truth without
  erasing the incident.
- Acceptance Track F: `governance/evidence/WP-P0-001/full-pack-proof.md` section 3.
- T5: `governance/evidence/WP-P0-001/golden-20-run-proof.md` section 4 and
  `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/summary.json`.

The 22,750,000-micro operator self-session wallet credit is not a provider capture and is excluded.
The kit expressly records that the operator, not the agent, has yet to confirm those runs.

## 13. Landed cost per usable pack

The catalog and external cost views must stay separate:

| Observable                                            | Current value                                        | Decision use                                                    |
| ----------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Catalog quote/capture for one complete pack           | 4,550,000 micros                                     | Immutable P0 customer ledger truth; below the $5 ceiling        |
| One-pass inference estimate                           | Approximately 640,000–710,000 micros                 | Planning estimate only; not an invoice or fully landed cost     |
| External invoice in T5 receipt/context                | Not observable (`null`)                              | Cannot support a reconciliation claim                           |
| Storage, moderation, retry, rejected-output, QA costs | Not completely measured                              | Required before calling the fully landed cost proven            |
| Qualified-evaluator usable packs                      | 0 judged                                             | No valid denominator for the authority's per-usable-pack test   |
| P1a 60% margin guardrail                              | At most 1,820,000 fully landed micros per $4.55 pack | Stricter successor requirement; currently estimated, not proven |

The catalog charge alone is below $5, and the one-pass inference estimate is below both $5 and the
P1a $1.82 guardrail. Neither comparison closes the P0 economics gate. A qualified evaluator must
first establish which packs count as usable, and the external invoice plus omitted landed-cost
components must then reconcile to each such pack. The current verdict is therefore
`pending-remediation`, not a provisional pass.

## 14. Remediation plan snapshot

The smallest technical completion remediation is fixed and operator-gated:

1. Wait for a fresh UTC day and preserve the unchanged transactional caps.
2. Rerun `GB-02` once in a new disposable workspace to validate the narrowed supplement image
   prompt. Do not retry blind if it returns another policy failure.
3. Run cap-deferred `GB-16` once in its own disposable workspace.
4. Reserve at most 9,100,000 micros total: 4,550,000 per brief.
5. Stop and preserve provider result and PostgREST money evidence if either run stalls, strands
   money, or reaches `reconciliation_required`.
6. Recompute the registered completion count and latency distribution only after both records land.

Do not rerun `GB-05`. The row-level evidence already proves the engine duplicate-submission gate,
and another run would add cost without acceptance value. Source:
`governance/evidence/WP-P0-001/golden-20-defect-analysis.md` section 7.

## 15. Human-gate runway

The operator sequence is:

1. **Evaluator-zero self-sessions.** Use
   `governance/evidence/WP-P0-001/self-session-kit.md` and copy
   `governance/evidence/WP-P0-001/self-sessions/TEMPLATE.md` per run. These sessions rehearse the
   product and protocol and never count toward any qualified evaluator gate.
2. **Recruitment.** Use the qualification screen, sourcing order, outreach, conflict exclusions,
   incentive terms, and eight-slot log in `docs/research/EVALUATOR_RECRUITMENT.md`.
3. **Five to eight qualified sessions.** Run the registered protocol against the real staging web
   product. Keep the first five completed qualified participants as the fixed preference cohort,
   distribute all 20 golden briefs, and record unassisted completion plus usable-concept judgments.
4. **Customer commitment.** Obtain sanitized durable evidence that one qualified DTC customer or
   design partner will use staging and either intends to pay or has agreed commercial terms. Actual
   payment and Stripe are not required; unqualified or verbal interest does not count.
5. **Go/no-go.** Review this dossier plus remediation and human evidence, then record `go` or
   `pivot/stop`. Silence is not approval, and a failed usable-output, economics, or paid-demand gate
   blocks P1 expansion.

The operator decision in
`governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md` requires this order: self-sessions
precede recruitment, and the exit review follows the qualified sessions.

## 16. What P0 exit unlocks in P1a

P0 exit does not itself deploy production. A recorded go decision unlocks the governed P1a work:

- provision isolated production Supabase, Vercel, Worker, R2, secrets, bindings, and telemetry;
  `governance/evidence/WP-P0-001/environment-provisioning.md` explicitly records that production
  Supabase and the V2 production Worker do not yet exist;
- promote additive migrations, Core, web, and controlled catalog behavior in the order required by
  `docs/operations/DEPLOY_ROLLBACK_AND_INCIDENTS.md`, recording version identifiers, smoke evidence,
  rollback targets, environment checks, and explicit approval;
- enforce the fully landed margin guardrail of at most 1,820,000 micros per $4.55 pack for 60%
  margin before real charging, rather than treating the looser $5 P0 ceiling as the price model;
- resolve the explicitly deferred 18-row staging migration-history divergence through deliberate
  reconciliation or a fresh staging database, per
  `governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md` section 2;
- cut over only with a named operator and observed rollback, keep legacy v1 live until V2 staging
  and production smoke pass, observe 72 continuous hours of zero legacy traffic, and follow the
  allowlisted export/retirement sequence in `docs/operations/LEGACY_V1_RETIREMENT.md`; and
- complete the inventory gaps in
  `governance/evidence/WP-P0-001/legacy-v1-read-inventory.md`. Exact Worker, D1, KV, and R2
  identifiers now exist, but Pages, routes/domains/DNS, Durable Objects/Workflows/queues/cron,
  30-day traffic, webhooks, Stripe, Vercel, ownership, and dependency evidence remain open. The
  inventory authorizes no deletion.

## 17. Amendment 2026-08-12: remediation failed closed

The authorized remediation did not change the representative gate verdict. `GB-02` reached
`partial_succeeded` after two of three FLUX.2 master result bodies again returned HTTP 422
`content_policy_violation` at `body.prompt`. The third master and its three adaptations succeeded.
The harness stopped before `GB-16`, so registered completion remains 14/20 and the completed-run
latency sample remains median 101.641 seconds and p90 122.314 seconds.

PostgREST reconciled the new 4,550,000-micro reservation as 1,550,000 captured plus 3,000,000
released, with zero refund, zero residual, and zero unsettled reservations. The money appendix is
therefore amended, not rewritten:

| Amendment money field                    |         Quoted |       Reserved |       Captured |      Released | Refunded | Residual |
| ---------------------------------------- | -------------: | -------------: | -------------: | ------------: | -------: | -------: |
| 2026-08-12 GB-02 remediation             |      4,550,000 |      4,550,000 |      1,550,000 |     3,000,000 |        0 |        0 |
| **Spend-ladder total after remediation** | **87,600,000** | **87,600,000** | **80,500,000** | **7,100,000** |    **0** |    **0** |

The direct provider-only Track B probe remains excluded from ledger totals. External provider
invoice cost remains unobservable. Evidence is `golden-20-run-proof.md` section 10 and the two
2026-08-12 remediation JSON records under `launch-pack-runs/golden-20/`.

The next technical spend decision returns to the operator. No further prompt fix, `GB-02` retry, or
`GB-16` attempt is implied by this dossier. The human runway remains self-sessions, recruitment,
five-to-eight qualified sessions, paid pilot, and go/no-go after the operator resolves whether the
technical representative gate receives another remediation authorization.

## 18. Amendment 2026-08-12: representative completion and latency proven

This amendment supersedes only the current verdict and figures in Gate 1 and the money appendix; it
does not erase the failed first remediation recorded in section 17. The second operator
authorization completed `GB-16` and `GB-17` through real enabled providers. Both runs contained 16
unique succeeded attempts and provider jobs, complete private artifact/lineage/receipt assertions,
and exact 4,550,000-micro captures with zero release or residual. Since neither primary failed, the
authorized `GB-18` contingency was not exercised.

**Gate 1 amended verdict: proven.** The registered corpus now contains 16 completed briefs, one
failed brief (`GB-02`), and three cap-deferred briefs (`GB-18` through `GB-20`). Across the 16
completed runs, median time to first reviewable static is 101.631 seconds and nearest-rank p90 is
122.314 seconds. This proves the 16/20 floor and both latency ceilings. Evidence is
`governance/evidence/WP-P0-001/golden-20-run-proof.md` section 11,
`governance/evidence/WP-P0-001/launch-pack-runs/golden-20/GB-16.json`, `GB-17.json`, and the amended
`summary.json`.

The money appendix is amended, not rewritten:

| Amendment money field                          |         Quoted |       Reserved |       Captured |      Released | Refunded | Residual |
| ---------------------------------------------- | -------------: | -------------: | -------------: | ------------: | -------: | -------: |
| Second remediation: GB-16 plus GB-17           |      9,100,000 |      9,100,000 |      9,100,000 |             0 |        0 |        0 |
| **Golden-20 total after both remediations**    | **86,450,000** | **86,450,000** | **79,350,000** | **7,100,000** |    **0** |    **0** |
| **Spend-ladder total after both remediations** | **96,700,000** | **96,700,000** | **89,600,000** | **7,100,000** |    **0** |    **0** |

The direct provider-only Track B probe remains outside ledger totals, and external provider invoice
cost remains unobservable. The technical representative gate is now closed; the current operator
sequence is evaluator-zero self-sessions, recruitment, five-to-eight qualified sessions, one signed
paid pilot, and the P0 go/no-go or pivot/stop decision.

## 19. Amendment 2026-08-30: paid-demand proof definition

The operator-supplied 2026-08-30 decision supersedes only the P0 paid-demand proof definition. The
gate no longer requires actual payment or a signed paid-pilot agreement in P0. It remains
`pending-human` until sanitized durable evidence proves that one qualified DTC customer or design
partner will use staging and either intends to pay or has agreed commercial terms. This amendment
does not change any evaluator denominator, usable-output judgment, landed-cost requirement,
production-segment performance gate, provider-spend boundary, or operator exit decision.

Evidence is
`governance/evidence/WP-P0-001/operator-decisions-2026-08-30.md`. Historical sections above remain
the dated record of the earlier gate definition; this section controls the current verdict.

## 20. Left open

- Representative completion and latency are proven at 16/20, median 101.631 seconds, and p90
  122.314 seconds. `GB-18` through `GB-20` remain cap-deferred but are not required to exceed the
  registered acceptance floor.
- Production-segment p75 LCP, INP, and CLS evidence does not exist; canvas FPS and stress
  navigability alone do not pass the combined performance gate.
- External provider invoice and complete fully landed cost are not observable, and no pack has a
  qualified-evaluator usable judgment; the $5 gate and P1a $1.82 guardrail remain unproven.
- All eight recruitment slots remain `PENDING`; unassisted completion, usable concept rate,
  evaluator preference, qualified customer commitment, and the operator P0 exit decision remain
  human work.
- The packet remains on `p0-007-p0-gate-evaluation`; this dossier records no operator exit decision
  and does not prepare the p0-008 successor transition early.
