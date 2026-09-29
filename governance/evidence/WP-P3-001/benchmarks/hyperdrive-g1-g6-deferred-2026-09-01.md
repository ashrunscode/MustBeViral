# Hyperdrive G1–G6 deferred — 2026-09-01

Work packet: WP-P3-001, steps `p3-002-scale-infrastructure` and `p3-003-phase-exit-handoff`  
Branch: `codex/viralgraph-cleanroom`

## Decision

G1–G6 remains **not met**. The candidate Hyperdrive user path is **explicitly deferred**.
The accepted Data API/RPC baseline stays the only user-scoped barrier transport.

This is the outcome required by `docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md` when the
evidence package is missing: staying on the baseline is the safe default, not a failed
release.

## Why execution did not run in this packet

- The written seed procedure now exists:
  `governance/evidence/WP-P3-001/benchmarks/hyperdrive-fixture-seed-procedure-2026-09-01.md`.
- No `fixture-manifest.json` is committed. Staging corpus is below the plan minimum.
- No staging Hyperdrive binding is present on `mustbeviral-v2-staging-core`.
- Operator instruction to finish this packet does not authorize inventing fixtures,
  adding a binding, or claiming G1–G6 pass without the matrix.

## What this packet did ship

- Queues: `mustbeviral-v2-staging-outbox-dispatch` bound to `mustbeviral-v2-staging-core`
  with `QUEUES_ENABLED=true`. Instant rollback is `QUEUES_ENABLED=false`.
- Postgres remains authority on the wake path.

## What stays out

- Separate executor Worker
- BYOK provider routing
- P4 agency surfaces
