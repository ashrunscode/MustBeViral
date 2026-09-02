begin;

select plan(3);

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

select * from finish();

rollback;
