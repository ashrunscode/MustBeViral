begin;

select plan(12);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and tablename = any (array[
        'workspaces', 'workspace_memberships', 'briefs', 'brand_kits', 'projects',
        'canvases', 'canvas_revisions', 'provider_registrations', 'price_catalog_versions',
        'model_routes', 'model_route_prices', 'quotes', 'runs', 'run_nodes', 'attempts',
        'provider_jobs', 'artifacts', 'artifact_lineage', 'cost_reservations',
        'ledger_transactions', 'idempotency_records', 'audit_events', 'outbox_events'
      ])
  ),
  23,
  'all authoritative P0 tables exist after the forward migration sequence'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'workspaces', 'workspace_memberships', 'briefs', 'brand_kits', 'projects',
        'canvases', 'canvas_revisions', 'quotes', 'runs', 'run_nodes', 'attempts',
        'provider_jobs', 'artifacts', 'artifact_lineage', 'cost_reservations',
        'ledger_transactions', 'idempotency_records', 'audit_events', 'outbox_events'
      ])
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ),
  19,
  'every tenant-owned table has RLS enabled and forced'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'workspaces', 'workspace_memberships', 'briefs', 'brand_kits', 'projects',
        'canvases', 'canvas_revisions', 'quotes', 'runs', 'run_nodes', 'attempts',
        'provider_jobs', 'artifacts', 'artifact_lineage', 'cost_reservations',
        'ledger_transactions', 'idempotency_records', 'audit_events', 'outbox_events'
      ])
      and not relation.relrowsecurity
  ),
  0,
  'no tenant table is left outside RLS'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname like 'mustbeviral%'
      and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)
  ),
  'no MustBeViral application role has elevated or BYPASSRLS privileges'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'authenticated'
      and not rolsuper
      and not rolbypassrls
      and not rolcreaterole
      and not rolcreatedb
  ),
  'authenticated is a limited non-BYPASSRLS role'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_tables as product_table
    where product_table.schemaname = 'public'
      and product_table.tablename = any (array[
        'workspaces', 'workspace_memberships', 'briefs', 'brand_kits', 'projects',
        'canvases', 'canvas_revisions', 'provider_registrations', 'price_catalog_versions',
        'model_routes', 'model_route_prices', 'quotes', 'runs', 'run_nodes', 'attempts',
        'provider_jobs', 'artifacts', 'artifact_lineage', 'cost_reservations',
        'ledger_transactions', 'idempotency_records', 'audit_events', 'outbox_events'
      ])
      and (
        has_table_privilege('service_role', format('%I.%I', product_table.schemaname, product_table.tablename), 'SELECT')
        or has_table_privilege('service_role', format('%I.%I', product_table.schemaname, product_table.tablename), 'INSERT')
        or has_table_privilege('service_role', format('%I.%I', product_table.schemaname, product_table.tablename), 'UPDATE')
        or has_table_privilege('service_role', format('%I.%I', product_table.schemaname, product_table.tablename), 'DELETE')
      )
  ),
  0,
  'managed service_role has no direct product-table privilege'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any (array[
        'create_workspace',
        'create_canvas_with_revision',
        'apply_canvas_revision',
        'start_run_barrier',
        'record_ledger_movement'
      ])
      and procedure.prosecdef
      and 'search_path=pg_catalog' = any (coalesce(procedure.proconfig, '{}'::text[]))
  ),
  5,
  'all five multi-row authority RPCs are SECURITY DEFINER with a pinned search_path'
);

select ok(
  not has_function_privilege(
    'public',
    'public.create_workspace(text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.start_run_barrier(uuid,uuid,uuid,uuid,boolean,text,text)',
    'EXECUTE'
  ),
  'public and anon cannot execute authenticated command RPCs'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_workspace(text,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.apply_canvas_revision(uuid,uuid,uuid,integer,jsonb,text,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.start_run_barrier(uuid,uuid,uuid,uuid,boolean,text,text)',
    'EXECUTE'
  ),
  'authenticated can execute only the JWT-derived user command RPCs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_ledger_movement(uuid,text,bigint,text,uuid,uuid,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.record_ledger_movement(uuid,text,bigint,text,uuid,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'the semantic ledger writer is machine-only'
);

select ok(
  has_table_privilege('authenticated', 'public.provider_registrations', 'SELECT')
  and not has_table_privilege('authenticated', 'public.provider_registrations', 'INSERT')
  and has_table_privilege('authenticated', 'public.model_route_prices', 'SELECT')
  and not has_table_privilege('authenticated', 'public.model_route_prices', 'UPDATE'),
  'provider and price catalog tables are authenticated-read and machine-write only'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'workspaces', 'workspace_memberships', 'briefs', 'brand_kits', 'projects',
        'canvases', 'canvas_revisions', 'quotes', 'runs', 'run_nodes', 'attempts',
        'provider_jobs', 'artifacts', 'artifact_lineage', 'cost_reservations',
        'ledger_transactions', 'idempotency_records', 'audit_events', 'outbox_events'
      ])
      and cmd = 'SELECT'
  ),
  19,
  'every tenant table has an explicit authenticated read policy'
);

select * from finish();

rollback;
