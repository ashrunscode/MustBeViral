# Staging outbox queue namespace inspection — 2026-08-31

Work packet: WP-P3-001, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`

## Remote inspection (read-only)

Cloudflare Queues were listed through the official account Queues API (`GET /accounts/{account_id}/queues`). No account identifiers, queue IDs, or other secrets are recorded here.

| Intended staging namespace               | Present |
| ---------------------------------------- | ------- |
| `mustbeviral-v2-staging-outbox-dispatch` | no      |

No other `mustbeviral*` queue name was present. Existing queues on the account belong to other products and were not inspected beyond name presence.

Official docs used:

- [Create a queue](https://developers.cloudflare.com/queues/get-started/) — `npx wrangler queues create <name>` before any producer/consumer binding
- [Wrangler queue bindings](https://developers.cloudflare.com/workers/wrangler/configuration/#queues)

## Remote mutation

None. `PROJECT_STATE.yaml` keeps remote destructive action `forbidden`. The active packet still has `external_effects.remote_mutation: approval-required` and does not name the exact queue or Worker resource IDs. Operator "proceed" continues the authorized in-repo slice; it does not name those IDs.

Therefore this turn did **not**:

- create `mustbeviral-v2-staging-outbox-dispatch`
- attach producer/consumer bindings in `apps/core/wrangler.jsonc`
- deploy `mustbeviral-v2-staging-core`
- flip `QUEUES_ENABLED` away from `"false"`

Adding wrangler `queues.producers` / `queues.consumers` before the namespace exists would fail a staging deploy per the official create-then-bind order.

## Producer wiring

`enqueueOutboxWake` remains implemented and kill-switched, but is **not** called from `start_run` / post-commit outbox.

- `start_run_barrier` returns `run_id`, `reservation_id`, `quote_id`, `revision_id`, `revision_hash`, `status` — not `event_id`
- `StartRunResult` is `{ status: 'ok', run }` and rejects extra `event_id`
- Authenticated callers have no `SELECT` on `outbox_events`
- Existing privileged RPCs are `claim_outbox_events`, `get_outbox_dispatch_attempts`, `publish_outbox_event`, and `fail_outbox_event` — none look up a pending event by run without leasing it

Inventing `event_id` from `run_id`, adding a lookup RPC, or changing the barrier return shape would be a new convention. Cron (`* * * * *` → `runProviderScheduled`) remains the only drain.

## Rollback

No remote resource was created. Kill switch stays `QUEUES_ENABLED=false`. Git revert remains the code rollback path.
