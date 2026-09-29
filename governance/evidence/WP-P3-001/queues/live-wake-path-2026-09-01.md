# Staging live wake path — 2026-09-01

Work packet: WP-P3-001, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`

## Authorization

Standing operator approval after the event_id migration and no-op deploy: flip
`QUEUES_ENABLED` to `"true"` on `mustbeviral-v2-staging-core` only. Instant rollback
is set the var back to `"false"` and redeploy. Do not delete the queue. Do not start
a provider-spend run.

## Deploy

Official command: `wrangler deploy --env staging --keep-vars` from `apps/core`
([Wrangler `--keep-vars`](https://developers.cloudflare.com/workers/wrangler/commands/workers/),
[Queue.send](https://developers.cloudflare.com/queues/configuration/javascript-apis/)).

| Check                                      | Result                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Worker                                     | `mustbeviral-v2-staging-core`                                                                        |
| Prior no-op version (kill-switch rollback) | `e2614072-adfa-404f-9ba9-32376a221130`                                                               |
| Live version                               | `e66b6d1c-47d1-44b9-b83d-e062c0119cae`                                                               |
| `QUEUES_ENABLED`                           | `"true"`                                                                                             |
| Producer                                   | live; `enqueueOutboxWake` sends `{ type: 'outbox.wake', event_id }` after `start_run_barrier` commit |
| Consumer                                   | bound; `queue()` drains through existing `runProviderScheduled` only when the flag is `"true"`       |
| Public `StartRunResult`                    | still rejects extra `event_id`                                                                       |
| Provider spend                             | no `start_run` issued; cron remains the idle drain                                                   |
| Hyperdrive staging binding                 | still absent                                                                                         |

## Proof without provider spend

- Unit tests in `apps/core/test/unit/outbox-queue.test.ts` and
  `apps/core/test/unit/start-run-outbox-wake.test.ts` prove send/skip, wake shape,
  and handler stripping of `event_id`.
- Deploy bindings list `QUEUES_ENABLED ("true")` plus producer/consumer for
  `mustbeviral-v2-staging-outbox-dispatch`.
- Sanitized Workers Observability for `2026-08-31T23:50:00Z`–`2026-09-01T00:20:00Z`
  on `mustbeviral-v2-staging-core`: trigger origin `scheduled` only (21 events).
  No queue-consumer origin in the window because no `start_run` was issued.

## Rollback

Instant kill-switch: set `QUEUES_ENABLED` to `"false"` and
`wrangler deploy --env staging --keep-vars`, or
`wrangler rollback e2614072-adfa-404f-9ba9-32376a221130 --env staging`.
Do not delete `mustbeviral-v2-staging-outbox-dispatch`.
