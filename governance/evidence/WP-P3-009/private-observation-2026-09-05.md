# p3i-003 — private observation day 1 (2026-09-05) — missed contemporaneous capture

Packet: `WP-P3-009`. Step: `p3i-003-private-72-hour-observation`. All times UTC.
Read path: `supabase-mbv` MCP (`https://jjgtlfblsfobdhmtngbz.supabase.co`) for S1–S7; Core/DNS/R2/Worker
via `curl.exe` / `pnpm exec wrangler` / Cloudflare DoH. Vercel connector returned 403; CLI used as
fallback. No secret values, session tokens, signed URLs, or `nonce=` query values are recorded.

## Capture window

| Field                                      | Value                                                                                  | Provenance                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Specified day-1 window                     | 2026-09-05T19:22:00Z ± 120 minutes                                                     | spec §4 step 3 note 1                                  |
| Contemporaneous snapshot in that window    | **not taken**                                                                          | evidence directory had only the three 2026-09-04 files |
| Reconstruction reads                       | 2026-09-06T14:51:34Z (S1–S7, one SQL snapshot) through 2026-09-06T14:52:52Z (HTTP/DNS) | `captured_at` on the SQL object; Core `Date` headers   |
| Postgres logs for calendar 2026-09-05      | 7 rows, all checkpoints or a client disconnect; none in 19:22Z–23:22Z                  | `supabase-mbv__query_logs`                             |
| Postgres logs for 2026-09-05T19:22Z–23:22Z | 0 rows                                                                                 | same                                                   |

This file is **not** a 21:22Z ± 120 min snapshot. It reconstructs what can still be proved after the
missed window. The 2026-09-07 rollup must not treat this file as an in-window daily capture.

## S1 auth

Provenance: reconstructed 2026-09-06T14:51:34Z.

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

Expected from p3i-002: sessions 1, password absent. Password is now set; the original recovery
session is still the only session (same `created_at`). The pre-authorized `1 → 0 → 1` gap did **not**
occur. Recorded as authorized deviation (password set inside the live recovery session).

## S2 zero rows (27)

Provenance: reconstructed 2026-09-06T14:51:34Z. Every listed table is `0`.

`api_keys`, `artifact_lineage`, `artifacts`, `attempts`, `audit_events`, `brand_kits`, `briefs`,
`canvas_revisions`, `canvases`, `cost_reservations`, `idempotency_records`, `ledger_transactions`,
`oauth_access_tokens`, `oauth_clients`, `outbox_events`, `projects`, `provider_jobs`,
`provider_webhook_events`, `quotes`, `run_nodes`, `runs`, `skill_versions`, `skills`,
`stripe_webhook_events`, `workspace_billing_profiles`, `workspace_memberships`, `workspaces`.

No workspace bootstrap row. Matches p3i-002.

## S3 catalogs (4)

Provenance: reconstructed 2026-09-06T14:51:34Z.

| Table                    | Rows | Expected |
| ------------------------ | ---- | -------- |
| `provider_registrations` | 4    | 4        |
| `price_catalog_versions` | 2    | 2        |
| `model_routes`           | 5    | 5        |
| `model_route_prices`     | 8    | 8        |

## S4 kill switches (five JSON keys)

Provenance: reconstructed 2026-09-06T14:51:34Z. `public.get_platform_kill_switches()` one jsonb
object. This `updated_at` is the day-1 **baseline** for days 2 and 3.

| Key                       | Value                            |
| ------------------------- | -------------------------------- |
| `signups_enabled`         | false                            |
| `generation_enabled`      | false                            |
| `provider_routes_enabled` | false                            |
| `charging_enabled`        | false                            |
| `updated_at`              | 2026-09-02T15:47:59.474991+00:00 |

## Config gates

| Switch                  | Value                                                               | Provenance                                                                                      |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `PROVIDER_RUNS_ENABLED` | `"false"`                                                           | `git diff --exit-code -- apps/core/wrangler.jsonc` exit 0; production block unchanged           |
| `QUEUES_ENABLED`        | `"false"`                                                           | same                                                                                            |
| `disable_signup`        | true                                                                | Management API auth config, boolean only; raw payload deleted after extract                     |
| `mailer_autoconfirm`    | false                                                               | same                                                                                            |
| `ssoProtection`         | still in front of the alias (anonymous 302 to `vercel.com/sso-api`) | reconstructed HTTP 2026-09-06T14:52:52Z. Connector `get_project_deployment_protection` 404/403. |

