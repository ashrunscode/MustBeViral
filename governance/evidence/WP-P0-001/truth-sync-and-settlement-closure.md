# Truth-sync and settlement closure is complete

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs  
Recorded 2026-08-11

## 1. Track F is recorded as attempted

The $0.67 rung was attempted on 2026-08-02. WashBodega August pack run
`143e6229-cd55-4e10-b98b-290916589ae6` settled 9 of 16 nodes, then stopped for forty minutes with
2,000,000 of its 4,550,000 reserved micros stranded. The pack runner printed `STATUS unknown` and
exited while the run was still advancing, so the stall had no unattended progress signal.

The engine cause was staggered readiness inside one dispatch wave. Each parent completion promoted
its own children, but the old `run:<id>:dispatch:<wave>` dedupe key accepted the first promotion
event and silently dropped later batches in that wave. Seven `ready` nodes with `created` attempts
were left with no pending dispatch event. Migration
`20260802020000_p0_dispatch_epoch_and_stranded_sweeper.sql` added a monotonic dispatch epoch and the
`arm_stranded_dispatch` category sweeper. Regression suite
`00023_p0_dispatch_epoch_staggered_promotion.test.sql` proves that separate same-wave promotion
batches each receive an event.

The sweeper later recovered the run. Its current staging record is `succeeded`, all 16 outcomes are
terminal, and the reservation has 4,550,000 captured micros with zero outstanding micros. That does
not retroactively make the interrupted attempt the T2 acceptance proof: it did not produce the
unattended progress, approval, export, and immutable customer-path receipt evidence required for the
rung. `PROJECT_STATE.yaml` now names the attempt, failure, shipped fix, and T2 rerun directly;
`docs/STATUS.md` is regenerated from that authority.

## 2. Poll reconciliation now has a guarded exit

`record_provider_job_reconciliation` could move an ambiguous provider job and its attempt back to a
terminal state but never reconsidered a run already parked at `reconciliation_required`. Forward
migration `20260811000000_p0_poll_reconciliation_run_exit.sql` keeps the transition in the same
transaction and adds one guarded run update:

- the run must still be `reconciliation_required`;
- at least one attempt must exist;
- every attempt must be `succeeded`, `failed`, or `canceled`; and
- the terminal result uses the established `succeeded`, `partial_succeeded`, `failed`, then
  `canceled` precedence.

Suite `00024_p0_poll_reconciliation_run_exit.test.sql` proves both sides: the run stays parked when a
sibling attempt is unresolved, then exits to the correct terminal state after the last attempt
settles. It also pins the machine-only `service_role` grant.

The full local PostgreSQL lane passed all 25 files and 384 assertions on PostgreSQL 17.6. The local
`md5(pg_get_functiondef)` fingerprint for
`public.record_provider_job_reconciliation(uuid,text,jsonb)` is
`b26ca31741c24f7d0341508db0e75ddf`. The forward migration was applied to staging through Supabase
MCP `apply_migration`; at 2026-08-11 06:11:16 UTC the staging PostgreSQL 17.6 definition had the same
fingerprint and `service_role` held execute. No migration-history repair, linked push, pull, or
reverted-status command was used; the known 18-row divergence was untouched.

The API-connection doctrine was checked separately. At 2026-08-11 06:07:33 UTC, a terminal no-op
replay through `POST /rest/v1/rpc/record_provider_job_reconciliation`, with the protected staging
API key and service-role authorization headers, returned HTTP 200 and the existing terminal
`succeeded` result. This proves the applied function remains reachable through PostgREST, where
`pg_safeupdate` is loaded, rather than only through an elevated SQL connection.

## 3. Refund remains operator-SQL-only for P0

`refund_run_capture` remains an operator-SQL-only recovery tool for P0. No Worker route or scheduled
caller was added.

This is deliberate, not an accidental zero-caller state. Section 6 of the orchestration plan leaves
the refund authorization policy to a human gate: an operator must decide who may refund and what
evidence authorizes it. Exposing a service-role Worker caller before that policy exists would create
an unattended money mutation with no accepted authorization contract. The existing function keeps
its explicit amount, causative key, actor, evidence, ledger, and reservation audit fields available
to an authorized database operator. A product or Worker path may be added only after the human
policy is accepted in a later governed task.

