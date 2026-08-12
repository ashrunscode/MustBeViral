# The golden-20 acceptance rung remains pending after 14 completed briefs

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-11

## 1. Verdict and execution boundary

The governed staging rung produced 14 technically complete registered briefs, one genuine partial
provider failure (`GB-02`), and five cap-deferred briefs (`GB-16` through `GB-20`). The completed-run
latency thresholds passed, but the packet requires at least 16 of 20 completed briefs. A separate
`GB-05` harness double-run was also discovered and reconciled. The 2026-08-11 row-level RCA in
`golden-20-defect-analysis.md` proves that it was two distinct harness invocations, not a duplicate
provider submission inside one run; the spend-dedup criterion is therefore reclassified pass. The
representative completion/latency criterion remains pending.

All paid work ran on staging with the configured transactional caps unchanged. No production or
legacy-v1 resource was read or mutated. Every registered brief used a disposable workspace, and
the operator self-session workspace remained off-limits. Approval descriptions were technical
automation labels; they are not usable-concept judgments and do not substitute for evaluator
evidence.

Machine-readable evidence is in
`governance/evidence/WP-P0-001/launch-pack-runs/golden-20/`: one JSON record per registered brief,
`GB-05-duplicate.json`, and `summary.json`.

## 2. Cap audit and governed staging read path

Direct service-role table reads correctly failed closed, so the harness added the aggregate-only
`public.get_global_spend_exposure()` RPC in migration
`20260811114946_p0_global_spend_exposure_audit.sql`. It mirrors the exact `start_run` UTC-day
exposure formula, returns no tenant rows, revokes all default execution, and grants execution only
to `service_role`. The migration was applied to staging with Supabase `apply_migration`; no linked
push, pull, reverted status, or migration-history repair was used.

At 2026-08-11 13:11:47.227821 UTC, staging reported function-definition MD5
`2b363c689b9fd80b961d2cefa78b6a70`, `service_role` execute true, and `authenticated` execute
false. Local Postgres 17, with the repository migrations applied, reported the same MD5 at
13:11:53.352942 UTC. The 18-row migration-history divergence was untouched.

The initial privileged PostgREST audit at 11:57:44.292037 UTC reported 4,550,000 micros of existing
global exposure and 95,450,000 remaining. After reserving the required 22,750,000 micros for
operator self-sessions, 15 packs fit. The harness repeated the same PostgREST check before every
brief. The final audit at 13:08:22.238473 UTC reported:

| Global-day field                       | Micros / count |
| -------------------------------------- | -------------: |
| Configured cap                         |    100,000,000 |
| Final exposure                         |     73,250,000 |
| Final remaining                        |     26,750,000 |
| Required operator headroom             |     22,750,000 |
| Spendable remainder after headroom     |      4,000,000 |
| Full-pack quote                        |      4,550,000 |
| Reservations                           |             17 |
| Captured / partially captured statuses |         16 / 1 |
| Unsettled reservations                 |              0 |

The remaining 4,000,000 micros was below one full quote, so `GB-16` through `GB-20` were deferred
without a quote, wallet credit, reservation, or provider submission. A cap-deferred brief is not a
technical run failure.

## 3. Outcome and latency by registered brief

Time is measured from the immutable run `confirmed_at` timestamp to the first available image
artifact and to the terminal run timestamp. A dash means no paid run or no reviewable static.

