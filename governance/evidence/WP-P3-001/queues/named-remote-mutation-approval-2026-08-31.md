# Named remote mutation approval — 2026-08-31

Work packet: WP-P3-001, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`

## Operator naming

The operator authorized Cloudflare, Supabase, and Vercel CLI/MCP use for this step and named
these staging resources only:

- Queue: `mustbeviral-v2-staging-outbox-dispatch`
- Worker: `mustbeviral-v2-staging-core`

`PROJECT_STATE.yaml` records those names on `environments.staging`. The active packet records the
same names in `rollback.strategy` and sets `external_effects.remote_mutation` to the existing
schema value `authorized`. `legacy.destructive_remote_action` stays `forbidden`.
`external_effects.destructive_remote_actions` stays `false`.

## Pre-mutation inspection (read-only)

| Check                                                                | Result                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cloudflare Queues list (`wrangler queues list` + account Queues API) | `mustbeviral-v2-staging-outbox-dispatch` absent; no other `mustbeviral*` queue name                               |
| Staging Worker                                                       | `mustbeviral-v2-staging-core` present                                                                             |
| Live staging version (rollback target)                               | `246b5df9-bbcd-48cb-b90c-a050db73f208`                                                                            |
| `QUEUES_ENABLED` in staging wrangler vars                            | `"false"`                                                                                                         |
| Producer wired                                                       | no — `start_run_barrier` returns `run_id`, `reservation_id`, `quote_id`, `revision_id`, `revision_hash`, `status` |
| MustBeViral Hyperdrive config                                        | absent (other-product Hyperdrive configs were not used)                                                           |
| Hyperdrive fixture corpus on `mustbeviral-staging`                   | short of G1–G6 (under 250 workspaces and 1,000 canvases); no `fixture-manifest.json`                              |
| Vercel MCP                                                           | not authenticated; not required for this queue/bind/deploy slice                                                  |

Official docs used: [Create a queue](https://developers.cloudflare.com/queues/get-started/)
(`wrangler queues create` before producer/consumer bindings),
[Wrangler environments / deploy `--env`](https://developers.cloudflare.com/workers/wrangler/environments/).

## Authorized mutations (these names only)

1. Create queue `mustbeviral-v2-staging-outbox-dispatch`.
2. Attach staging-env producer `OUTBOX_DISPATCH_QUEUE` and consumer for that queue name only.
3. Deploy `mustbeviral-v2-staging-core` with `QUEUES_ENABLED` still `"false"`.

Not authorized: production Worker or queue, a second executor Worker, BYOK, Hyperdrive user-path
enablement, flipping `QUEUES_ENABLED` to `true`, provider-spend enablement, or deleting any
namespace.

## Rollback

Instant kill-switch: keep `QUEUES_ENABLED=false` on `mustbeviral-v2-staging-core`.

Code/bindings rollback: remove the staging `queues` producers/consumers and Git revert.

Worker rollback: `wrangler rollback 246b5df9-bbcd-48cb-b90c-a050db73f208 --env staging` (or redeploy
that prior version).

Namespace rollback (destructive; still forbidden until separately authorized): unbind, then
`wrangler queues delete mustbeviral-v2-staging-outbox-dispatch`.

## Post-mutation

| Action                                                           | Result                                 |
| ---------------------------------------------------------------- | -------------------------------------- |
| `wrangler queues create mustbeviral-v2-staging-outbox-dispatch`  | created                                |
| Staging producer/consumer bindings in `apps/core/wrangler.jsonc` | attached (`OUTBOX_DISPATCH_QUEUE`)     |
| `wrangler deploy --env staging --keep-vars`                      | deployed `mustbeviral-v2-staging-core` |
| `QUEUES_ENABLED`                                                 | `"false"`                              |
| Producer `enqueueOutboxWake` from `start_run`                    | still unwired                          |
| New staging version                                              | `777fa6f1-4fbf-4b89-9149-d0b0218e0681` |
