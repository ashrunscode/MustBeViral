# Golden-20 defects are classified and the remediation is bounded

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-11

## 1. Investigation boundary and verdict

This was a no-spend root-cause pass. It created no quote, wallet credit, reservation, run, provider
submission, approval, or export. Staging reads used a bounded service-role PostgREST RPC; the three
failed fal jobs were then read through their queue result endpoints. No production or legacy-v1
resource was touched, and no credential, provider payload, customer media, artifact key, or signed
URL is recorded here.

The two T5 findings have different classifications:

- `GB-05` was a **harness double-run**, not a duplicate provider submission inside one run. Two
  separate harness invocations created separate workspaces, quotes, idempotency scopes, runs,
  outbox streams, attempts, provider request IDs, and ledger causative keys. The engine's replay and
  duplicate-submission controls held within both runs.
- `GB-02` was a **prompt-material failure**. All three `fal-ai/flux-2-pro` master jobs returned HTTP
  422 result bodies with `content_policy_violation` at `body.prompt`. It was not a transient provider
  outage, route/pinning defect, epoch defect, or settlement defect.

The prior T5 conclusion that `GB-05` failed the engine duplicate-submission/ledger acceptance gate is
superseded by this row-level reconstruction. The representative completion gate remains pending at
14 of 20 completed registered briefs.

## 2. Bounded staging audit path and fingerprint

Forward migration `20260811132914_p0_golden_20_defect_audit.sql` adds
`public.get_run_execution_audit(uuid[])`. The function accepts one to ten unique run IDs and returns
only the run, attempt, provider-job, outbox, idempotency, reservation, and integer-ledger fields
needed for reconstruction. It excludes provider payloads, object keys, signed URLs, credentials,
and customer media. Default execution is revoked; only `service_role` receives execute.

The migration was applied to staging through Supabase MCP `apply_migration`. No linked push, pull,
reverted-status command, or migration-history repair was used; the known 18-row migration-history
divergence was untouched. At 2026-08-11 13:32:26.748673 UTC, staging PostgreSQL 17.6 reported
`md5(pg_get_functiondef)` value `e9cd2d512b0de0f7e895f52d413bee54`, `service_role` execute true,
and `authenticated` execute false. Local PostgreSQL 17.6 with the repository migrations applied
reported the identical fingerprint at 13:32:25.690413 UTC.

At 2026-08-11 13:33:50.567140 UTC, `POST /rest/v1/rpc/get_run_execution_audit` through the
PostgREST API path returned HTTP 200 for the three bounded run IDs below. This is the source for all
database-row claims in sections 3 through 6.

## 3. GB-05 sequence reconstruction

The first paid run was still advancing when the registered run was confirmed:

| Field                                 | First harness run                      | Registered harness run                 |
| ------------------------------------- | -------------------------------------- | -------------------------------------- |
| Run                                   | `d6db5d0f-ec18-4cde-98c2-7dc61a6de4b4` | `512eaee5-4f26-4b5d-b1b2-f4060eb7a649` |
| Workspace                             | `0b8ce93a-7abf-4307-9621-25c69e2e70bd` | `11855102-6cc5-435a-8aa6-e4d31341f74a` |
| Quote                                 | `cd0f261f-3c28-4ded-ab9e-451fac6e761d` | `6392e1e1-467f-4a3c-858f-13ac52e32bbc` |
| Reservation                           | `3a839ff0-04b3-4008-bc59-5066c09cb96d` | `72ce3517-66a5-4213-98b7-8addc767fbe0` |
| Confirmed UTC                         | 2026-08-11 12:24:30.048947             | 2026-08-11 12:27:21.083843             |
| Terminal UTC                          | 2026-08-11 12:27:24.291473             | 2026-08-11 12:29:22.118456             |
| Final run state                       | `succeeded`, wave 3, epoch 6           | `succeeded`, wave 3, epoch 6           |
| Attempts / provider jobs              | 16 / 16                                | 16 / 16                                |
| Outbox events / idempotency records   | 7 / 4                                  | 7 / 4                                  |
| Ledger rows / unique causative keys   | 34 / 17                                | 34 / 17                                |
| Reserved / captured / residual micros | 4,550,000 / 4,550,000 / 0              | 4,550,000 / 4,550,000 / 0              |