| Brief | Outcome      | Run                                    | Workspace                              | First static (s) | Terminal (s) |  Captured |  Released |
| ----- | ------------ | -------------------------------------- | -------------------------------------- | ---------------: | -----------: | --------: | --------: |
| GB-01 | completed    | `44b3197f-7119-4724-954a-ce9308090ef8` | `69353b4f-3e82-4679-b2c2-0e18cc3650e9` |           80.403 |      127.973 | 4,550,000 |         0 |
| GB-02 | failed       | `103e7b53-fb8a-4364-b6ea-222eb5193528` | `a858efb0-6bac-49a1-a747-74d91205f7a6` |                — |      125.380 |   450,000 | 4,100,000 |
| GB-03 | completed    | `4dca3a50-43ad-4dff-a9ca-07bf32e890aa` | `207480dc-2f3b-423c-81f4-2cf24cfcef62` |           92.303 |      153.525 | 4,550,000 |         0 |
| GB-04 | completed    | `9143df52-2288-4434-ac4e-effe673d0b0a` | `d74c2bef-e6d1-4d19-b1ca-7f66e6c72eae` |          105.824 |      156.824 | 4,550,000 |         0 |
| GB-05 | completed    | `512eaee5-4f26-4b5d-b1b2-f4060eb7a649` | `11855102-6cc5-435a-8aa6-e4d31341f74a` |           55.448 |      121.035 | 4,550,000 |         0 |
| GB-06 | completed    | `1d22781f-f68c-4840-8ec5-fe7c2acc2255` | `5e614bf1-9ad8-4324-91b5-31ad7d90ef87` |          101.631 |      164.335 | 4,550,000 |         0 |
| GB-07 | completed    | `0d7de786-1123-45d3-98e1-83fd6700c0a4` | `9942fcef-1e8a-4f11-9f9a-31c503edbe13` |           92.851 |      143.390 | 4,550,000 |         0 |
| GB-08 | completed    | `6ee78817-6244-45af-84eb-599da9ccc4b0` | `adff0689-da02-4f1c-90fc-8d8487de8772` |          112.982 |      166.260 | 4,550,000 |         0 |
| GB-09 | completed    | `3216a358-95fb-4ec0-ab51-2a286129e085` | `2ded0aca-6afa-4464-9b02-6c6dc27098b6` |          107.165 |      151.139 | 4,550,000 |         0 |
| GB-10 | completed    | `2bb3c774-1384-4d49-a29f-12a492b902be` | `c8fef6f0-a99a-4f46-a676-be8259b64fab` |          129.580 |      181.933 | 4,550,000 |         0 |
| GB-11 | completed    | `bd6cef37-da44-4fe8-a7c0-9a91fc4b198b` | `91569951-d0ce-42f2-8e64-bed757ce8afc` |          101.483 |      160.390 | 4,550,000 |         0 |
| GB-12 | completed    | `81635457-a4bb-447f-990d-a8e67d5749bb` | `7901958f-8cbc-4e92-9e3a-71a9b764b0a9` |          122.314 |      173.997 | 4,550,000 |         0 |
| GB-13 | completed    | `af9ff27e-ec15-48cf-8d58-7abe8227e7f5` | `0ddbc465-792e-4ce9-9df9-8941cd087b9b` |          101.641 |      156.596 | 4,550,000 |         0 |
| GB-14 | completed    | `ae2a472d-26db-4b5b-a274-143e8f935e10` | `3a758610-954c-4c46-8a87-ca35fab65de5` |          110.785 |      171.367 | 4,550,000 |         0 |
| GB-15 | completed    | `9d71d0fb-9bdb-4283-8bae-00cf6bb6187d` | `cda10d00-4804-44b7-9430-e361e02a07d5` |          111.959 |      161.677 | 4,550,000 |         0 |
| GB-16 | cap-deferred | —                                      | —                                      |                — |            — |         0 |         0 |
| GB-17 | cap-deferred | —                                      | —                                      |                — |            — |         0 |         0 |
| GB-18 | cap-deferred | —                                      | —                                      |                — |            — |         0 |         0 |
| GB-19 | cap-deferred | —                                      | —                                      |                — |            — |         0 |         0 |
| GB-20 | cap-deferred | —                                      | —                                      |                — |            — |         0 |         0 |

Across the 14 completed registered briefs, nearest-rank median time to first reviewable static was
**101.641 seconds (1 minute 41.641 seconds)** and p90 was **122.314 seconds (2 minutes 2.314
seconds)**. Both latency thresholds passed by a wide margin. Completion was **14/20**, below the
required 16/20.

## 4. Money reconciles to the micro

The 15 distinct registered-brief attempts reserved 68,250,000 micros. Fourteen completed captures
totaled 63,700,000 micros. `GB-02` captured 450,000 micros for its three successful copy jobs and
released 4,100,000 micros when its remaining graph became terminal. The duplicate `GB-05` finding
reserved and captured another 4,550,000 micros.

