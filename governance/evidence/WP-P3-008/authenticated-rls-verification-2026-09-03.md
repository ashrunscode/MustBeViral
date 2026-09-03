# WP-P3-008 database and RLS verification, 2026-09-03

Closes the `database/RLS connectivity` clause of deliverable 4, which
`production-binding-and-smoke-2026-09-02.md` ("Status update, 2026-09-03") recorded as the single
unproven clause of `exact-disabled-production`.

Identifiers, row counts, HTTP status codes, and booleans only. No service-role key, database
password, SMTP password, Resend API key, session token, or signed URL is recorded here or was
printed while producing this evidence.

## What changed since the 2026-09-03 SMTP evidence

`smtp-delivery-verification-2026-09-03.md` recorded this verification boundary:

> the `supabase` MCP server available in this session is bound to project `gqnpqnlpybjeesahqmkj`,
> a different product's database ... Closing this gap needs a sanitized count run by the operator
> or by a session holding those credentials.

The operator has since rebound the `supabase` MCP server to project `jjgtlfblsfobdhmtngbz`. That
gap is now closed. Every fact previously marked "operator-reported, not independently verified" and
concerning database state has been re-read first-hand in this session.

**The reads are provably against production.** The MCP server reports its project URL as
`https://jjgtlfblsfobdhmtngbz.supabase.co`. That is byte-for-byte the `SUPABASE_URL` the deployed
production Worker is configured with in `apps/core/wrangler.jsonc` under `env.production`, which
`governance/tests/production-release-config-gate.test.mjs` pins. The reads below are therefore
against the same database production uses, not a lookalike.

## Method, and what was deliberately not done

- Provider reads were performed with the MCP server's own credential. No key value was retrieved,
  printed, or written.
- RLS enforcement was tested by role simulation inside explicitly rolled-back transactions
  (`begin; set local role ...; select count(*); rollback;`). **Zero rows were written, updated, or
  deleted.**
- The REST checks used the project's publishable key, which is public by design and is shipped in
  browser bundles. Its value is not recorded here.
- **A live signup attempt was deliberately not made.** It is the one probe whose failure mode --
  succeeding -- would create the customer row this packet forbids. Closed enrollment is instead
  proven by three independent reads that carry no such risk: the Management API `disable_signup`
  read of 2026-09-03, the `signups_enabled` platform kill switch, and `auth.users` still holding
  exactly one row at the end of this session.

## Auth state, verified first-hand

`auth.users` holds exactly one row:

| Field                      | Value                                  |
| -------------------------- | -------------------------------------- |
| `id`                       | `574eaf95-316b-4cf1-bea1-70bd199292f3` |
| `email`                    | `hello@mustbeviral.com`                |
| `role`                     | `authenticated`                        |
| `invited_at`               | `2026-09-03 16:37:01Z`                 |
| `confirmed_at`             | `null`                                 |
| `email_confirmed_at`       | `null`                                 |
| `last_sign_in_at`          | `null`                                 |
| encrypted password present | `false`                                |

This independently confirms the previously operator-reported claims: the invitation was created at
`16:37:02Z`, the user id matches the one the operator reported, and the invitation is pending
acceptance. `auth.sessions` holds `0` rows, so production Auth has never had a signed-in session.

`auth.one_time_tokens` holds exactly one `confirmation_token` for `hello@mustbeviral.com`, created
`2026-09-03 16:37:02Z`. At the time of this evidence it was roughly 6h45m old and therefore still
inside Supabase's default 24-hour email-OTP expiry. **No invitation was resent**, because the
existing one is still valid; resending would have been a second authorized-email action the packet
does not need.

## RLS structure

All 31 tables in `public` have both `relrowsecurity` and `relforcerowsecurity` set. `FORCE` matters
here: it means RLS applies even to the table owner, so a mistake in a privileged code path cannot
silently bypass tenancy.

Two tables carry zero policies -- `provider_webhook_events` and `stripe_webhook_events`. With RLS
enabled and no policy, Postgres denies all non-superuser access, so these are deny-all
service-role-only ledgers. That is the intended posture, not a gap. The Security Advisor reports
both as `rls_enabled_no_policy` at level **INFO**; they are correctly configured, not findings.

Tenant tables gate on `app_private.is_workspace_member(...)` / `app_private.is_workspace_owner(...)`.

## RLS enforcement, tested rather than inferred

As role `authenticated` carrying the owner's `sub` claim and holding no workspace membership:

| Table                    | Rows present (service role) | Rows visible |
| ------------------------ | --------------------------- | ------------ |
| `workspaces`             | 0                           | 0            |
| `workspace_memberships`  | 0                           | 0            |
| `artifacts`              | 0                           | 0            |
| `ledger_transactions`    | 0                           | 0            |
| `api_keys`               | 0                           | 0            |
| `provider_registrations` | 4                           | 4            |
| `model_routes`           | 5                           | 5            |
| `model_route_prices`     | 8                           | 8            |
| `price_catalog_versions` | 2                           | 2            |

