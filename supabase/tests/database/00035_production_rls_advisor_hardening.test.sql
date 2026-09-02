begin;

select plan(4);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ),
  0,
  'every public application table has RLS enabled'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relforcerowsecurity
  ),
  0,
  'every public application table has RLS forced'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = any (array[
        'provider_registrations_authenticated_select',
        'price_catalog_versions_authenticated_select',
        'model_routes_authenticated_select',
        'model_route_prices_authenticated_select'
      ])
      and roles = array['authenticated']::name[]
      and cmd = 'SELECT'
  ),
  4,
  'global catalog tables preserve explicit authenticated read policies'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '9a000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'production-rls-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (
  id, name, slug, created_by, per_run_spend_cap_micros, daily_spend_cap_micros
) values (
  '9a000000-0000-4000-8000-000000000002',
  'Production RLS Probe',
  'production-rls-probe',
  '9a000000-0000-4000-8000-000000000001',
  8000000,
  25000000
);

select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000099', true);
set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.workspaces
    where id = '9a000000-0000-4000-8000-000000000002'
  ),
  0,
  'an authenticated non-member cannot read a foreign workspace'
);

reset role;

select * from finish();

rollback;
