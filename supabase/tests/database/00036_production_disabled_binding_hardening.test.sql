begin;

select plan(3);

select is(
  (
    select jsonb_build_object(
      'signups_enabled', signups_enabled,
      'generation_enabled', generation_enabled,
      'provider_routes_enabled', provider_routes_enabled,
      'charging_enabled', charging_enabled
    )
    from app_private.platform_kill_switches
    where singleton
  ),
  '{"signups_enabled": false, "generation_enabled": false, "provider_routes_enabled": false, "charging_enabled": false}'::jsonb,
  'production behavior defaults remain disabled'
);

select is(
  (
    with foreign_keys as (
      select
        constraint_row.conrelid,
        constraint_row.conkey::smallint[] as key_columns
      from pg_catalog.pg_constraint as constraint_row
      join pg_catalog.pg_class as relation on relation.oid = constraint_row.conrelid
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where constraint_row.contype = 'f'
        and namespace.nspname = 'public'
    )
    select count(*)::integer
    from foreign_keys as foreign_key
    where not exists (
      select 1
      from pg_catalog.pg_index as index_row
      where index_row.indrelid = foreign_key.conrelid
        and index_row.indisvalid
        and index_row.indisready
        and (index_row.indkey::smallint[])[0:cardinality(foreign_key.key_columns) - 1]
          = foreign_key.key_columns
    )
  ),
  0,
  'every public foreign key has a covering index'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname = any (array[
        'workspace_billing_profiles_select',
        'api_keys_owner_select',
        'oauth_clients_owner_select',
        'oauth_access_tokens_owner_select',
        'skills_member_select',
        'skill_versions_member_select'
      ])
      and qual ilike '%SELECT auth.uid()%'
  ),
  6,
  'all affected policies cache auth.uid through an init plan'
);

select * from finish();

rollback;