The four readable tables are **deliberate global reference data**, not a leak. Each carries a single
explicitly named read-only policy -- `provider_registrations_authenticated_select`,
`model_routes_authenticated_select`, `model_route_prices_authenticated_select`,
`price_catalog_versions_authenticated_select` -- scoped to `SELECT` only (`polcmd = 'r'`) and to the
`authenticated` role. Their columns were enumerated and hold no credential material: provider rows
carry `provider_key`, `display_name`, `status`, and `evidence_ref`; price rows carry list prices in
integer micros. No secret, token, or customer datum is exposed.

Tenant-scoped tables returned zero rows, which is the isolation property the packet cares about.

## Anonymous access, denied twice over

As role `anon`, every table tested failed at the **grant** layer before RLS was ever consulted:
`42501 permission denied`. `anon` holds no `SELECT` grant anywhere in `public`, including the
catalog tables readable to `authenticated`. That is defence in depth -- a future policy mistake
still would not expose data to unauthenticated callers.

Confirmed end-to-end through the real PostgREST path with the publishable key, which is how a
browser would actually reach the database:

| `GET /rest/v1/...`       | HTTP | Code    |
| ------------------------ | ---- | ------- |
| `workspaces`             | 401  | `42501` |
| `workspace_memberships`  | 401  | `42501` |
| `artifacts`              | 401  | `42501` |
| `ledger_transactions`    | 401  | `42501` |
| `api_keys`               | 401  | `42501` |
| `model_routes`           | 401  | `42501` |
| `provider_registrations` | 401  | `42501` |

The REST results agree exactly with the direct-SQL results. That agreement is the point of running
both: PostgREST connects _as_ the `anon` role, so a divergence would have meant a grant or policy
that behaves differently over the API than in the database.

## Feature gates, read from production

`public.get_platform_kill_switches()` returns, as of `2026-09-02T15:47:59Z`:

| Switch                    | Value   |
| ------------------------- | ------- |
| `signups_enabled`         | `false` |
| `charging_enabled`        | `false` |
| `generation_enabled`      | `false` |
| `provider_routes_enabled` | `false` |

All customer, provider, generation, and charging behavior is off.

## HTTP smoke, re-run 2026-09-03

| Probe                                       | Result                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- |
| Core `/health`                              | `200`, generation `viralgraph-cleanroom-v2`, request id, no secrets |
| Core `/v1/artifacts/{uuid}` unauthenticated | `401 UNAUTHENTICATED`, safe error envelope                          |
| Supabase `/auth/v1/health`                  | `200`, GoTrue `v2.196.0`                                            |
| Vercel production alias                     | `302` (SSO redirect, alias remains SSO-protected)                   |
| `https://mustbeviral.com`                   | `200`, legacy Cloudflare surface unchanged                          |
| `https://api.mustbeviral.com`               | unresolvable, NXDOMAIN confirmed again                              |

## Containment: no customer or provider work was created

Every customer, run, money, and provider table reads `0` rows at the close of this session:
`workspaces`, `workspace_memberships`, `briefs`, `brand_kits`, `projects`, `canvases`,
`canvas_revisions`, `quotes`, `runs`, `run_nodes`, `attempts`, `provider_jobs`, `artifacts`,
`artifact_lineage`, `cost_reservations`, `ledger_transactions`, `idempotency_records`,
`audit_events`, `outbox_events`, `provider_webhook_events`, `stripe_webhook_events`,
`workspace_billing_profiles`, `api_keys`, `oauth_clients`, `oauth_access_tokens`, `skills`,
`skill_versions`. `auth.users` remains at exactly one row -- the approved owner identity.

## What this proves, and what it does not

**Proven.** Exact production bindings; healthy Core, Auth, and web deployments; closed enrollment;
private artifact denial; all spend and traffic gates disabled; database reachability; and RLS
enforcement verified both in-database and through the live REST API. Every clause of
`exact-disabled-production` as written is met by provider reads and HTTP smoke.

**Not proven, and stated plainly.** No end-user session has ever existed on production Auth. The
RLS proof above is structural -- service-role reads plus role simulation plus live anonymous denial
-- rather than a signed-in owner session. It establishes that tenancy is enforced; it does not
establish that the owner credential works end-to-end through GoTrue to PostgREST, because no owner
credential exists yet.

That residual is an **operational** matter, not an acceptance gap for this packet: the criterion
asks that provider reads and HTTP smoke prove the disabled-production posture, and they do. It is
carried forward as a named risk below rather than folded into a passing criterion.

## Carried-forward risk: owner lockout

`hello@mustbeviral.com` has never signed in, holds no password, and its invitation expires roughly
24 hours after `2026-09-03 16:37:02Z`. The invitation was delivered to the Gmail **Spam** folder, as
recorded in `smtp-delivery-verification-2026-09-03.md`. If the token expires unaccepted, the
production project retains no owner-level application credential and a fresh invitation must be
issued. Accepting it requires setting a password, which is an operator action; no agent should
perform it.
