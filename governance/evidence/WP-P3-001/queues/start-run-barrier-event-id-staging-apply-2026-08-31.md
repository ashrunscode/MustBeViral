# start_run_barrier event_id applied on mustbeviral-staging — 2026-08-31

Work packet: WP-P3-001, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`

## Authorization

Standing operator approval named these staging resources only:

- Supabase project `mustbeviral-staging`
- Worker `mustbeviral-v2-staging-core`
- Queue `mustbeviral-v2-staging-outbox-dispatch`

`user-supabase` is bound to a different product and was not used for writes.

## Migration

Official path: Supabase MCP `list_migrations` then `apply_migration` (same path as prior P0 staging applies). `supabase db push --linked` was not used.

| Check                         | Result                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pre-apply history             | last remote name `p0_golden_20_defect_audit`; `p3_start_run_barrier_outbox_event_id` absent                                 |
| Pre-apply `start_run_barrier` | no `v_outbox_event_id`; response keys were `run_id`, `reservation_id`, `quote_id`, `revision_id`, `revision_hash`, `status` |
| Applied name                  | `p3_start_run_barrier_outbox_event_id`                                                                                      |
| Post-apply catalog            | `v_outbox_event_id` present; `RETURNING id` present; response includes `event_id`                                           |
| Unrelated migrations          | none applied                                                                                                                |

## Staging Core deploy

Official command: `wrangler deploy --env staging --keep-vars` from `apps/core` ([Wrangler `--keep-vars`](https://developers.cloudflare.com/workers/wrangler/commands/workers/), [environments `--env`](https://developers.cloudflare.com/workers/wrangler/environments/)).

| Check                         | Result                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Worker                        | `mustbeviral-v2-staging-core`                                                                    |
| Prior live version (rollback) | `777fa6f1-4fbf-4b89-9149-d0b0218e0681`                                                           |
| New version                   | `e2614072-adfa-404f-9ba9-32376a221130`                                                           |
| `QUEUES_ENABLED`              | `"false"`                                                                                        |
| Producer                      | bound to `mustbeviral-v2-staging-outbox-dispatch`; enqueue no-ops while the flag is not `"true"` |
| Consumer                      | bound; `queue()` returns immediately while the flag is not `"true"`                              |
| Hyperdrive staging binding    | still absent (intentional)                                                                       |
| Provider spend                | not changed; `PROVIDER_RUNS_ENABLED` left as already deployed                                    |

## Rollback

- Instant kill-switch: keep `QUEUES_ENABLED=false`.
- Worker: `wrangler rollback e2614072-adfa-404f-9ba9-32376a221130 --env staging` is the new live version; prior queue-bound version remains `777fa6f1-4fbf-4b89-9149-d0b0218e0681`.
- Do not delete `mustbeviral-v2-staging-outbox-dispatch`.
- Function rollback is a later `CREATE OR REPLACE` that removes `event_id`; not performed.
