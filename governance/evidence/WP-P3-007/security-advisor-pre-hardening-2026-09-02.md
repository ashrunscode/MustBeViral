# Production Security Advisor pre-hardening — 2026-09-02

After the 37 repository migrations applied, project `jjgtlfblsfobdhmtngbz` remained
`ACTIVE_HEALTHY`, with 31 public tables, 52 public routines, and zero users, workspaces, projects,
runs, artifacts, billing profiles, Stripe webhook events, or storage objects.

Security Advisor returned four errors because RLS was disabled on the authenticated-read,
machine-write catalog tables `provider_registrations`, `price_catalog_versions`, `model_routes`, and
`model_route_prices`. Seven newer tables had RLS enabled but not forced: `api_keys`, `oauth_clients`,
`oauth_access_tokens`, `skills`, `skill_versions`, `stripe_webhook_events`, and
`workspace_billing_profiles`.

Two informational notices reported deny-all webhook tables with RLS and no policies. Seventeen
warnings reported authenticated access to intentional `SECURITY DEFINER` command RPCs. Those RPCs
are required by accepted architecture, use pinned search paths, derive or recheck actor/workspace
identity, and are covered by database authorization tests. They are not converted to security
invoker or removed merely to silence the Advisor.

This packet authorizes one forward-only migration,
`20260902000000_production_rls_advisor_hardening.sql`, to:

- enable and force RLS on the four global catalog tables;
- preserve their existing authenticated-read contract through explicit select-only policies;
- force RLS on the seven later user-visible or machine-owned tables; and
- add pgTAP proof that every public application table has RLS enabled and forced.

The acceptance threshold is zero Security Advisor `ERROR` findings, zero unclassified findings,
and an exact allowlist of the architecturally intentional info/warning findings above.

Reference: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).
