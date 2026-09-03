# WP-P3-008 SMTP-claim revalidation — 2026-09-03

Sanitized operator evidence only. No SMTP values, API keys, tokens, invite links,
cookies, passwords, signed URLs, raw environment values, or customer data.

A dashboard claim equivalent in intent to `SMTP READY` was received after the
operator said they finished Authentication → Emails → SMTP Settings on project
`jjgtlfblsfobdhmtngbz`. The claim was not trusted. This file records the
independent read-back.

Working branch: `codex/wp-p3-008-production-foundation`.
Packet: `WP-P3-008`. Current step: `p3h-004-private-smoke-and-cutover-gate`.
Exact approved owner / invite recipient: `hello@mustbeviral.com`.
No DNS change. No PR #3 merge. No WP-P3-009 activation. No Phase 5 smoke.

## Governed preflight

- `pnpm agent:preflight` passed.
- Runtime: Node `24.18.0`, pnpm `11.12.0`.
- Branch matches the packet.
- Pending decisions: none.
- Remote destructive action: forbidden.
- Required authorities were read: `AGENTS.md`, `PROJECT_STATE.yaml`, product
  contract, release scope, system overview, data/auth/tenancy, quality gates,
  local env/secrets, deploy/rollback, legacy V1 retirement, finish-sprint
  prompt, and `docs/delivery/ACTIVE_WORK_PACKET.yaml`.

## Production containment (read-only)

Captured from Supabase MCP SQL, Cloudflare MCP bucket metadata, and anonymous
HTTP probes. Wrangler CLI remains unauthenticated. No Management API token is
present. `$HOME/.agent-secrets` is absent. Process environment has no SMTP,
Resend, or Supabase secret names.

Project `jjgtlfblsfobdhmtngbz` / `mustbeviral-prod` / `us-east-1`: `ACTIVE_HEALTHY`.

### Sanitized counts

| Item                                             | Count |
| ------------------------------------------------ | ----- |
| Auth users                                       | 0     |
| Auth identities                                  | 0     |
| Auth sessions                                    | 0     |
| Auth refresh tokens                              | 0     |
| Approved-email matches (`hello@mustbeviral.com`) | 0     |
| Workspaces                                       | 0     |
| Workspace memberships                            | 0     |
| Projects                                         | 0     |
| Artifacts                                        | 0     |
| Runs                                             | 0     |
| Attempts                                         | 0     |
| Provider jobs                                    | 0     |
| Outbox events                                    | 0     |
| Quotes                                           | 0     |
| Cost reservations                                | 0     |
| Ledger transactions                              | 0     |
| Stripe webhook events                            | 0     |
| Workspace billing profiles                       | 0     |

### Kill switches

`app_private.platform_kill_switches` singleton:

- `signups_enabled`: false
- `generation_enabled`: false
- `provider_routes_enabled`: false
- `charging_enabled`: false

### HTTP and DNS surface

- Protected alias `https://mustbeviral-web-production-ashrunscode-projects.vercel.app/`
  returns 302 to Vercel SSO with `X-Robots-Tag: noindex`.
- Removed short alias `https://mustbeviral-web-production.vercel.app/` returns 404.
- Legacy `mustbeviral.com` and `www.mustbeviral.com` return 200.
- `api.mustbeviral.com` remains unresolved.
- Core `GET /health` returns 200.
- Unsigned artifact content request returns 401 `UNAUTHENTICATED`.
- Named public probe `https://mustbeviral-v2-production-media.r2.dev/` returns 500,
  not a public listing.
- Production R2 bucket `mustbeviral-v2-production-media` still exists.
- Object count was not re-listed. Last proven count remains 0 objects.

## Auth config read-back (booleans only)

Official read path: Management API
`GET /v1/projects/{ref}/config/auth`
(`https://supabase.com/docs/reference/api/v1-get-auth-service-config`).
That endpoint returns `smtp_host`, `smtp_user`, `smtp_pass`,
`smtp_admin_email`, `smtp_port`, `smtp_sender_name`, `disable_signup`,
`mailer_autoconfirm`, `site_url`, and `uri_allow_list`.

This environment cannot complete that GET:

- `SUPABASE_ACCESS_TOKEN` absent.
- Unauthenticated Management API GET returned HTTP 401 and no SMTP keys.
- Supabase MCP has no Auth-config tool.
- `auth.instances` exists but has 0 rows, so Postgres cannot supply SMTP
  presence booleans.
- Unauthenticated `GET /auth/v1/settings` returned HTTP 401.
- Auth logs in the last ~24h: 14 rows; smtp mentions 0; mailer mentions 0;
  invite mentions 0. One unrelated `custom` mention had smtp=0.

Recorded booleans:

- Custom SMTP present: false (unproven; not independently readable)
- Host present: false (unproven)
- User present: false (unproven)
- Sender present: false (unproven)
- Secure transport configured: false (unproven)

A dashboard claim is not accepted as proof. Closed-enrollment values were not
re-read from Management API this run. The last proven snapshot remains
2026-09-02: `disable_signup=true`, `mailer_autoconfirm=false`, site/callback
naming only the protected Vercel alias and `/auth/callback`.

## Invitation

Not attempted. Pre-send gates that failed closed:

- SMTP not independently proven configured.
- Auth users 0; exact-email matches 0; workspaces 0.
- Official current `inviteUserByEmail` documentation states
  “PKCE is not supported when using `inviteUserByEmail`”
  (`https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail`).
- Official SSR advanced guide lists PKCE support for Magic Link, OAuth, Sign Up,
  and Password Recovery only
  (`https://supabase.com/docs/guides/auth/server-side/advanced-guide`).
- Deployed `apps/web/app/auth/callback/route.ts` only calls
  `exchangeCodeForSession` when a `code` query parameter is present. Missing
  `code` becomes `auth_link_failed`. No `token_hash` / `verifyOtp` path exists.
- No second callback origin was invented. The already-allowlisted protected
  callback remains
  `https://mustbeviral-web-production-ashrunscode-projects.vercel.app/auth/callback`.

Invitation attempted: false.
Success known: false.
Auth-user count after: 0.
Exact-email match count after: 0.
Sanitized subject fingerprint: n/a (no mailer event).
Timestamp: n/a.

The single authorized invitation attempt remains unused. A second email is not
authorized. JWT/RLS proofs remain N/A because `SIGNED IN` has not occurred.

## Zero-spend and no-mutation

No test email, no invite, no generation, provider job, queue, cron, charge,
Stripe, ledger, customer admission, public R2, DNS, custom-domain, org/team
add, or Legacy V1 mutation was performed.

## PR #3 (read-only)

Head at evidence time tracked `codex/wp-p3-008-production-foundation`.
GitHub may report `MERGEABLE` + `UNSTABLE`. Governance mergeability remains
NO-GO because inherited workflow files sit outside base packet `WP-R0-002`,
pgTAP still fails `00029` / `00032` / `00034`, and GitGuardian is
`NEUTRAL`/skipping. `00036` remains ok. Not merged.