## S5 RLS structure

Provenance: reconstructed 2026-09-06T14:51:34Z.

| Counter              | Value | Expected                                               |
| -------------------- | ----- | ------------------------------------------------------ |
| `public_tables`      | 31    | 31                                                     |
| `rls_disabled`       | 0     | 0                                                      |
| `rls_not_forced`     | 0     | 0                                                      |
| `zero_policy_tables` | 2     | 2 (`provider_webhook_events`, `stripe_webhook_events`) |

## S6 migration head

Provenance: reconstructed 2026-09-06T14:51:34Z plus `list_migrations`. Newest three:
`20260902154759`, `20260902000000`, `20260831140000`. Chain head unchanged.

## S7 anon grants

`anon_grants` on `public` = 0. Provenance: reconstructed 2026-09-06T14:51:34Z.

## Core health

Provenance: reconstructed 2026-09-06T14:52:49Z.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| HTTP         | 200                                    |
| `service`    | `mustbeviral-core`                     |
| `generation` | `viralgraph-cleanroom-v2`              |
| `status`     | `ok`                                   |
| `request_id` | `39d389fd-abcb-4731-b452-bf1c56241c95` |

## Containment probes

| Probe                                                 | Result                                                                                                                                                                                                            | Provenance                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Unsigned `GET /v1/artifacts/{nil-uuid}/content`       | **401 `UNAUTHENTICATED`** "An artifact access token is required."                                                                                                                                                 | reconstructed 2026-09-06T14:52:50Z |
| `GET /v1/workspaces` unauthenticated                  | **404 `NOT_FOUND`**                                                                                                                                                                                               | reconstructed 2026-09-06T14:52:51Z |
| `POST /mcp` `get_canvas_context` without owner JWT    | **401 `UNAUTHENTICATED`** "A valid bearer token is required." (Accept header corrected on retry)                                                                                                                  | reconstructed 2026-09-06T14:52:51Z |
| `POST /mcp` `get_canvas_context` **with** owner JWT   | **unavailable** — owner JWT is not extracted from the live session (redaction rule R). Authenticated empty-context 200 is deferred to an in-window snapshot that can use the owner's browser, not a stolen token. | n/a                                |
| `POST /v1/quotes` without JWT                         | **404 `NOT_FOUND`**                                                                                                                                                                                               | reconstructed 2026-09-06T14:52:51Z |
| `POST /v1/quotes` authenticated `generation_disabled` | **unavailable** — same JWT rule                                                                                                                                                                                   | n/a                                |
| Anonymous alias                                       | **302** to `vercel.com/sso-api` (`nonce` query parameter present, value redacted)                                                                                                                                 | reconstructed 2026-09-06T14:52:52Z |

Unauthenticated quote/MCP results are containment, not the authenticated envelopes named in §10
decision #20. They are not `BLOCKED_CONTAINMENT_PROBE`: the authenticated probes were not runnable
without taking a session token.

## R2

Provenance: reconstructed `pnpm exec wrangler r2 bucket info mustbeviral-v2-production-media`.

| Field          | Value                             |
| -------------- | --------------------------------- |
| bucket         | `mustbeviral-v2-production-media` |
| `object_count` | 0                                 |
| `bucket_size`  | 0 B                               |
| created        | 2026-09-02T01:35:37.159Z          |
| location       | ENAM                              |

## Worker

Provenance: reconstructed `pnpm exec wrangler versions list --name mustbeviral-v2-production-core --json`
and `pnpm exec wrangler secret list --env production --config apps/core/wrangler.jsonc`.

