# p3i-002 — Approved owner sign-in and zero-spend smoke (2026-09-04)

Identity and authorization: see `owner-identity-authorization-2026-09-04.md` (p3i-001). All times UTC.

## Sign-in path (no password handled by the agent)

| Time     | Event                                                                                                                                                                                                                    | Proof                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 21:16:39 | Recovery link requested from the app's own `/forgot-password` page on the SSO alias (browser-initiated, so the PKCE verifier stayed in the owner's browser)                                                              | `auth.users.recovery_sent_at = 2026-09-04 21:16:39.748489+00`; `auth.flow_state` count 1                                                        |
| 21:16    | Email "Reset your password" from "Must Be Viral" `<hello@mustbeviral.com>` delivered to the owner mailbox **Inbox** (not Spam this time)                                                                                 | Gmail search `in:anywhere from:hello@mustbeviral.com newer_than:1d`, 1 result                                                                   |
| 21:19:36 | Link followed: `https://jjgtlfblsfobdhmtngbz.supabase.co/auth/v1/verify?token=pkce_…&type=recovery&redirect_to=https://mustbeviral-web-production-ashrunscode-projects.vercel.app/auth/callback?recovery=1&next=/studio` | `email_confirmed_at = 2026-09-04 21:19:36.954094+00`                                                                                            |
| 21:19:38 | `/auth/callback` exchanged the code and created the session; app landed on `/reset-password?next=/studio`                                                                                                                | `last_sign_in_at = 21:19:38.051408+00`; `auth.sessions` = 1 (created 21:19:38.052003, `aal1`); `auth.refresh_tokens` = 1; `auth.flow_state` = 0 |

The Vercel SSO gate on the alias was already satisfied in the owner's browser; the agent did not sign in to Vercel and did not enter or set any password. The "Choose a new password" form was left untouched; the owner sets the password later (the app then signs out every session by design).

## Smoke on the protected surface (owner session, all gates off)

| Check                                             | Result                                                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /studio/continue`                            | 200, "Continue this campaign", no in-progress step                                                                                                                                                                       |
| "Start campaign brief" → `/studio/campaign/brief` | Rendered with header "SIGNED IN · SPEND CAPS APPEAR ON THE QUOTE"; brief completeness 6%; banner "EXECUTION BLOCKED — validation and planning remain unavailable until all required fields and rights attestations pass" |
| `/studio/campaign/canvas`                         | "Canvas unavailable — open this screen from a project with a canvas selected"                                                                                                                                            |
| `/studio/campaign/quote`                          | "Quote unavailable — open this quote from a canvas so Core can pin the expected revision"                                                                                                                                |
| Core `GET /health` (workers.dev)                  | 200, `service: mustbeviral-core`, `generation: viralgraph-cleanroom-v2`, request id, no secrets                                                                                                                          |
| Core `GET /v1/artifacts/{uuid}/content` unsigned  | **401 `UNAUTHENTICATED`** "An artifact access token is required."                                                                                                                                                        |
| Core `GET /v1/workspaces` unauthenticated         | 404 `NOT_FOUND` (route does not exist; safe envelope)                                                                                                                                                                    |
| `public.get_platform_kill_switches()`             | `signups_enabled=false`, `charging_enabled=false`, `generation_enabled=false`, `provider_routes_enabled=false` (updated 2026-09-02)                                                                                      |
| R2 `mustbeviral-v2-production-media`              | `object_count: 0`, `bucket_size: 0 B` (`wrangler r2 bucket info`, 21:22)                                                                                                                                                 |

## Database containment (Management API read at 21:21:52, after every page above)

All zero: `workspaces`, `workspace_memberships`, `projects`, `briefs`, `canvases`, `canvas_revisions`,
`quotes`, `runs`, `attempts`, `provider_jobs`, `cost_reservations`, `ledger_transactions`,
`stripe_webhook_events`, `provider_webhook_events`, `outbox_events`, `artifacts`, `api_keys`,
`audit_events`. `auth.sessions` = 1. The Studio pages did not bootstrap a workspace row, so the
"one workspace + membership row" deviation the plan pre-authorized was **not** needed: the
database holds zero customer rows and exactly one session.

## Observations for the 72-hour window

- The browser logged intermittent **503** responses on Next.js RSC prefetches
  (`/studio/campaign/{brief,access,billing,quote,review,canvas}?_rsc=…`) that succeeded on retry;
  every page rendered. Vercel runtime errors for the project in the same window: **none**; runtime
  log status codes: 200 ×24, 307 ×1. The 503s therefore did not reach a function and are most
  likely edge-side (deployment protection / SSO handshake on prefetch). Track during p3i-003;
  belongs to WP-P4-001 observability if it persists.
- Auth email landed in the Inbox this time (2026-09-03 invitation had landed in Spam).

## Window

- Smoke completed 21:22:01. **p3i-003 observation window: 2026-09-04T21:22:00Z → 2026-09-07T21:22:00Z.**
- The approved owner session is left alive (the only session). Sign-out will occur when the owner
  sets the password (the reset flow signs out every session) or at the end of the window,
  whichever comes first; both are recorded in the p3i-003 evidence.

## Not done

No run, quote, charge, signup, DNS, Worker, Vercel, migration or data mutation. No password was
entered or set by the agent.