The registered run was confirmed 171.034896 seconds after the first confirmation and 3.207630
seconds before the first run reached terminal `succeeded`. Both runs name actor
`8c11dc31-356b-4d57-afd6-70d2361baf99`, but that is their only identity overlap.

The first `start_run` idempotency key was
`golden-brief:174eae55-5951-4f8a-9724-430213fe9052:GB-05:start`; the registered run used
`golden-brief:59334c8a-ac0e-44ab-aaff-5e0ef104f58b:GB-05:start`. Their invocation segments,
workspaces, response run IDs, and response reservation IDs are all different. Each run's seven
outbox rows were published with zero publish retries and distinct run-scoped dedupe keys from
`dispatch:1` through `dispatch:3:6`.

## 4. GB-05 classification and fix

Cross-run intersection was empty for workspace IDs, quote IDs, attempt IDs, attempt request IDs,
provider request IDs, provider billing-idempotency keys, outbox event IDs, outbox dedupe keys,
full idempotency contract keys, and ledger causative keys. Within each run there were 16 unique
attempts and provider requests, 17 unique double-entry causative keys, exact 4,550,000-micro
capture, and zero residual.

That evidence rules out outbox redelivery, a slipped provider dedupe key, dispatch epoch/wave
interaction, duplicated money movement, and duplicate provider submission inside one run. The
precise defect was in the T5 harness lifecycle: the original process could be interrupted after
`start_run` committed but before a durable run checkpoint existed. A new harness invocation then
created a fresh disposable workspace and a legitimately distinct paid run for the same brief.

The T5 repair that writes `RUN_IN_PROGRESS_CHECKPOINT` immediately after confirmation is now routed
through the explicit `pollAfterPersistingConfirmedRun` ordering boundary. A regression test
simulates a local interruption on the first poll and proves the checkpoint action happens first.
With the pre-fix poll-before-persist ordering restored temporarily, the focused test failed with
observed order `['poll']` instead of `['checkpoint', 'poll']`; the fixed implementation passes.

The summary model now distinguishes `harness_double_run` from `engine_duplicate_submission`.
Harness double-runs remain visible in paid-attempt and money totals, but they no longer falsify an
engine duplicate-submission/ledger criterion that the row evidence proves passed. A true engine
duplicate finding or any completed-run duplicate attempt, residual, or integrity gap still fails
closed.

## 5. GB-02 sequence and provider result bodies

Run `103e7b53-fb8a-4364-b6ea-222eb5193528` in workspace
`a858efb0-6bac-49a1-a747-74d91205f7a6` was confirmed at 2026-08-11 12:14:10.848859 UTC and reached
terminal `partial_succeeded` at 12:16:16.228842 UTC. Reservation
`485cb40a-2b91-4cbe-bf3b-bc9d11d2f307` reserved 4,550,000 micros, captured 450,000 for the three
successful copy nodes, released 4,100,000, and has zero residual.

All three wave-2 masters used route `fal/flux-2-pro/masters`, model `fal-ai/flux-2-pro`, and outbox
event `205c8622-6742-4910-9e53-da07f288eabf`:

| Node       | Attempt                                | Provider request                       | Terminal update UTC | Result body                                                  |
| ---------- | -------------------------------------- | -------------------------------------- | ------------------- | ------------------------------------------------------------ |
| `master-2` | `43ab5c88-ae55-4dba-a0a0-286a2d0a5408` | `019ff0c0-47bb-7630-99ee-07783d7ec84a` | 12:16:14.337969     | HTTP 422, `content_policy_violation`, location `body.prompt` |
| `master-3` | `9de77eb0-353d-4e3a-940c-3b8302734476` | `019ff0c0-4853-7760-9d5c-64bac15826b8` | 12:16:14.158166     | HTTP 422, `content_policy_violation`, location `body.prompt` |
| `master-1` | `aeb86542-1889-40a7-84e8-b45e8d6da8f7` | `019ff0c0-48ec-7fc3-838f-a1c6ecb08046` | 12:16:16.228842     | HTTP 422, `content_policy_violation`, location `body.prompt` |

