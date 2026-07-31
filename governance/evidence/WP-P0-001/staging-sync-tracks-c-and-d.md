# Staging sync for Tracks C and D, and how the transfer was proven exact

Work packet: `WP-P0-001`, step `p0-005-golden-launch-pack-runs`. Recorded 2026-07-30.

## 1. Why this needed a method rather than just an apply

Tracks C and D added roughly 1,800 lines of money-path SQL across three migrations, including full
regenerated bodies of `create_quote` (329 lines) and `start_run_barrier` (342 lines) — the single
authority on caps, idempotency, revision conflict, and reservation creation.

Three ways to move that to staging were considered and two were rejected:

| Path                                               | Rejected because                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase db push --linked`                        | Refused: the remote history holds **18 entries with no local counterpart**, created by earlier MCP applies under auto-generated names. Both suggested repairs (`--status reverted` on the remote-only set, or `db pull`) would have rewritten the migration record to match a story that is not what happened. |
| Direct `psql`                                      | `supabase/.temp/pooler-url` carries no password, and no Supabase access token exists locally — the MCP server is a hosted connector, so its credential is not on disk.                                                                                                                                         |
| **MCP `apply_migration`, verified by fingerprint** | **Chosen.** The only risk it carries is transcription, and that risk is fully testable.                                                                                                                                                                                                                        |

## 2. The verification that makes transcription risk moot

`pg_get_functiondef` returns a function's body **verbatim**, not a normalised or re-parsed form. So
`md5(pg_get_functiondef(oid))` computed on staging and on a local Postgres 17 container with the
migration files applied is a byte-exact comparison of the definitions — it catches a changed comment,
a lost line, a transposed character, not merely a semantic difference.

Expected fingerprints were taken from the local container **before** any staging write, then compared
after. All nine objects match:

| Object                                  | Fingerprint                        | Result |
| --------------------------------------- | ---------------------------------- | ------ |
| `app_private.advance_run_readiness`     | `f0a5d84609f9913de2018ef017bb2cb2` | match  |
| `app_private.settle_attempt_transition` | `23dac8e9c52ebcfc818e38257b580128` | match  |
| `public.advance_copy_provider_attempt`  | `d47a33e827b2af37a1f446e345fa3808` | match  |
| `public.advance_fal_provider_attempt`   | `60a12b349fa0b19e9637f99e5e1d3d19` | match  |
| `public.create_quote`                   | `0c8f4293b76897139afee921390c736f` | match  |
| `public.get_fal_artifact_context`       | `23621367c0d6caf5539665449af496d7` | match  |
| `public.get_outbox_dispatch_attempts`   | `f3f1f1a3649318647d4fc224c46f1602` | match  |
| `public.get_provider_artifact_context`  | `b33a5b657024c0182ba76d33ee112dbf` | match  |
| `public.start_run_barrier`              | `803ef57dab1938d45c2c833cdf3fec73` | match  |

**Superseded intermediates were deliberately not replayed.** Track C's `get_outbox_dispatch_attempts`
is replaced by Track C's follow-up, and Track C's `advance_fal_provider_attempt` is replaced by
Track D's. Applying only the final state of each object reduces the transcribed surface by roughly
500 lines, and the fingerprints prove the end state is right regardless of the route taken to it.

## 3. Schema

`runs.dispatch_wave`, `run_nodes.dispatch_wave` and `run_nodes_run_wave_status_idx` all present.
`model_routes.provider_model_id` for the adaptation route reads `fal-ai/flux-pro/kontext`, confirming
the earlier repoint survived.

## 4. Behavioural proof, not just a definition match

A matching definition proves the transfer; it does not prove the behaviour. So the real 16-node
launch pack — **with edges** — was built on staging inside a transaction, quoted through the live
`create_quote` as the workspace owner, asserted, and rolled back. Staging was left exactly as found.

```
launch_pack_total_micros = 4550000
priced_nodes    = 16
wave1_nodes     = 3        (exactly the copy nodes)
ready_nodes     = 3        (the other thirteen wait)
distinct_waves  = 3        (copy -> masters -> adaptations and motion together)
```

**The customer-facing total did not move.** The plan now carries scheduling and the pack still quotes
exactly 4,550,000 micros, which is what the 20/20 quote evidence and the margin doctrine both rest on.

Before and after the sync, staging held zero non-terminal runs, zero residual reservation
(`amount - captured - released = 0`), and a zero double-entry ledger balance.

## 5. Worker

Deployed to `mustbeviral-v2-staging-core`, version `0c1899e9-496d-445c-9339-1ca0de290a12`, carrying
the Track C dispatch payload work (brief context, upstream images, async minting, the wave-kick
`waitUntil`) and the Track D synchronous copy settlement.

## 6. What this does not cover

- The migration **history table** on staging still diverges from the repo's filenames: the 18
  auto-named rows remain, and this sync added its own. The schema is proven equivalent by §2; the
  bookkeeping is not, and reconciling it would mean rewriting a record of what actually happened.
  Left as an explicit operator decision rather than quietly repaired.
- No provider was called. The $0.0004 copy money-path proof is now unblocked but not yet run.
