# The $0.67 WashBodega full-pack rung is complete

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-11

## 1. One staging run completed the rung

The repaired engine completed one fresh staging run from the registered WashBodega August brief.
There was no second attempt, cap change, provider retry outside the engine, production mutation, or
legacy-v1 touch.

| Field                     | Value                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Brief                     | `governance/evidence/WP-P0-001/launch-pack-runs/washbodega-pack/august-2026-brief.md`, section `WB-AUG-2026` |
| Staging workspace         | `c11192cc-0cd9-4637-8e60-fda10dfae6b1`                                                                       |
| Quote                     | `d4a93d4a-a23b-4334-bea3-70c463b220e1`                                                                       |
| Run                       | `8e724e99-1921-4096-ada8-71f93fe3a54f`                                                                       |
| Reservation               | `69cc44ab-d340-4b98-a415-358269306510`                                                                       |
| Wallet credit transaction | `a339ed21-2b63-47a3-8163-46d96ccaa6b2`                                                                       |
| Terminal status           | `succeeded`                                                                                                  |
| Provider outcomes         | 16 succeeded, 0 non-terminal                                                                                 |

`washbodega-pack-run.ts --prepare` began at 2026-08-11 07:05:31.414 UTC. The disposable staging
identity was confirmed through the service-role Auth API at 07:06:41.176 UTC, after which prepare
created the workspace, canvas and quote without reserving or spending money. The wallet was credited
exactly 4,550,000 micros through `POST /rest/v1/rpc/record_ledger_movement` at 07:07:55.290 UTC. The
request used `apikey` plus a service-role bearer credential and the server-operator user agent;
evidence records no credential value.

The two-phase start command began at 07:08:10.388 UTC and the run row was created at
07:08:13.771 UTC. The first available image artifact was registered at 07:10:22.146 UTC, so
time-to-first-reviewable-static was **128.375 seconds (2 minutes 8.375 seconds)**. The database made
the run terminal at 07:11:21.570 UTC, 187.799 seconds after run creation. The authoritative runner
observed `succeeded` at 07:11:25.335 UTC after 192 seconds and exited cleanly at 07:11:26.104 UTC.

## 2. All staggered promotion batches dispatched

The 16 priced nodes finished in three graph waves:

| Dispatch wave |                            Outputs | Terminal result |
| ------------- | ---------------------------------: | --------------- |
| 1             |                        3 copy sets | 3 succeeded     |
| 2             |                   3 master statics | 3 succeeded     |
| 3             | 9 adaptations plus 1 motion branch | 10 succeeded    |

The run finished with `dispatch_wave=3` and `dispatch_epoch=6`. The six epochs are the expected
evidence that separate parent completions in the same wave each armed their own dispatch event:
three copy completions promoted their respective masters, then three master completions promoted
their downstream adaptation batches, including the motion branch after its parents were ready. No
later batch was collapsed onto an earlier wave-only dedupe key. The runner observed artifact and
capture progress at 0, 53, 64, 106, 128, 139, 160, 171 and 192 seconds rather than exiting at
`STATUS unknown`.

## 3. Money settled exactly to the micro

Transactional caps remained authoritative and unchanged. The quote, wallet credit and reservation
were all exactly 4,550,000 micros. A service-role PostgREST terminal replay at
2026-08-11 07:13:58.769 UTC returned `run_status=succeeded`, `run_terminal=true`, 16 outcomes, zero
non-terminal outcomes and the following reservation truth:

| Money field                                 |    Micros |
| ------------------------------------------- | --------: |
| Quoted                                      | 4,550,000 |
| Wallet credited                             | 4,550,000 |
| Reserved                                    | 4,550,000 |
| Captured                                    | 4,550,000 |
| Released                                    |         0 |
| Refunded                                    |         0 |
| Residual (`reserved - captured - released`) |         0 |

The capture ledger contains 16 `usage_expense` credit rows in 16 capture transactions. Their
artifact links cover every approved provider output exactly once and their sum is 4,550,000 micros:

| Route                   | Attempts | Captured micros |
| ----------------------- | -------: | --------------: |
| OpenRouter copy         |        3 |         450,000 |
| fal FLUX.2 masters      |        3 |       1,500,000 |
| fal Kontext adaptations |        9 |       1,800,000 |
| fal Seedance motion     |        1 |         800,000 |
| **Total**               |   **16** |   **4,550,000** |

