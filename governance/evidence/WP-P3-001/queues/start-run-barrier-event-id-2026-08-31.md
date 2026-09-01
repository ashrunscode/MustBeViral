# start_run_barrier returns existing outbox event_id — 2026-08-31

Work packet: WP-P3-001, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`

## Authorization

The operator authorized this exact slice: return the existing outbox `event_id` from
`start_run_barrier` and wire `enqueueOutboxWake` after Postgres commit. Keep
`QUEUES_ENABLED=false`. Do not derive `event_id` from `run_id`. Do not add a separate
executor or BYOK.

## In-repo contract

- `start_run_barrier` now returns the `id` of the outbox row it already inserts.
- The repository maps that existing `event_id` and rejects a payload that copies `run_id`.
- After the RPC commit returns, composition calls `enqueueOutboxWake` with
  `{ type: 'outbox.wake', event_id }` only.
- `QUEUES_ENABLED` remains `"false"` in staging wrangler. Enqueue no-ops unless the flag is
  the string `true` and `OUTBOX_DISPATCH_QUEUE` is present.
- Public `StartRunResult` still rejects extra `event_id`. The wake id is not a client
  contract.

Official producer API used:
[Queue.send](https://developers.cloudflare.com/queues/configuration/javascript-apis/).

## Remote actions

None. No Worker deploy. No staging migration apply. No kill-switch flip.

## Rollback

Keep `QUEUES_ENABLED=false`. Git revert of this in-repo contract. Cron remains the drain.