| T5 money field                                  |         Micros |
| ----------------------------------------------- | -------------: |
| Distinct registered-brief quotes / reservations |     68,250,000 |
| Duplicate GB-05 quote / reservation             |      4,550,000 |
| **Gross quoted / reserved**                     | **72,800,000** |
| Captured by 14 completed registered briefs      |     63,700,000 |
| Captured by failed GB-02                        |        450,000 |
| Captured by duplicate GB-05                     |      4,550,000 |
| **Gross captured**                              | **68,700,000** |
| Released by GB-02                               |      4,100,000 |
| Refunded                                        |              0 |
| **Residual across every T5 reservation**        |          **0** |

The final cross-run audit found 246 provider jobs, 246 unique attempt IDs, and 246 unique
provider-registration/request-ID pairs. It found 243 unique capture causative keys in 243
`usage_expense` credit rows totaling 68,700,000 micros. Thus there was no duplicated provider
request ID or duplicated ledger causative key inside a run. The separately confirmed second full
`GB-05` pack remains visible in gross spend but is classified as a harness double-run, not an engine
duplicate-submission or ledger failure.

Catalog capture is the landed customer charge: 4,550,000 integer micros for each completed full
pack, 450,000 for the partial `GB-02`, and 4,550,000 for the duplicate pack. External provider
invoice cost was not observable through the receipt, provider context, or configured evidence path,
so every JSON record stores it as `null` with `not_observable`; no `$0.67` estimate was substituted
for ledger truth.

## 5. Completed-run artifact, approval, export, and receipt proof

For every one of the 14 completed registered runs, the customer and privileged paths jointly proved:

- 16 terminal-succeeded provider jobs and 16 unique attempts: three OpenRouter copy sets, three fal
  FLUX.2 masters, nine fal Kontext adaptations, and one fal Seedance motion branch;
- 16 available private artifacts promoted to `approved_output`, with an approval replay reporting
  all 16 as already approved;
- a deterministic private ZIP export whose second export had the identical SHA-256 hash;
- 17 successful customer artifact metadata reads, exact canonical private object-key families,
  nonzero byte sizes, and SHA-256 content hashes;
- successful downstream adaptations and motion through the short-lived exact-key provider-input
  capability path, without persisting or recording a signed URL;
- a customer `GET /v1/runs/:id/receipt` containing the succeeded run, zero-residual reservation, 16
  capture rows, 16 approved outputs, one export, and 30 lineage rows; and
- a privileged PostgREST `get_export_context` result with the same 16 artifacts, 16 provider/model
  rows, 14 pre-export lineage rows, and exact capture total.

No object key, signed URL, provider payload, customer media, token, or credential is recorded in
this evidence. The per-brief JSON stores only identifiers, hashes, counts, timings, integer micros,
and boolean proof results.

## 6. Failed run analysis

`GB-02` (`103e7b53-fb8a-4364-b6ea-222eb5193528`) reached `partial_succeeded`, not
`reconciliation_required`. Its three OpenRouter copy jobs succeeded and captured 450,000 micros.
All three fal `fal-ai/flux-2-pro` master jobs reached terminal `failed`; nine adaptations and the
motion branch were then canceled or skipped. The normalized provider evidence preserves terminal
state and route but not the provider result detail. The subsequent bounded RCA read all three fal
result bodies: each returned HTTP 422 `content_policy_violation` at `body.prompt`. The cause is
therefore classified as prompt material, not provider availability or route/pinning.

The run had no stranded money: 4,100,000 micros released, zero residual, and no non-terminal node.
Its three available copy artifacts were technically approved, replayed, exported twice with the
same hash, read through the customer receipt, and reconciled through PostgREST. It remains a failed
full pack because no reviewable static, adaptation, or motion was produced. It was never retried.

## 7. Duplicate run finding and harness repairs

