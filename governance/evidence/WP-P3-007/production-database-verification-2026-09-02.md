# Production database verification — 2026-09-02

## Outcome

Project `jjgtlfblsfobdhmtngbz` (`mustbeviral-prod`, `us-east-1`) is `ACTIVE_HEALTHY` on Postgres
`17.6.1.166`. Supabase CLI and authenticated provider reads show exactly 38 applied migrations. The
last is `20260902000000_production_rls_advisor_hardening`; the final 38-file aggregate SHA-256 is
`34ac936bf339a5f24c84bfd36a599cc5cb7fc37fe886b17da91b02df2e147e74`.

The first push transactionally stopped at a malformed `GET DIAGNOSTICS` expression. The source fix
and idempotency tests were committed before the CLI resumed the remaining six migrations. A
separate forward-only hardening migration was committed before it was applied.

## Security proof

Authenticated catalog queries returned:

- public application tables: 31;
- RLS disabled: 0;
- RLS enabled but not forced: 0;
- security-definer routines without a pinned search path: 0;
- Auth users, workspaces, runs, and storage objects: 0 each;
- Auth `disable_signup=true` and `mailer_autoconfirm=false`;
- no production client, SMTP, Worker, web deployment, or DNS binding.

Security Advisor returned 0 errors. Its remaining 19 findings exactly match the recorded allowlist:
two informational deny-all webhook-table notices and 17 warnings for intentional authenticated
command RPCs. Those commands are security-definer by accepted design, pin their search path, and
perform JWT-derived membership/authorization checks; removing authenticated execution would break
the shared command path.

The production CLI's temporary login is denied `USAGE` on the `extensions` schema, so remote pgTAP
could not call `plan()`. That least-privilege boundary was preserved. Structural remote queries
proved RLS/force-RLS and safe search paths; the repository pgTAP suite retains the cross-tenant and
new hardening assertions. The full local suite requires an isolated Docker port because another
local Supabase project currently owns port 54322.

## Performance Advisor disposition

The empty database reports 66 non-security findings: 32 unindexed foreign keys, six Auth RLS
initialization-plan warnings, 27 unused indexes, and one absolute Auth connection-allocation notice.
Unused-index signals are not meaningful before traffic. The binding successor must classify and
repair justified foreign-key/RLS-plan items before any traffic; the Auth connection strategy must be
rechecked before an instance-size increase.

## Containment

Only the named project was migrated. No seed/customer data, invite, signup, charge, provider run,
application binding, public route, DNS change, or legacy mutation occurred. Rollback remains
isolation and forward repair; deletion and migration-history rewriting remain prohibited.

References: [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations),
[database linter](https://supabase.com/docs/guides/database/database-linter).
