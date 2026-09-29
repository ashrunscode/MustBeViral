# Postgres remains authority — WP-P3-002 — 2026-09-01

Work packet: WP-P3-002, acceptance `postgres-remains-authority`  
Branch: `codex/viralgraph-cleanroom`

## Proof

This packet added no Hyperdrive user path and no separate executor. User-scoped
barriers stay on Supabase Data API/RPC. Tests still prove Hyperdrive is not an
allowed user authority and cannot become a second ledger, membership, or
canvas-head store:

1. `packages/db/src/index.test.ts` — `isAllowedUserDatabasePath('hyperdrive')`
   is false; only `supabase-data-api-rpc` is allowed.
2. `apps/core/test/unit/p3-scale-evidence-harness.test.ts` — staging
   `wrangler.jsonc` has no Hyperdrive binding; the candidate harness path
   throws `GATE_BLOCKED`.
3. Existing queue-wake proofs from WP-P3-001 remain: wake messages are
   `{ type: 'outbox.wake', event_id }` only and cannot carry ledger,
   reservation, wallet, revision, canvas-head, or membership keys.

Postgres remains the authority for permissions, immutable revisions, runs, and
money. Optional P3 scale transports stay gated.
