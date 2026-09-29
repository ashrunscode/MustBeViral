# p3i-003 — private observation day 2 (2026-09-06)

Packet: `WP-P3-009`. Step: `p3i-003-private-72-hour-observation`. All times UTC.
Read path: `supabase-mbv` MCP (`https://jjgtlfblsfobdhmtngbz.supabase.co`) for S1–S7; Core/DNS/R2/Worker
via `curl.exe` / `pnpm exec wrangler` / Cloudflare DoH; Vercel CLI as fallback (connector 403).
No secret values, session tokens, signed URLs, or `nonce=` query values are recorded.

## Capture window

| Field                      | Value                                                                           |
| -------------------------- | ------------------------------------------------------------------------------- |
| Specified day-2 window     | 2026-09-06T21:22:00Z ± 120 minutes (19:22Z–23:22Z)                              |
| Capture                    | **2026-09-06T21:19:15Z–21:19:18Z** (inside the window; 3 minutes before 21:22Z) |
| SQL snapshot `captured_at` | 2026-09-06T21:19:17.896693Z                                                     |
| Day-1 comparison file      | `private-observation-2026-09-05.md` (reconstruction, not in-window)             |

Reads completed within 30 seconds. This is an in-window snapshot.

## S1 auth

Provenance: 2026-09-06T21:19:17Z.

| Field                  | Value                       |
| ---------------------- | --------------------------- |
| `auth_users`           | 1                           |
| `auth_sessions`        | 1                           |
| `auth_refresh_tokens`  | 1                           |
| `auth_flow_state`      | 0                           |
| `auth_identities`      | 1                           |
| `users_with_password`  | 1                           |
| `last_sign_in_at`      | 2026-09-04T21:19:38.051408Z |
| `newest_session_at`    | 2026-09-04T21:19:38.052003Z |
| `newest_session_touch` | 2026-09-04T21:19:38.052003Z |

## S2 zero rows (27)

Every listed table is `0`: `api_keys`, `artifact_lineage`, `artifacts`, `attempts`, `audit_events`,
`brand_kits`, `briefs`, `canvas_revisions`, `canvases`, `cost_reservations`, `idempotency_records`,
`ledger_transactions`, `oauth_access_tokens`, `oauth_clients`, `outbox_events`, `projects`,
`provider_jobs`, `provider_webhook_events`, `quotes`, `run_nodes`, `runs`, `skill_versions`,
`skills`, `stripe_webhook_events`, `workspace_billing_profiles`, `workspace_memberships`,
`workspaces`.

## S3 catalogs (4)

| Table                    | Rows | Expected |
| ------------------------ | ---- | -------- |
| `provider_registrations` | 4    | 4        |
| `price_catalog_versions` | 2    | 2        |
| `model_routes`           | 5    | 5        |
| `model_route_prices`     | 8    | 8        |

## S4 kill switches (five JSON keys)

| Key                       | Value                            |
| ------------------------- | -------------------------------- |
| `signups_enabled`         | false                            |
| `generation_enabled`      | false                            |
| `provider_routes_enabled` | false                            |
| `charging_enabled`        | false                            |
| `updated_at`              | 2026-09-02T15:47:59.474991+00:00 |

Byte-identical to the day-1 reconstruction baseline.

## Config gates

| Switch                  | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| `PROVIDER_RUNS_ENABLED` | `"false"` (`git diff --exit-code -- apps/core/wrangler.jsonc` exit 0) |
| `QUEUES_ENABLED`        | `"false"`                                                             |
| `disable_signup`        | true                                                                  |
| `mailer_autoconfirm`    | false                                                                 |
| `ssoProtection`         | anonymous 302 to `vercel.com/sso-api`                                 |

## S5 RLS structure

| Counter              | Value |
| -------------------- | ----- |
| `public_tables`      | 31    |
| `rls_disabled`       | 0     |
| `rls_not_forced`     | 0     |
| `zero_policy_tables` | 2     |

## S6 migration head

`20260902154759`, `20260902000000`, `20260831140000`. Unchanged.

## S7 anon grants

`anon_grants` on `public` = 0.

## Core health

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| HTTP         | 200                                    |
| `service`    | `mustbeviral-core`                     |
| `generation` | `viralgraph-cleanroom-v2`              |
| `status`     | `ok`                                   |
| `request_id` | `b7871435-b285-4cdb-9e50-52202af4095c` |

## Containment probes

| Probe                                              | Result                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| Unsigned artifact GET                              | **401 `UNAUTHENTICATED`** "An artifact access token is required." |
| `GET /v1/workspaces` unauthenticated               | **404 `NOT_FOUND`**                                               |
| `POST /mcp` `get_canvas_context` without owner JWT | **401 `UNAUTHENTICATED`** "A valid bearer token is required."     |
| Authenticated `get_canvas_context`                 | **unavailable** (owner JWT not extracted)                         |
| `POST /v1/quotes` without JWT                      | **404 `NOT_FOUND`**                                               |
| Authenticated quotes `generation_disabled`         | **unavailable** (same JWT rule)                                   |
| Anonymous alias                                    | **302** to `vercel.com/sso-api` (`nonce` present, value redacted) |

## R2

| Field          | Value                             |
| -------------- | --------------------------------- |
| bucket         | `mustbeviral-v2-production-media` |
| `object_count` | 0                                 |
| `bucket_size`  | 0 B                               |

## Worker