## 4. The pack runner reports real progress

`washbodega-pack-run.ts --start` now polls the authoritative `get_run` resource for status and the
receipt resource for artifact and money progress until a real terminal state. It writes changed
progress and a sixty-second heartbeat to stderr in this shape:

```text
PROGRESS status=running artifacts=3 captured_micros=450000 released_micros=0 elapsed_seconds=60 observed_at=<UTC>
```

Terminal states use the domain spellings `partial_succeeded` and `canceled`. The default explicit
deadline remains 45 minutes and `--timeout-minutes <positive number>` makes it operator-selectable;
timeout errors include the last real status, artifact count, captured micros, and released micros.
The persisted receipt redacts the access token and records the terminal status.

Unit coverage drives a healthy run through `queued`, `running`, and `succeeded`, proves artifact and
capture progress is reported, and rejects any return of `STATUS unknown`. A second test proves the
explicit timeout reports the last observed state.

## 5. Staging has no target-run residue and the sweeper is live

Staging residue was verified without provider spend.

- At 2026-08-11 06:13:28 UTC, an idempotent terminal replay through
  `POST /rest/v1/rpc/advance_fal_provider_attempt` returned HTTP 200, `run_status=succeeded`,
  `run_terminal=true`, 16 outcomes, and zero non-terminal outcomes for run `143e6229`. Its
  reservation returned `amount_micros=4550000`, `captured_micros=4550000`, and
  `released_micros=0`, so no reserved remainder exists. The replay used the already-recorded
  artifact and capture proof and made no provider call or new ledger movement.
- A management read at 2026-08-11 06:06:23 UTC independently found the target reservation
  `captured` with zero outstanding micros, its quote expired on 2026-08-02, and zero non-terminal
  runs anywhere in the staging project. Direct REST table reads are intentionally grant-denied to
  `service_role`; their failed 42501 response was discarded rather than misreported as an empty
  result. The authoritative target state above came from the service-role PostgREST RPC path.
- At 2026-08-11 06:07:06 UTC,
  `POST /rest/v1/rpc/arm_stranded_dispatch` returned HTTP 200 with `runs_examined=0` and
  `events_armed=0`. It ran only after the zero-non-terminal read, so the verification could not arm
  unrelated paid work.
- The scheduled composition calls `armStrandedDispatch(10)` immediately before
  `dispatchPending(10)`. A unit test pins the complete scheduled call order. The same source was
  deployed to staging Worker version `4ec9b483-3b42-411c-9c7e-bb5c446f47b2`, created
  2026-08-11 06:10:30 UTC; Cloudflare reports the `scheduled` handler, and the staging binding keeps
  the every-minute cron trigger. This proves the sweeper is in the live cron bundle, not merely in
  the staging database.

No production or legacy-v1 resource was read for mutation or changed. No secret value was printed,
stored, or recorded.

## 6. Verification

- `corepack.cmd pnpm agent:preflight` — pass.
- `corepack.cmd pnpm --filter @mustbeviral/core test` — pass, 21 files and 170 tests.
- `corepack.cmd pnpm --filter @mustbeviral/core typecheck` — pass.
- `corepack.cmd pnpm supabase:test` — pass, 25 files and 384 assertions after resetting only the
  isolated `mustbeviral` local PostgreSQL 17 stack from the checked-in migration chain.
- `corepack.cmd pnpm verify` under Node 24.18.0 on the exact prospective commit snapshot — pass;
  formatting, governance, security, task graph, lint, typecheck, unit tests, integration tests, and
  builds all passed. The snapshot excluded only the explicitly untouched untracked operator tool.
- Prettier on this evidence document — pass.

## 7. Left open

- T2 must rerun the $0.67 full pack with the repaired engine and runner, then prove all 16 nodes,
  exact capture with zero residual, approval, export, and immutable customer-path receipt in one
  uninterrupted acceptance record.
- The human refund-authorization policy remains an operator gate. Until accepted,
  `refund_run_capture` stays operator-SQL-only.
- The known 18-row staging migration-history divergence remains an operator decision and is
  unchanged.
- The untracked `apps/core/tools/approve-export-august-pack.ts` remains untouched for operator
  disposition.