The rung's `$0.67` name is the expected external provider-spend scale. The authoritative customer
charge and reservation are the catalog total above; no provider invoice estimate was substituted
for ledger truth.

## 4. Approval replay and deterministic export passed

The completed run was driven through the real staging Worker REST surface with the disposable
customer bearer token and explicit idempotency keys:

- `POST /v1/runs/8e724e99-1921-4096-ada8-71f93fe3a54f/approvals` returned HTTP 200 with
  `approved=16`; all three JSON, twelve image and one video provider outputs were promoted in place
  to available `approved_output` artifacts.
- A second approval request returned HTTP 200 with `replayed=16`. No artifact was duplicated and the
  accessibility descriptions were not overwritten.
- The first `POST /v1/runs/8e724e99-1921-4096-ada8-71f93fe3a54f/exports` returned HTTP 201.
- Re-exporting the same 16 members returned HTTP 201 with the identical SHA-256 content hash
  `112ea57ec7c461f767591b37ea75e0620d1592a26a388b149bc92ab0232a4b26`.

The registered export artifact is `79405985-9e83-4ddf-9d16-2b394d1dc10c`, 18,828,546 bytes,
available and private. Matching content hashes prove the two ZIP payloads were byte-identical.

## 5. The customer receipt matches provider, model, cost and lineage truth

`GET /v1/runs/8e724e99-1921-4096-ada8-71f93fe3a54f/receipt` returned HTTP 200 through the same
customer path a product client uses. The final response contains a succeeded run, the captured
reservation, 16 available approved outputs, one available export, 16 capture transactions totaling
4,550,000 micros and 30 lineage rows. Fourteen rows preserve provider-input lineage and the export
adds exactly 16 `export_member` relationships.

The Worker's exact immutable export-receipt source, `POST /rest/v1/rpc/get_export_context`, was then
called through PostgREST with `apikey` and service-role headers at 07:16:14.260 UTC. It returned the
same 16 approved artifacts, 14 pre-export lineage rows, zero reservation residual and 16 terminal
provider jobs. Its provider/model/capture facts reconcile exactly to the customer ledger:

| Provider   | Model                                                  | Attempts | Capture micros |
| ---------- | ------------------------------------------------------ | -------: | -------------: |
| OpenRouter | `qwen/qwen3-30b-a3b-instruct-2507`                     |        3 |        450,000 |
| fal        | `fal-ai/flux-2-pro`                                    |        3 |      1,500,000 |
| fal        | `fal-ai/flux-pro/kontext`                              |        9 |      1,800,000 |
| fal        | `fal-ai/bytedance/seedance/v1/pro/fast/image-to-video` |        1 |        800,000 |

The 16 capture-ledger `metadata.artifact_id` values equal the 16 approved artifact IDs, so the
provider/model rows, artifact lineage and charged micros form one complete immutable receipt rather
than independent counts that merely happen to total the same amount.

## 6. Verification and boundaries

- The T1 polling fix stayed attached until a real terminal state and persisted a receipt with its
  access token redacted.
- Money truth was checked twice through privileged PostgREST: an idempotent terminal replay of
  `advance_fal_provider_attempt` and the export's `get_export_context` RPC. This exercises the API
  connection where `pg_safeupdate` loads rather than relying only on direct SQL.
- A read-only management query supplied run-node wave counts, exact timestamps and provider/model
  aggregation; it was not used in place of the PostgREST money proof.
- Approval, replay, export, re-export and receipt were all exercised through the real staging Worker
  REST surface. No signed URL, object key, credential, customer media or raw provider payload is
  recorded here.
- No migration was applied, the 18-row migration-history divergence was untouched, and no
  production, legacy-v1 or remote destructive action occurred.

## 7. Left open

- T3 now owns response schemas, sign-in and the typed client; the fixture-backed web product still
  cannot present this completed run to a customer.
- The visual and claim quality of these 16 outputs is not an automated T2 acceptance claim. It is
  evaluated with the registered rubric during the 20-brief and evaluator gates.
- Exact external provider invoice reconciliation and landed cost per usable pack remain T5/T7
  evidence. This document reports the authoritative 4,550,000-micro catalog capture without
  relabeling it as provider cost.
- The operator-owned untracked `apps/core/tools/approve-export-august-pack.ts` remains untouched.
