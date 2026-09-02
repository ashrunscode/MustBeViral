# Production Supabase project evidence — 2026-09-02

## Result

- Status: `LIVE` (authenticated Supabase provider and CLI reads)
- Project name: `mustbeviral-prod`
- Project ref: `jjgtlfblsfobdhmtngbz`
- Organization: `cwsipbaunvifcpgoygsc`
- Region: `us-east-1`
- Provider status: `ACTIVE_HEALTHY`
- Created at: `2026-09-02T13:38:29.142748Z`
- Postgres version: `17.6.1.166`
- Operator-approved recurring cost: USD 10 monthly

The project was created only after the operator's separate cost approval recorded in
`governance/evidence/WP-P3-005/supabase-cost-approval-2026-09-02.md`. The provider-issued cost
confirmation value and all database/API credentials were intentionally not recorded.

## Authenticated identity checks

- Supabase project detail returned the exact name, ref, organization, region, creation time,
  Postgres version, and healthy status above.
- Repository-pinned Supabase CLI `projects list --output json` returned exactly one matching project
  with the same identity and status.
- The project API URL exists. Its value was not recorded because this packet does not bind a client.
- One enabled modern publishable key and one enabled legacy publishable key exist. No key value was
  printed or persisted.

## Empty-before-migration proof

Authenticated read-only inspection returned:

| Check                     | Result |
| ------------------------- | -----: |
| Applied migration history |      0 |
| `public` base tables      |      0 |
| `public` routines         |      0 |
| Auth users                |      0 |
| Storage objects           |      0 |

No MustBeViral migration, table, user, storage payload, seed data, customer data, or application
binding was created in this packet.

## Fail-closed enrollment correction

The provider's fresh-project default initially returned `disable_signup=false`. That contradicted
this packet's no-production-signup boundary. The official Supabase Management API auth-config
endpoint was used to set only `disable_signup=true`; an immediate authenticated read-back returned
`true`.

- External email provider remains present, but new user signup is disabled.
- Email auto-confirm remains disabled.
- Auth site URL remains the unused provider default `http://localhost:3000`; it is not a production
  callback and no production client is bound.
- Manual identity linking remains disabled.

Reference: [Supabase Management API auth config](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

## Data API and Advisor posture

- PostgREST currently reports `public,graphql_public` as exposed schemas, `public, extensions` as
  the extra search path, and a maximum of 1,000 rows.
- Because `public` contains zero application tables, the current Data API exposes no MustBeViral
  rows. The migration successor must prove RLS, grants, RPC execution rights, and cross-tenant
  denial before any client binding.
- Security Advisor findings: 0.
- Performance Advisor findings: 1 informational item,
  `auth_db_connections_absolute`. It recommends percentage-based Auth connection allocation before
  scaling the instance; it is not evidence of an application table or security exposure.

References: [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api),
[production readiness](https://supabase.com/docs/guides/deployment/going-into-prod).

## Containment

- No migration or DDL was applied.
- No web, Worker, DNS, Hyperdrive, Stripe, provider, SMTP, or telemetry configuration was pointed at
  this project.
- No customer traffic, invitation, charge, provider run, or data import occurred.
- No unrelated Supabase project was changed.
- Rollback remains isolation: keep the project unused and fix forward. Project deletion is not
  authorized.

Evidence captured at `2026-09-02T13:48:48Z` from repository commit
`7c258a4221dd6aa2a0c30f38a5605eda6dfbcf3c`.
