# Private production observation — recovery capture

Packet: `WP-P3-009`, current step `p3i-003-private-72-hour-observation`.
Captured on 2026-09-08 UTC against the unchanged `8578e93` checkout.
This is a late recovery capture, not the missing September 5 or September 7 capture.
All results below are point-in-time observations unless a provider time range is stated.
Secret values, owner identifiers, cookies, bearer tokens, signed URLs, and redirect query strings are omitted.

## Database

Read-only Supabase connector calls explicitly targeted project `jjgtlfblsfobdhmtngbz`.
S1–S7 ran sequentially from 02:40:31Z through 02:40:41Z.

| Check                               | Observed result                                                             |
| ----------------------------------- | --------------------------------------------------------------------------- |
| S1 auth                             | 1 user, 1 session, 1 refresh token, 0 flow-state rows, 1 identity           |
| Password field                      | 1 non-null password field; this does not prove a password reset occurred    |
| Latest sign-in                      | 2026-09-04T21:19:38.051408Z                                                 |
| Session creation and last touch     | 2026-09-04T21:19:38.052003Z                                                 |
| S2 tenant, money and machine tables | All 27 listed below have 0 rows                                             |
| S3 catalogs                         | 4 providers, 2 price catalog versions, 5 model routes, 8 model route prices |
| S4 switches                         | Signup, generation, provider routes, charging all false                     |
| S4 updated_at                       | 2026-09-02T15:47:59.474991+00:00, equal to September 6                      |
| S5 RLS                              | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies          |
| S6 migration head                   | 20260902154759, 20260902000000, 20260831140000                              |
| S7 anonymous grants                 | 0 public table grants                                                       |

The 27 S2 tables are `api_keys`, `artifact_lineage`, `artifacts`, `attempts`,
`audit_events`, `brand_kits`, `briefs`, `canvas_revisions`, `canvases`,
`cost_reservations`, `idempotency_records`, `ledger_transactions`,
`oauth_access_tokens`, `oauth_clients`, `outbox_events`, `projects`,
`provider_jobs`, `provider_webhook_events`, `quotes`, `run_nodes`, `runs`,
`skill_versions`, `skills`, `stripe_webhook_events`, `workspace_billing_profiles`,
`workspace_memberships`, and `workspaces`.

An additional allowlisted Management API projection at 02:47:48Z returned
`disable_signup=true` and `mailer_autoconfirm=false`. No other Auth configuration
values were printed or saved.

## HTTP and owner browser

| Capture                | Probe                                          | Result                                                                           |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| 02:43:46Z              | Core `/health`                                 | 200, `mustbeviral-core`, `viralgraph-cleanroom-v2`, `ok`; client elapsed 3978 ms |
| 02:43:47Z              | Unsigned artifact content                      | 401 `UNAUTHENTICATED`; client elapsed 272 ms                                     |
| 02:43:47Z              | Anonymous protected alias                      | 302; redirect host `vercel.com`; query omitted                                   |
| Recovery browser check | Protected alias in the existing Chrome profile | `/studio/continue` rendered “Continue this campaign” with a start-brief link     |

Client elapsed time includes local/network overhead and is not a Worker p95 or
capacity measurement. Browser-control timeouts are tool failures, not HTTP 503s.
The first browser connection and one navigation attempt timed out; selecting the
actual connected browser ID subsequently rendered the protected application.
The owner browser subsequently rendered the supported absent-canvas denials:
“Canvas unavailable — You do not have access to this canvas” and “Quote unavailable
— You do not have permission to quote this canvas.” Vercel retained records for
the recovery period independently confirm one HTTP 403 on each of
`/api/core/v1/canvases/00000000-0000-4000-8000-000000000000` and its `/quotes` child.
The quote request was refused before quote creation. At 02:56:24Z, a second S2
query confirmed all 27 tables still had zero rows.