The normalized job rows retained route, outbox, billing-idempotency, reconciliation, and last
webhook keys but not the provider's result detail. The RCA therefore read each stored provider
request through fal's result endpoint rather than relying on submit status. All three returned the
same execution-time error above. No paid submission was made by this read.

## 6. GB-02 classification and fix

The pre-fix master prompt combined the product and packshot description with the supplement's
subscribe-and-save offer, sleep-adjacent audience/problem statement, visual rights constraints, and
brand direction. The three independent masters received the same material and failed identically.
By contrast, registered supplement brief `GB-12` completed on the same route/model during T5. That
control plus the explicit `body.prompt` result location rules out a route/pinning or general
provider-availability defect.

The classification is **prompt-material defect**. It is not transient because three independent
jobs returned the same non-retryable policy result; it is not an engine scheduling or money defect
because the run terminalized and settled exactly; and it is not a route defect because the same
route completed another registered supplement brief.

`imageContextParts` now treats supplement image and motion prompts as visual requests: product,
packshots/upstream image, supplied visual-rights constraints, brand direction, and node framing
remain; promotional offer and audience health context do not cross into the image provider. The
copy route continues to receive the full offer, audience, claims, prohibited-claims, legal, and
evidence context. Master and adaptation regression tests pin both sides. Against the pre-fix prompt
builder, both tests failed because the promotional offer remained in the provider prompt; they pass
with the narrowed image context.

This is a no-spend code fix, not proof that fal will accept the revised `GB-02` prompt. Only the
governed remediation run may establish that outcome.

## 7. Operator recommendation and gate implications

Authorize exactly two full-pack attempts on a fresh UTC day:

1. rerun `GB-02` once in a new disposable workspace to validate the narrowed supplement image
   prompt; and
2. run the first cap-deferred registered brief, `GB-16`, once in its own disposable workspace.

The maximum reservation and expected capture if both technically complete is **9,100,000 micros**:
4,550,000 per pack. Do not rerun `GB-05`; it would add no acceptance proof and would spend another
4,550,000 micros. If `GB-02` again returns a policy failure, stalls, strands money, or reaches
`reconciliation_required`, stop that run, preserve the provider result body and PostgREST money
state, exercise only the established recovery paths, and do not retry it blind.

If both recommended runs complete, the registered set reaches 16 of 20 while retaining the already
passing 101.641-second median and 122.314-second p90 samples. The representative completion/latency
criterion can then be reconsidered from the combined evidence. The zero-duplicate
submission/ledger criterion is **reclassified pass now**: `GB-05` did not violate the engine
idempotency scope, every in-run request and money key was unique, and all reservations reconcile to
zero residual.

## 8. Verification record

- The isolated PostgreSQL 17 lane passed all 27 files and 403 assertions, including all 7 bounded
  audit-RPC assertions.
- The pre-fix focused application run failed 4 tests: harness classification, checkpoint ordering,
  supplement master prompt, and supplement adaptation prompt. The fixed focused lane passed 34 of
  34 tests.
- The checkpoint-order mutation run failed 1 of 1 selected tests with `poll` observed before any
  checkpoint, proving the regression test detects the original lifecycle defect. The restored
  implementation passes.
- `corepack.cmd pnpm verify` passed on the tracked candidate: formatting, documentation and packet
  governance, 122 governance tests, cleanroom/security, task graph, lint, all workspace typechecks,
  unit and integration suites, and production/dry-run builds. The focused Core unit lane passed 181
  tests, including the new harness and provider-payload regressions.

## 9. Left open

- `GB-02` requires the one governed paid remediation attempt above; no provider acceptance claim is
  made from a local prompt test.
- The representative completion/latency criterion remains pending at 14 of 20 until two additional
  registered briefs technically complete.
- `GB-17` through `GB-20` remain cap-deferred, not failed.
- External provider invoice cost remains unobservable and must not be conflated with catalog capture
  micros.