Run `d6db5d0f-ec18-4cde-98c2-7dc61a6de4b4` was the first paid `GB-05` pack in workspace
`0b8ce93a-7abf-4307-9621-25c69e2e70bd`. A confirmed run existed when the local harness process was
interrupted, but the harness persisted evidence only after terminal reconciliation. A separate
harness invocation could not discover that run and confirmed registered run
`512eaee5-4f26-4b5d-b1b2-f4060eb7a649` in a new workspace 3.207630 seconds before the first run
terminalized. Both completed with 16 unique requests, 4,550,000 captured micros, deterministic
export, complete receipt/lineage, and zero residual.

The RCA found no cross-run overlap in workspaces, quotes, attempt IDs, request IDs, provider billing
keys, outbox IDs/dedupe keys, idempotency contract keys, or ledger causative keys. Each start used a
different invocation-scoped idempotency key. This is therefore a harness double-run: an extra paid
pack, but not a duplicate provider submission inside one engine run and not a duplicate money
movement. `golden-20-defect-analysis.md` supersedes the earlier unclassified finding.

The harness now writes a safe `RUN_IN_PROGRESS_CHECKPOINT` containing run and reservation IDs
immediately after confirmed start and before polling. Resume consumes that checkpoint and never
calls `start_run` for the brief again. The explicit ordering helper now has a regression test that
fails on poll-before-persist ordering. The rung also exposed and repaired three non-money defects:

- the strict receipt contract omitted the live `dispatch_epoch`; the Zod schema, parity fixture, and
  generated OpenAPI now include it;
- the artifact checker guessed an `artifacts/` key family instead of the canonical
  `attempts/{attempt}/provider-output` and `exports/{hash}.zip` functions; and
- an 80-character workspace slug could end in `-` because trimming happened before slicing; the
  composition now trims the sliced result, while the harness uses a short stable disposable name.

These repairs explain the local process resumes recorded on several JSON records. None resubmitted
the recorded paid run. No stranded-dispatch or reconciliation sweeper was needed.

## 8. Acceptance verdicts

| Criterion                                                                 | Verdict  | Proof / gap                                                                                           |
| ------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| At least 16 of 20 registered briefs technically complete                  | **Fail** | 14 completed, 1 failed, 5 cap-deferred                                                                |
| Median first reviewable at most 10 minutes                                | Pass     | 101.641 seconds                                                                                       |
| p90 first reviewable at most 15 minutes                                   | Pass     | 122.314 seconds                                                                                       |
| Zero duplicate provider submissions, duplicate charges, or ledger gaps    | Pass     | GB-05 was two harness invocations; all in-run provider and ledger keys were unique                    |
| Transactional caps enforced                                               | Pass     | PostgREST audit before every start; final global exposure 73,250,000 with zero unsettled reservations |
| Every completed run has private artifacts, lineage, and immutable receipt | Pass     | 14/14 completed registered runs passed every stored assertion                                         |
| Landed cost and external provider cost kept separate                      | Pass     | Integer catalog captures recorded; external invoice cost explicitly unavailable                       |

Because the combined completion-and-latency criterion requires both the count and the latency
thresholds, `representative-run-completion-and-latency` remains `pending` in the active packet. The
transactional spend/dedup/ledger criterion is reclassified `passed` by the bounded row-level RCA;
the harness incident remains recorded in the money totals and does not disappear.

## 9. Verification and remote-mutation record

- The database lane applied all migrations to isolated local Postgres 17 and passed 395 pgTAP
  assertions after the focused audit test passed.
- Contract tests proved the live receipt shape, and docs generation updated the single generated
  OpenAPI authority rather than creating a parallel document.
- The staging migration was the only schema mutation. Other staging mutations were the authorized
  disposable identities/workspaces, wallet credits, paid runs, technical approvals, and exports.
- Money claims were proven through service-role PostgREST aggregate and export-context RPCs. The
  management query endpoint was used only for read-only timing, root-cause, and cross-run uniqueness
  supplements.
- No credentials were committed or written to evidence. The local scratch directory remained
  ignored.

## 10. Amendment 2026-08-12: authorized remediation stopped after GB-02

