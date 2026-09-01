# Hyperdrive G1–G6 fixture-seed blocker — 2026-09-01

Work packet: WP-P3-001, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`

## Blocker

G1–G6 remains `not_met`. The accepted plan
(`docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md`) requires a synthetic staging
corpus (≥250 workspaces, 1,000 canvases, tenants A/B disjoint) and a committed
`fixture-manifest.json` before any candidate Hyperdrive path.

No accepted fixture-seed procedure exists in the runbook, packet, or evidence
tree. `governance/evidence/WP-P3-001/benchmarks/fixture-manifest.json` is absent.
Staging Hyperdrive binding is intentionally absent from `apps/core/wrangler.jsonc`.

This packet will not invent a seed procedure, fabricate fixtures, add a staging
Hyperdrive binding, or enable a user-scoped Hyperdrive path.

## Not this blocker

- Queues / live wake: deployed on `mustbeviral-v2-staging-core` with
  `QUEUES_ENABLED=true`. Instant rollback remains `QUEUES_ENABLED=false`.
- Separate executor and BYOK: still not authorized; not started.

## Operator decision required

Accept a written fixture-seed procedure that names the staging project
`mustbeviral-staging`, the synthetic tenants, row counts, and rollback, or
explicitly defer G1–G6 so this step can close without Hyperdrive user-path
enablement.