| Field                                | Value                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| current version id                   | `b832cca9-3dea-46d2-8313-eba80854c1ca` (number 8, `version_upload`)                                          |
| containment version id still present | `45077c66-f31e-4c30-8396-9300b8e27fe0` (number 7)                                                            |
| version count                        | 8 (no version past 8)                                                                                        |
| secret NAME count                    | 4                                                                                                            |
| secret NAMES                         | `ARTIFACT_ACCESS_SIGNING_KEY`, `CONFIRMATION_SIGNING_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |

No new version and no new secret NAME versus WP-P3-008 rollback evidence.

## Vercel

| Field                                                                             | Value                                                                                                                                                                                                                                                                                                                                                    | Provenance                                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Connector `get_runtime_errors` / `get_runtime_logs` / `list_deployments`          | **403 Forbidden**                                                                                                                                                                                                                                                                                                                                        | reconstructed; team slug and `team_A11dbY2xnTWzGL63IRBTWmLo` both 403 |
| CLI `pnpm exec vercel ls mustbeviral-web-production --scope ashrunscode-projects` | newest listed Production Ready deployments are **4d** old (calendar 2026-09-02). No deployment dated 2026-09-05 or 2026-09-06 in the listing.                                                                                                                                                                                                            | reconstructed                                                         |
| Pinned READY `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`                                   | **Ready**, production, created 2026-09-02T16:28:05Z (4d ago). CLI inspect of that id and of `mustbeviral-web-production-hjqmp880t-ashrunscode-projects.vercel.app` return the same id. Aliases: `mustbeviral-web-production.vercel.app` and `mustbeviral-web-production-ashrunscode-projects.vercel.app`. No new production deployment since 2026-09-02. | reconstructed                                                         |
| Runtime-error count                                                               | unavailable (connector 403)                                                                                                                                                                                                                                                                                                                              | unavailable                                                           |
| Status-code histogram                                                             | unavailable (connector 403)                                                                                                                                                                                                                                                                                                                              | unavailable                                                           |
| RSC-503 count                                                                     | unavailable (no browser session in this reconstruction)                                                                                                                                                                                                                                                                                                  | unavailable                                                           |

No evidence of a new production deployment during 2026-09-05. Runtime-error and RSC-503 series
start at the first in-window snapshot (day 2).

## DNS

Method: `nslookup` against 1.1.1.1 plus Cloudflare DoH `application/dns-json`.
Timestamps: 2026-09-06T14:52:52Z reconstructed.

| Name                  | Type  | Result                                                                             |
| --------------------- | ----- | ---------------------------------------------------------------------------------- |
| `api.mustbeviral.com` | A     | **NXDOMAIN** (DoH Status 3; nslookup "Non-existent domain")                        |
| `www.mustbeviral.com` | CNAME | no CNAME answer (Cloudflare flattening); A `172.67.135.59`, `104.21.6.198` TTL 300 |
| `mustbeviral.com`     | A     | `172.67.135.59`, `104.21.6.198` (proxied anycast)                                  |

Matches the 2026-09-03 first-hand zone read: apex and `www` proxied to Pages via Cloudflare;
`api.` still NXDOMAIN.

## Deviations

1. **Missed contemporaneous capture.** Day-1 file was not written at 2026-09-05T21:22Z ± 120 min.
   Reconstruction at 2026-09-06T14:51Z–14:53Z. Not a blocker code — the window was not observed, not
   observed-and-failed. The rollup must disclose this gap.
2. **`users_with_password` flipped to 1** with the original session still live (no `1 → 0 → 1` gap).
   Pre-authorized by §4 step 3 note 4 / §9 item 1 (owner may set the password). Shape differs from
   the expected reset-revokes-all-sessions sequence; session `created_at` is unchanged from p3i-002.
3. **Authenticated containment probes not run.** Owner JWT not taken. Unauthenticated MCP is 401
   `UNAUTHENTICATED`; unauthenticated quotes is 404 `NOT_FOUND`.
4. **Vercel runtime series unavailable** via connector (403). CLI shows no new 2026-09-05 deploy.
5. **Postgres logs on 2026-09-05** are checkpoints plus one `could not receive data from client:
Connection reset by peer` at 11:07:33Z. No tenant-table write is visible in those seven rows.

## Not done

No DNS change, deploy, migration, kill-switch flip, R2 write, signup, charge, queue, or generation.
Packet YAML not edited. Day-2 in-window snapshot still required at 2026-09-06T19:22Z–23:22Z.
Day-3 and the rollup still required at or after 2026-09-07T21:22:00Z.