| Field                             | Value                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| current version id                | `b832cca9-3dea-46d2-8313-eba80854c1ca` (number 8)                                                            |
| containment version still present | `45077c66-f31e-4c30-8396-9300b8e27fe0` (number 7)                                                            |
| version count                     | 8                                                                                                            |
| secret NAME count                 | 4                                                                                                            |
| secret NAMES                      | `ARTIFACT_ACCESS_SIGNING_KEY`, `CONFIRMATION_SIGNING_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |

## Vercel

| Field                         | Value                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Connector runtime errors/logs | **403 Forbidden**                                                                                               |
| CLI newest Production Ready   | still `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, created 2026-09-02T16:28:05Z, aliases unchanged, listing still 4d old |
| Runtime-error count           | unavailable (connector 403)                                                                                     |
| Status-code histogram         | unavailable                                                                                                     |
| RSC-503 count                 | unavailable (no browser session this snapshot)                                                                  |

## DNS

DoH against Cloudflare, 2026-09-06T21:19Z.

| Name                  | Type | Result                                                |
| --------------------- | ---- | ----------------------------------------------------- |
| `api.mustbeviral.com` | A    | **NXDOMAIN** (Status 3)                               |
| `www.mustbeviral.com` | A    | `104.21.6.198`, `172.67.135.59` (flattened / proxied) |
| `mustbeviral.com`     | A    | `104.21.6.198`, `172.67.135.59`                       |

## Δ from day 1

Columns required by spec §7. Day-1 values are from the reconstruction file, not an in-window capture.

| Invariant                          | Previous day value                   | This day value                       | Δ    | Authorized?                                |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ---- | ------------------------------------------ |
| S1 auth_users                      | 1                                    | 1                                    | none | n/a                                        |
| S1 auth_sessions                   | 1                                    | 1                                    | none | n/a                                        |
| S1 users_with_password             | 1                                    | 1                                    | none | §4 note 4 (already flipped by day-1 recon) |
| S1 newest_session_at               | 2026-09-04T21:19:38.052003Z          | 2026-09-04T21:19:38.052003Z          | none | n/a                                        |
| S2 total (27 tables)               | 0                                    | 0                                    | none | n/a                                        |
| S3 provider_registrations          | 4                                    | 4                                    | none | n/a                                        |
| S3 price_catalog_versions          | 2                                    | 2                                    | none | n/a                                        |
| S3 model_routes                    | 5                                    | 5                                    | none | n/a                                        |
| S3 model_route_prices              | 8                                    | 8                                    | none | n/a                                        |
| S4 signups_enabled                 | false                                | false                                | none | n/a                                        |
| S4 generation_enabled              | false                                | false                                | none | n/a                                        |
| S4 provider_routes_enabled         | false                                | false                                | none | n/a                                        |
| S4 charging_enabled                | false                                | false                                | none | n/a                                        |
| S4 updated_at                      | 2026-09-02T15:47:59.474991+00:00     | 2026-09-02T15:47:59.474991+00:00     | none | n/a                                        |
| S5 public_tables                   | 31                                   | 31                                   | none | n/a                                        |
| S5 rls_disabled                    | 0                                    | 0                                    | none | n/a                                        |
| S5 rls_not_forced                  | 0                                    | 0                                    | none | n/a                                        |
| S5 zero_policy_tables              | 2                                    | 2                                    | none | n/a                                        |
| S6 head                            | 20260902154759                       | 20260902154759                       | none | n/a                                        |
| S7 anon_grants                     | 0                                    | 0                                    | none | n/a                                        |
| /health status                     | 200 ok                               | 200 ok                               | none | n/a                                        |
| unsigned-artifact probe            | 401 UNAUTHENTICATED                  | 401 UNAUTHENTICATED                  | none | n/a                                        |
| get_canvas_context unauthenticated | 401 UNAUTHENTICATED                  | 401 UNAUTHENTICATED                  | none | n/a                                        |
| quote-refusal unauthenticated      | 404 NOT_FOUND                        | 404 NOT_FOUND                        | none | n/a                                        |
| anonymous-alias probe              | 302 vercel.com/sso-api               | 302 vercel.com/sso-api               | none | n/a                                        |
| R2 object_count                    | 0                                    | 0                                    | none | n/a                                        |
| Worker version id                  | b832cca9-3dea-46d2-8313-eba80854c1ca | b832cca9-3dea-46d2-8313-eba80854c1ca | none | n/a                                        |
| secret-name count                  | 4                                    | 4                                    | none | n/a                                        |
| Vercel deployment id               | dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb     | dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb     | none | n/a                                        |
| runtime-error count                | unavailable                          | unavailable                          | none | n/a                                        |
| RSC-503 count                      | unavailable                          | unavailable                          | none | n/a                                        |
| DNS api                            | NXDOMAIN                             | NXDOMAIN                             | none | n/a                                        |
| DNS www A                          | 172.67.135.59 / 104.21.6.198         | 104.21.6.198 / 172.67.135.59         | none | n/a                                        |
| DNS apex A                         | 172.67.135.59 / 104.21.6.198         | 104.21.6.198 / 172.67.135.59         | none | n/a                                        |

`request_id` on `/health` changed (`39d389fd-…` → `b7871435-…`). That is per-request, not an invariant.

## Deviations

1. Day-1 comparison baseline is a reconstruction, not an in-window 21:22Z capture. Δ table still holds.
2. Authenticated containment probes still not run (no owner JWT extracted).
3. Vercel runtime series still unavailable (connector 403).
4. Password remains set; original session still live. No new session.

## Not done

No DNS, deploy, migration, kill-switch, R2, signup, charge, queue, or generation mutation.
Packet YAML not edited. Day-3 snapshot still required at or after 2026-09-07T21:22:00Z, then the rollup and OD-24.