The operator amendment recorded at 2026-08-11 16:45 UTC authorized exactly `GB-02` and `GB-16`
after the UTC rollover, with an absolute 9,100,000-micro reservation ceiling. The live staging
Worker still predated prompt-fix commit `3315794`, so committed HEAD `818b6e0` was deployed first.
Cloudflare version `ab6ee55f-0029-445a-b5ab-8edf5777aaea` now holds 100% of staging traffic;
version `66b8da78-f001-4077-a268-da6c7063c6ab` is the rollback target. `GET /health` returned HTTP
200, generation `viralgraph-cleanroom-v2`, and status `ok` at 00:08:14.308 UTC.

The harness added and exercised fail-closed selection controls: repeated `--brief` values selected
only `GB-02` and `GB-16`, `--expected-utc-day 2026-08-12` pinned the cap window,
`--max-reserved-micros 9100000` bounded aggregate reservation, and `--stop-on-failure` prevented a
second confirmation after a failed first run. The privileged PostgREST precondition at
00:11:46.039834 UTC reported the 2026-08-12 UTC window, zero exposure, 100,000,000 micros remaining,
and zero unsettled reservations.

| Brief | Remediation outcome | Run                                    | First succeeded static attempt | Terminal |  Reserved |  Captured |  Released | Residual |
| ----- | ------------------- | -------------------------------------- | -----------------------------: | -------: | --------: | --------: | --------: | -------: |
| GB-02 | `partial_succeeded` | `8d37f4f8-ee3f-4ccd-82c7-30732c2beef5` |                       76.100 s | 87.448 s | 4,550,000 | 1,550,000 | 3,000,000 |        0 |
| GB-16 | not run             | —                                      |                              — |        — |         0 |         0 |         0 |        0 |

`GB-02` produced all three copy outputs, one of three FLUX.2 masters, and all three adaptations
descending from that successful master. The other two master result bodies were read from fal's
result endpoints and both returned HTTP 422 `content_policy_violation` at `body.prompt`. Because one
master and its descendants succeeded on the same route, dispatch epoch, Worker, and graph, the
failure remains a prompt-material defect: the first narrowing removed offer and audience context
but did not make every master prompt policy-safe. fal did not identify the triggering token, so no
second speculative prompt change or paid retry was made.

At 00:14:39.086192 UTC, bounded service-role PostgREST audit
`get_run_execution_audit` reported 16 attempts, nine provider jobs, seven unique capture causative
keys, and terminal `partial_succeeded`. At 00:14:39.232350 UTC,
`get_global_spend_exposure` reported 1,550,000 micros exposure and zero unsettled reservations. The
reservation reconciled exactly:

| Remediation money field |    Micros |
| ----------------------- | --------: |
| Quoted / reserved       | 4,550,000 |
| Captured                | 1,550,000 |
| Released                | 3,000,000 |
| Refunded                |         0 |
| Residual                |     **0** |

No recovery RPC or refund was appropriate because no money was held. Approval, export, and the
customer receipt read were not attempted after the full pack failed. The stop guard ended the
invocation before creating a `GB-16` workspace, quote, reservation, or provider submission.

Including this remediation attempt, golden-20 gross money is 77,350,000 quoted/reserved,
70,250,000 captured, 7,100,000 released, and zero residual across 17 paid attempts. Registered
completion remains **14/20**; the completed-run median remains 101.641 seconds and p90 remains
122.314 seconds. Therefore `representative-run-completion-and-latency` honestly remains pending.
Machine records are `GB-02-remediation-2026-08-12.json`,
`GB-16-remediation-2026-08-12.json`, and the amended `summary.json` beside this evidence.

## 11. Left open

- Five registered briefs (`GB-16` through `GB-20`) remain incomplete. `GB-16` was selected for the
  authorized remediation but the safety stop prevented any workspace, quote, reservation, or
  submission; `GB-17` through `GB-20` remain cap-deferred.
- The 16/20 representative completion gate remains pending at 14/20.
- `GB-02` has now failed two governed attempts with prompt-policy errors. The first failed all three
  masters; the narrowed prompt let one master and its three descendants succeed but two masters
  still failed. The provider response does not identify the triggering token.
- Any further prompt change, `GB-02` attempt, or first `GB-16` attempt requires a new operator
  decision and fresh spend authorization. No retry is queued.