At this recovery capture, final sign-out and an observed browser prefetch-503 count remain unproven. The
session stays available for recovery observation; this is not a completed window.

## Provider records

| Surface                                                       | Current evidence                                                                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R2 bucket information                                         | `mustbeviral-v2-production-media`: 0 objects, 0 B                                                                                  |
| Worker version history                                        | 8 versions; newest `b832cca9-3dea-46d2-8313-eba80854c1ca`; containment version `45077c66-f31e-4c30-8396-9300b8e27fe0` retained     |
| Worker active deployment                                      | `ee26c70e-9be5-4406-a5af-ceec2897f42a`, created September 2 16:36:09Z; newest version receives 100%                                |
| Worker secret names                                           | Four unchanged names: `ARTIFACT_ACCESS_SIGNING_KEY`, `CONFIRMATION_SIGNING_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| Vercel project                                                | `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj` in `team_A11dbY2xnTWzGL63IRBTWmLo`                                                              |
| Vercel current deployment                                     | `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, READY, production target; two provider domains only                                            |
| New Vercel deployments since September 4 21:22Z               | 0                                                                                                                                  |
| Runtime error clusters, September 4 21:22Z–September 8 02:45Z | Connector returned no runtime errors                                                                                               |
| Runtime status histogram, same range and exact deployment     | 200: 27; 400: 2                                                                                                                    |

Unlike the prior daily reports, the runtime connector is accessible in this
session. The query used the verified project ID, team ID, and deployment ID.
Retained function records do not prove continuous edge availability or recover
the missing historical browser probes. Runtime errors and HTTP error responses
are distinct; the two 400 responses are not silently discarded.

## DNS

Cloudflare DNS-over-HTTPS reads at 02:47:47Z–02:47:48Z:

| Name                  | A-query result                 |
| --------------------- | ------------------------------ |
| `api.mustbeviral.com` | NXDOMAIN, DNS status 3         |
| `www.mustbeviral.com` | 104.21.6.198 and 172.67.135.59 |
| `mustbeviral.com`     | 104.21.6.198 and 172.67.135.59 |

These A answers match September 6. A proxied A answer alone does not reveal the
configured CNAME target; this capture does not claim a new zone configuration read.

## Result

Current database containment, Core health, unsigned artifact refusal, provider
deployment stability, and anonymous SSO protection are supported by these reads.
The original continuous observation criterion remains unproven. No deployment,
DNS change, migration, storage write, provider execution, payment, signup, or
customer admission was performed.

## Additional closing checks and session refresh

Pinned Wrangler reads confirmed public access via `r2.dev` is disabled and the R2
bucket has no custom domains. A version-specific binding projection at 02:59:11Z
confirmed deployed `PROVIDER_RUNS_ENABLED=false` and `QUEUES_ENABLED=false`.

At 03:04:15Z, S1 still showed exactly one user and one session, but two refresh
token rows and a session touch at 02:46:59Z. A follow-up aggregate query proved
one revoked token, one active token, and one distinct session. The new token was
created at 02:46:59Z during browser access. This is consistent with normal session
refresh, not a new sign-in or customer activity. Supabase documents rotation here:
<https://supabase.com/docs/guides/auth/sessions>.

The external spec's equality between total refresh-token rows and session rows is
therefore not a valid invariant after session use. Record total, revoked, active,
and distinct-session counts separately. No token contents or session IDs were read.

The recovery-period Vercel histogram displayed 37 HTTP 200, 2 HTTP 307 and 2 HTTP
403 responses, with a fourth category omitted by the connector's top-three output.
It must not be represented as a complete histogram. The separate 403 path query
returned exactly the two supported denial routes above.

Collection and follow-up checks span more than 30 minutes, disclosed as required
by the external spec. That duration alone does not invalidate a snapshot. This
record remains the initial recovery collection. Subsequent browser checks and a
fresh baseline are recorded separately in `replacement-observation-baseline-2026-09-08.md`.
