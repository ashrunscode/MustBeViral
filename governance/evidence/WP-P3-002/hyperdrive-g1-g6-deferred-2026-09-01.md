# Hyperdrive G1–G6 deferred — WP-P3-002 — 2026-09-01

Work packet: WP-P3-002  
Steps: `p3b-001-execute-or-keep-deferred`, `p3b-002-g1-g6-or-close`  
Branch: `codex/viralgraph-cleanroom`

## Decision

G1–G6 remains **not met** and **stays deferred for this packet**.  
The accepted Data API/RPC baseline stays the only user-scoped barrier transport.

This is an accepted outcome of step `p3b-001-execute-or-keep-deferred` and of
`docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md`: a missing, invalid, or
unrun evidence package keeps the baseline. That is the safe default, not a
failed release.

## Why the accepted seed did not run

Inspection:
`governance/evidence/WP-P3-002/staging-inspection-2026-09-01.md`

- Staging corpus is below every plan minimum (156 workspaces, 168 canvases,
  339 revisions).
- No schema-backed synthetic A/B fixture tag exists, so accepted rollback
  cannot isolate new rows from existing staging data.
- No accepted seed executor, 12-node/18-edge frozen graph bytes, or
  randomization key exists in repository authority.
- Operator go-ahead was "keep going" on this step. It did not authorize
  inventing fixtures, IDs, row shapes, a Hyperdrive user-path binding, a
  separate executor, BYOK, or P4 agency.

`governance/evidence/WP-P3-001/benchmarks/fixture-manifest.json` remains absent.

## What this packet did not do

- No Hyperdrive user-path binding on `mustbeviral-v2-staging-core`
- No G1–G6 matrix run (gates stay unchecked)
- No separate executor Worker
- No BYOK routing
- No P4 agency surfaces
- No remote destructive action
- No writes through a non-MustBeViral Supabase binding

## Rollback (unchanged)

1. Keep Data API/RPC.
2. Delete only synthetic A/B fixture rows if a later authorized seed creates
   them with an accepted tag. This packet created none.
3. Remove a Hyperdrive binding only after recording its binding ID. None was
   added.
4. Instant queue rollback remains `QUEUES_ENABLED=false` on
   `mustbeviral-v2-staging-core`.
