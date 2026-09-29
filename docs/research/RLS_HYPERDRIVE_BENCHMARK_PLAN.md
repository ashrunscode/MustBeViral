---
doc_id: rls-hyperdrive-benchmark-plan
---

# RLS and Hyperdrive benchmark plan

## Purpose and decision framing

This plan is the executable specification for the D0 evidence gate that compares the current Cloudflare Core Worker to Supabase Data API/RPC path with a Hyperdrive-pooled Worker to Postgres candidate. Supabase Postgres remains the authority for permissions, immutable revisions, runs, money, and artifact metadata on both paths. Hyperdrive is only a candidate transport for user-scoped barrier work; it does not move authority to Cloudflare, introduce a cache as truth, or authorize broader direct-SQL access.

Run this plan against representative staging data before P0 enables the candidate. A passing evidence package authorizes an architecture decision to enable the candidate only for the measured user-scoped barrier scope. A missing, invalid, or failing result keeps the accepted Data API/RPC baseline. Staying on that baseline is the safe default, not a failed release outcome.

The candidate is eligible only when every accepted gate condition below is proven. These conditions preserve the wording and order of [Data, authentication, and tenancy](../architecture/DATA_AUTH_AND_TENANCY.md#data-access-paths):

- [ ] **G1.** The login role is not an owner, superuser, service role, or `BYPASSRLS` role.
- [ ] **G2.** Transaction-local claims and role are set only after authentication and are cleared after commit, rollback, timeout, and error.
- [ ] **G3.** Reused pooled connections cannot observe the prior user/workspace identity.
- [ ] **G4.** Barrier functions recheck membership, expected revision, quote, and spend caps inside the transaction.
- [ ] **G5.** The path is at least 20% faster than the Data API/RPC baseline on the same workload.
- [ ] **G6.** Warm/cold p95 is ≤250 ms and p99 ≤500 ms under representative concurrency and conflict rates.

The benchmark owner must copy these checkboxes into the run summary and replace each unchecked box only with a link to the supporting artifact. Narrative judgment without raw evidence cannot satisfy a condition.

## Fixture and workload rules

Use one synthetic staging corpus with at least 250 workspaces, 1,000 canvases, 10 revisions per canvas, 12 nodes per current graph, 24 artifacts per completed run, and 100 ledger transactions per workspace. At least two authenticated synthetic tenants, A and B, must have disjoint workspaces and graph, artifact, and ledger records. No production or customer data is permitted.

Before execution, commit `fixture-manifest.json` with exact encoded request and response byte counts, row counts, graph hashes, revision IDs, expected balances, and the seeded randomization key. The sizes below are targets; a run is comparable only when both paths use the same frozen fixtures and each encoded size is within 5% of the recorded manifest. Both paths must invoke the same shared command/query semantics. The baseline uses the original validated JWT through Data API or a hardened RPC; the candidate uses equivalent parameterized SQL or the same barrier function through Hyperdrive after Worker authentication.

| ID  | Launch-pack operation                       | Representative SQL/RPC shape                                                                                                                                                                                                                                                    | Frozen payload target                                                 | Expected rows/result                                                                                                            |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Graph-revision read plus lineage            | Select the workspace-scoped canvas head and immutable `canvas_revisions` snapshot, then fetch workspace-scoped artifact and `artifact_lineage` metadata for the pinned revision. No N+1 calls; record whether the implementation uses one RPC or a fixed two-query transaction. | 0.5 KiB request; 48 KiB graph JSONB; 12 KiB lineage/metadata response | 1 canvas, 1 revision containing 12 nodes and 18 edges, 12 artifacts, and 24 lineage edges                                       |
| W2  | Revision write plus descendant invalidation | One short transaction locks/checks `canvases.head_revision_id` against `expected_revision_id`, inserts one immutable child revision, records the deterministic affected-descendant set in the new snapshot/command result, and advances the head only on success.               | 52 KiB request including a 48 KiB graph snapshot; 2 KiB response      | 1 revision inserted, 1 canvas head updated, and 4 affected descendant node IDs returned; stale writers change 0 rows            |
| W3  | Quote-computation read set                  | Read membership, pinned revision/hash, the routes and price-catalog version required by all 12 nodes, current cost reservations, immutable ledger balance, and workspace/global spend-cap inputs in one hardened RPC or one read-only transaction.                              | 1 KiB request; 10 KiB response                                        | 1 membership, 1 revision, 12 node route selections, 5 model routes/prices, 3 cap aggregates, and 1 balance                      |
| W4  | Ledger append plus balance read             | One transaction validates membership and idempotency, appends immutable balanced `ledger_transactions` entries in integer USD micros, then returns the resulting workspace balance. Never update or delete an existing ledger entry.                                            | 1 KiB request; 2 KiB response                                         | 2 balanced entries appended for a new key and 1 balance returned; a repeated key adds 0 entries and returns the original result |
| W5  | Artifact-metadata list                      | Select workspace-scoped `artifacts` and their lineage summary for one run, ordered by creation time and ID with a fixed limit. Return metadata only; do not sign or fetch R2 bytes.                                                                                             | 0.5 KiB request; 32 KiB response                                      | 24 artifact rows and their summarized lineage counts; 0 media-byte reads                                                        |

Parameter values must be bound, not interpolated. Each operation carries an opaque request ID, authenticated actor, workspace ID, and any required expected revision, quote, or idempotency value. Raw JWTs, secrets, signed URLs, customer media, and database credentials must never enter benchmark output.

## Benchmark matrix

Execute every workload across the full Cartesian matrix below. A matrix cell is identified by workload, path, thermal state, concurrency tier, load-generator region, observed Worker colo, and actual Supabase region.

| Dimension        | Required values                                                                                                                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data path        | `baseline_data_api_rpc`; `candidate_hyperdrive_pooled`                                                                                                                                                                                                                      |
| Thermal state    | `cold`; `warm`                                                                                                                                                                                                                                                              |
| Virtual users    | `1`, `10`, `50`, `200` concurrent VUs with closed-loop pacing and identical think time on both paths                                                                                                                                                                        |
| Load region      | US-East primary and US-West distance-sensitivity generators                                                                                                                                                                                                                 |
| Worker/DB region | Record `request.cf.colo` for every Worker request and the configured Supabase region once per run. The accepted deployment assumption is Supabase `us-east-1` (US-East); the summary must report actual values and must not relabel an observed colo as the assumed region. |

Fifty VUs from the US-East generator is the predeclared representative-concurrency decision slice. The 1- and 10-VU tiers expose fixed overhead; 200 VUs is the saturation tier. All tiers remain correctness and isolation gates. The latency thresholds in G6 apply to every W2 cell at 50 VUs and to the aggregate launch-pack mix at 50 VUs. Results at 200 VUs determine safe capacity and must be reported, but cannot silently redefine the representative tier after results are known.

Use the launch-pack mix `W1 30% / W2 15% / W3 20% / W4 15% / W5 20%` for aggregate cells, while also running each workload independently. Keep the arrival mix, fixture distribution, timeouts, and retry configuration identical between paths.

### Cold and warm definitions

- A **cold** run starts on a fresh benchmark Worker revision and dedicated benchmark binding or on an instrumented route proven idle for at least 10 minutes. The 30-second load-generator ramp targets a no-op endpoint and must not touch the database paths or target fixtures. The measured window begins with the first database-path call, uses a shuffled fixture set not read during the run, and records first-call latency separately. If the harness cannot prove the route and fixture state, label the run invalid rather than warm.
- A **warm** run preloads the fixed hot fixture set and exercises the target path during the 30-second ramp. The measured window then reuses that set and the normal path-level connection behavior. Do not add an application cache that production does not have.

The benchmark report must state how a fresh/idle candidate route was established and how it was verified. Hyperdrive may pool internally; the harness must not claim a new physical Postgres connection unless `pg_backend_pid()` evidence proves it.

## Metrics and method

### Run protocol

1. Deploy one benchmark build containing both paths behind staging-only route selection. Use the same Worker code, commands, fixtures, timeout, and response serialization for both paths.
2. Freeze the database state or restore the same seeded snapshot before each write-bearing run. Validate row counts, graph hashes, head revision, and ledger balance before timing begins.
3. Randomize the order of baseline/candidate and cold/warm cells using the committed seed so time-of-day and database drift do not consistently favor one path.
4. For every matrix cell, execute **3 independent runs of 5 measured minutes**. Run a 30-second ramp first and discard all ramp telemetry. The no-op ramp rule for cold cells and path-preload rule for warm cells are mandatory.
5. Require at least 1,000 measured observations per run per cell. If a one-VU write cell cannot reach 1,000 without changing its semantics, record the achieved count and extend the measured duration until 1,000 is reached; do not raise concurrency.
6. Enforce a 5,000 ms Worker-side call deadline. A timed-out operation remains in the denominator and must be reconciled before the fixture is reused.
7. After every run, execute invariant queries for tenant isolation, revision/head consistency, idempotency cardinality, ledger balance, and immutable-row preservation. A failed invariant invalidates performance statistics and fails the relevant security/correctness gate.

### Measurement points and calculations

The authoritative latency clock is the monotonic Worker runtime clock. Capture `start_ms = performance.now()` immediately before the Worker invokes the Data API/RPC request or Hyperdrive SQL transaction, and `end_ms = performance.now()` immediately after the complete response has been received and decoded or the error has been classified. `elapsed_ms = end_ms - start_ms` therefore includes Worker-to-data-path network time, pool acquisition, database execution, response transfer, and decode, but excludes JWT verification, request parsing, response encoding, and load-generator network time.

Record load-generator end-to-end latency separately for diagnosis; it is not used for G5 or G6. Compute p50, p95, and p99 from all measured Worker-side observations in each run, using nearest-rank percentiles, then report the median of the three run-level percentiles as the cell result. Also report each individual run, observation count, success count, expected-conflict/denial count, unexpected-error count, and error rate.

`unexpected_error_rate = unexpected_error_count / measured_observation_count`. Expected `REVISION_CONFLICT`, idempotency conflict, and cross-tenant RLS denial outcomes count as successful semantic outcomes only in their named scenario; the same response in a normal workload is an unexpected error. For gating cells the unexpected error rate must be ≤1%, while correctness, tenant leakage, duplicate money/revision writes, and role violations have a zero-tolerance threshold.

For matched cells, compute:

`speedup_percent = ((baseline_p95_ms - candidate_p95_ms) / baseline_p95_ms) * 100`

Do not compare nonmatching colos, fixture sets, observation counts below the validity minimum, or different conflict rates. Report confidence intervals or bootstrap distributions as supplementary evidence, but do not replace the accepted percentile thresholds.

### Evidence layout

The P0 benchmark run creates, validates, and commits this layout under `governance/evidence/WP-D0-002/benchmarks/`:

```text
benchmarks/
  README.md
  fixture-manifest.json
  run-manifest.json
  raw/
    <path>__<thermal>__<workload>__vu-<count>__<load-region>__run-<1-3>.csv
  summary/
    matrix.csv
    decision-table.md
    errors.csv
    conflicts.csv
  identity/
    role-verification.txt
    reset-cases.csv
    reuse-transitions.csv
  invariants/
    post-run-checks.csv
```

`run-manifest.json` records commit, staging deployment identifier, UTC start/end, tool versions, randomized cell order, timeout/retry settings, Supabase region, load-generator regions, observed Worker colos, fixture hash, and sanitized binding/role labels. Raw CSV columns are: `run_id`, `sample_id`, `utc_time`, `path`, `thermal_state`, `workload`, `vu_tier`, `load_region`, `cf_colo`, `db_region`, `elapsed_ms`, `outcome`, `error_class`, `http_status`, `sqlstate`, `expected_outcome`, `conflict_case`, and a salted per-run `backend_pid_hash` when available. Never record raw tenant/user IDs, claims, tokens, connection strings, or backend PIDs.

## Conflict scenarios

Run each scenario on both paths at 10, 50, and 200 VUs after the normal workload cells. Use the same starting snapshot and deterministic schedule.

| Scenario                              | Injection and expected outcome                                                                                                                                                                                                                   | Gate-failing violation                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-graph concurrent revision writes | Release 2, 10, and 50 writers against one graph with the same `expected_revision_id`. Exactly one write commits; every loser returns `REVISION_CONFLICT`, creates no revision, and may replay intent only against the new head as a new command. | More than one child accepted from the same expected head, a best-effort merge, an orphan revision from a loser, a partial descendant invalidation, or any non-conflict overwrite. |
| Duplicate idempotency-key submission  | Submit the same W2 and W4 request concurrently with one key. Same-input reuse returns the original result and IDs with one durable effect; different-input reuse returns conflict and changes no rows.                                           | Duplicate revision, ledger, reservation, or outbox effect; different results for same input; or acceptance of a key reused with different input.                                  |
| Ledger append contention              | Submit unique and deliberately duplicated W4 keys to one workspace. Unique valid commands append exactly one balanced pair each; duplicate keys replay; the final integer-micros balance equals the seeded balance plus accepted entries.        | Lost update, duplicate money movement, mutable prior entry, unbalanced append, stale returned balance, negative/cap-breaching acceptance, or unreconciled timeout ambiguity.      |

Expected conflicts remain in the latency distribution for their scenario and are reported separately from unexpected errors. No client or Worker retry may transform a stale revision into a successful best-effort write.

## Error taxonomy and retry policy

| Class               | Classification rule                                                                                                                                                                           | Retry behavior under test                                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeout`           | Worker-side 5,000 ms deadline expires before a definitive result. Preserve any later database outcome as reconciliation evidence.                                                             | No retry in latency cells. A separate same-key reconciliation probe may retry once; write retry must return the original result or conflict without duplicating effects.   |
| `pool_exhaustion`   | Candidate cannot acquire a pooled connection before the deadline or returns a pool-capacity signal. Never classify authentication, database locks, or generic timeouts here without evidence. | No immediate retry in measured cells. Record acquisition latency/capacity signal; one jittered diagnostic retry is allowed outside percentile data.                        |
| `auth_failure`      | JWT validation fails, authenticated actor/role setup fails, membership is missing for an allowed fixture, or the database rejects expected credentials.                                       | Never retry automatically. An unexpected auth failure counts against error rate; a malformed-token negative probe must fail closed.                                        |
| `rls_denial`        | Database policy returns no row or denies mutation. This is expected only for labeled cross-tenant probes and is otherwise an error.                                                           | Never retry with elevated credentials. Expected denial passes isolation; any returned tenant-A row or successful tenant-A mutation by tenant B immediately fails the gate. |
| `transient_network` | Connection reset, temporary DNS/TLS/connectivity failure, or transport 502/503/504 with no more specific server classification.                                                               | No retry in latency cells. A separate read probe may retry once with bounded jitter; writes retry once only with the identical idempotency key after reconciliation.       |

Also preserve database SQLSTATE and HTTP status when present. Constraint conflict, business conflict, and expected RLS denial are semantic outcomes, not transient network errors. Unknown errors stay `unclassified`, count as unexpected, and block a gate decision until classified; do not force them into a more favorable bucket.

## Pooled-identity isolation tests

These tests apply to the Hyperdrive candidate and are required even when latency results are favorable.

### Dedicated least-privilege role

Staging and production Hyperdrive bindings must use a dedicated login role created for the measured application scope. The role must not own any application schema/table/function, inherit an owner or service role, be a superuser, or have `BYPASSRLS`. Record sanitized results for the connected session and fail before load testing if any check is positive.

Run this required verification SQL through the candidate binding:

```sql
SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

Also record `current_user`, `session_user`, `rolsuper`, `rolinherit`, memberships, and owned objects using read-only catalog queries. The result above must be exactly one row with `rolbypassrls = false`; `rolsuper` must also be false and owned-object count must be zero.

Known local-config landmine: the local Hyperdrive binding normalizes the `postgres` superuser. Local success therefore cannot prove G1 and must not be promoted as staging/production evidence. Staging and production bindings must name and use the dedicated least-privilege role, and the verification SQL must be rerun through each actual binding before enablement.

### Transaction-local context and reset cases

After the Worker has authenticated the JWT, every candidate operation must begin a database transaction, set the implementation's authenticated role and claims with transaction-local scope, perform the operation, and commit or roll back. The P0 harness must record the exact non-secret context keys and role transition in `run-manifest.json`. It must never log claim values.

For each termination path below, immediately reacquire a pooled session and probe the role and every request-scoped setting with `current_setting(<key>, true)`. Before the next request sets its own context, each setting must be null/empty as designed and the role must be the dedicated login role:

1. successful commit;
2. explicit application rollback;
3. statement error caught by the Worker;
4. Worker-side timeout/cancellation;
5. database-side timeout;
6. abrupt client disconnect.

Any residual actor, workspace, JWT claim, elevated role, transaction, prepared state carrying identity, or session variable fails G2 and G3. Cleanup code executed only on the happy path is insufficient evidence; transaction-local behavior and post-error reuse must both be observed.

### Same-connection cross-tenant reuse

Seed tenant A and tenant B with distinguishable opaque canary rows. Drive an authenticated tenant-A W1/W5 read and W2 mutation, then an authenticated tenant-B request through the pool. Use `pg_backend_pid()` only inside the test harness, hash it per run, and repeat until at least 100 A-to-B transitions are observed on the same physical backend at each of 1, 10, 50, and 200 VUs. If the pool cannot yield 100 proven same-backend transitions, the evidence is insufficient and the gate remains closed.

On each B request before context setup, the reset probe must observe no A context. After B context setup, direct reads of A's canvas, revision, artifact, and ledger canaries must return no rows; attempted A mutation must be denied and change zero rows; B's own control read must succeed. Repeat the sequence after each reset case above and in the reverse B-to-A order. Any A data returned to B, B data returned to A, cross-tenant mutation, prior identity observed, or elevated fallback role is a zero-tolerance G3 failure.

## Pass/fail rubric

The decision owner completes `summary/decision-table.md` with this mapping. Every cited artifact must share the same fixture and run-manifest hashes as the performance evidence.

| Gate | Required measured artifact                                                                                                       | Pass rule                                                                                                                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1   | `identity/role-verification.txt`, sanitized binding labels in `run-manifest.json`, and the required `rolbypassrls` query result  | Dedicated staging/production login is not owner, service role, superuser, or `BYPASSRLS`; it inherits no such role and owns no application object.                                                                                                           |
| G2   | `identity/reset-cases.csv` covering commit, rollback, statement error, both timeout paths, and disconnect                        | Every post-termination checkout has the dedicated login role and no prior request claims/settings; zero residual-context observations.                                                                                                                       |
| G3   | `identity/reuse-transitions.csv` plus cross-tenant canary invariant rows                                                         | At least 100 proven same-backend A-to-B and B-to-A transitions per concurrency tier, all unauthorized reads empty and mutations denied, with zero identity or data leakage.                                                                                  |
| G4   | W2/W3/W4 raw CSV, `summary/conflicts.csv`, and `invariants/post-run-checks.csv`                                                  | Membership, expected revision, quote, and spend caps are rechecked inside the transaction; conflicts and idempotency behave exactly as specified; no partial or duplicate durable effect.                                                                    |
| G5   | Matched baseline/candidate rows in `summary/matrix.csv` with the formula inputs retained                                         | Candidate p95 is at least 20% lower than baseline p95 for every matched W2 representative-concurrency cell and the aggregate launch-pack mix in both thermal states from the US-East generator; no comparison is made across different observed colo groups. |
| G6   | All run-level and median p50/p95/p99 values, error rates, conflict rates, `cf_colo`, and database region in `summary/matrix.csv` | In every W2 and aggregate 50-VU US-East cell, both cold and warm candidate p95 are ≤250 ms and p99 ≤500 ms; unexpected error rate is ≤1%; all concurrency tiers have zero correctness or isolation violations.                                               |

The evidence package passes only when G1 through G6 all pass. Any single failed condition, invalid cell, missing raw run, insufficient same-backend reuse sample, unresolved `unclassified` error, or mismatched fixture keeps user-scoped barriers on Data API/RPC. A later benchmark may re-evaluate the candidate from a new immutable evidence package; do not edit a failed package to make it pass.

Even after all six conditions pass, enablement remains limited to the measured barrier path and requires the accepted architecture/delivery decision and normal deployment rollback evidence. Read paths, background operations, or broader direct SQL require their own explicit scope. Hyperdrive background use, if later accepted, must use a separate narrowly privileged machine role and cannot become authority for money, permissions, or revisions.
