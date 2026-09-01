# WP-P3-001 implementable acceptance — 2026-09-01

Branch: `codex/viralgraph-cleanroom`

## Queues (only gated addition that shipped)

- Trigger and measurements:
  `governance/evidence/WP-P3-001/backpressure/backpressure-fan-out-evidence.yaml`
- Observability:
  `governance/evidence/WP-P3-001/backpressure/observability-2026-08-31.md`
- Live wake:
  `governance/evidence/WP-P3-001/queues/live-wake-path-2026-09-01.md`
- Staging queue name: `mustbeviral-v2-staging-outbox-dispatch`
- Staging Worker: `mustbeviral-v2-staging-core`
- Instant rollback: set `QUEUES_ENABLED=false` and redeploy

Wake messages are `{ type: 'outbox.wake', event_id }` after `start_run_barrier` commit.
The public `StartRunResult` does not leak `event_id`.

## Postgres remains authority

- `governance/evidence/WP-P3-001/queues/postgres-remains-authority-2026-08-31.md`
- `apps/core/test/unit/outbox-queue.test.ts`
- `apps/core/test/unit/start-run-outbox-wake.test.ts`
- `packages/db/src/index.test.ts`
- `packages/contracts/src/responses.test.ts`

The queue path cannot mutate ledger, membership, or canvas head except through existing
revision and command barriers.

## Hyperdrive G1–G6 deferred

- Procedure accepted, execution deferred:
  `governance/evidence/WP-P3-001/benchmarks/hyperdrive-fixture-seed-procedure-2026-09-01.md`
- Decision:
  `governance/evidence/WP-P3-001/benchmarks/hyperdrive-g1-g6-deferred-2026-09-01.md`
- User-scoped barriers stay on Data API/RPC.

## Separate executor and BYOK

Not authorized. Isolation probes exist; operator acceptance and observability split do not.
No executor Worker and no BYOK routing were added.

## No agency expansion

- `governance/evidence/WP-P3-001/no-agency-expansion.yaml`

## Quality gates

- `corepack pnpm design:check`
- `corepack pnpm governance:check`
- `corepack pnpm agent:verify`

## Phase exit

P3 implementable work for this packet is complete. Do not start P4 agency work without DTC
retention evidence. Remaining optional gates (Hyperdrive matrix, executor, BYOK) belong to
successor `WP-P3-002`.
