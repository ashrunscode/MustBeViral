# Cloudflare Workers Observability — P3 backpressure windows

Service: `mustbeviral-v2-staging-core`  
Source: Cloudflare Workers Observability MCP (`query_worker_observability`)  
Window: `2026-08-31T17:55:00Z`–`2026-08-31T18:26:00Z`  
Account identifiers, request IDs, canvas IDs, IPs, and authorization material omitted.

## Worker outcomes (full window)

| Outcome                         | Events |
| ------------------------------- | ------ |
| ok                              | 54,103 |
| exception / canceled / exceeded | 0      |

No Worker exception, CPU-limit, or subrequest-limit outcomes were observed.  
`subrequest_limit_observed`: **false**.

## Ingress HTTP status (Worker fetch)

| Status | Events | Notes                                                                          |
| ------ | ------ | ------------------------------------------------------------------------------ |
| 200    | 54,051 | Command ingress                                                                |
| 201    | 21     | Workspace/canvas creates                                                       |
| 0      | n/a    | Internal Data API / span events without a Worker fetch status — not client 5xx |

No 429 / 5xx Worker fetch statuses in the window.

## Path mix (sanitized)

| Path class                        | Events |
| --------------------------------- | ------ |
| `POST /v1/canvases/{id}/quotes`   | 34,036 |
| `POST /v1/canvases/{id}/validate` | 19,912 |
| Supabase `create_quote` RPC       | 33,969 |
| Supabase `model_route_prices`     | 34,061 |
| Supabase `cost_reservations`      | 34,096 |
| Cron `arm_stranded_dispatch`      | 31     |
| Cron `reap_dead_dispatch`         | 40     |

Quote/validate load fans out to multiple Postgres Data API calls per ingress request.

## CPU vs wall time

| Window                    | Requests | CPU p95 | CPU p99 | CPU max | Wall median | Wall p95 | Wall p99 |
| ------------------------- | -------- | ------- | ------- | ------- | ----------- | -------- | -------- |
| Full 17:55–18:26Z         | 54,103   | 16 ms   | 23 ms   | 177 ms  | 1,142 ms    | 5,551 ms | 6,423 ms |
| VU 200 18:10:20–18:15:30Z | 16,123   | 16 ms   | —       | 177 ms  | —           | 5,573 ms | —        |

CPU stays far below Worker limits. Saturation is **wall-time / I/O fan-out** (Postgres Data API), matching harness p95 degradation at VU 200 (6,316 ms client-side).

## Outbox dispatch lag

Official harness operations were `quote_run` + `validate_graph` (no `start_run`).  
`outbox_dispatch_p95_ms`: **not_applicable** for this load.  
Cron recovery RPCs continued on schedule (`arm_stranded_dispatch` 31, `reap_dead_dispatch` 40). No abandoned-event backlog signal in this quote/validate window.

## Interpretation

Measured backpressure is I/O fan-out under concurrent quote/validate, not CPU exhaustion. Queues are authorized to **decouple post-commit outbox wake** from ingress, behind a kill switch, without becoming a second ledger/revision authority.
