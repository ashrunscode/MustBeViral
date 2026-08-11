begin;

select plan(10);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '25252525-2525-4252-8252-252525252525',
  'authenticated',
  'authenticated',
  'spend-audit@example.test',
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
  '25000000-0000-4000-8000-000000000001',
  'Spend Audit Workspace',
  'spend-audit-workspace',
  '25252525-2525-4252-8252-252525252525',
  8000000,
  25000000
);

insert into public.projects (id, workspace_id, name, status, created_by)
values (
  '25000000-0000-4000-8000-000000000002',
  '25000000-0000-4000-8000-000000000001',
  'Spend Audit Project',
  'active',
  '25252525-2525-4252-8252-252525252525'
);

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values (
  '25000000-0000-4000-8000-000000000003',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000002',
  'Spend Audit Canvas',
  '25252525-2525-4252-8252-252525252525'
);

insert into public.canvas_revisions (
  id,
  workspace_id,
  canvas_id,
  graph_schema_version,
  graph_snapshot,
  canonical_hash,
  actor_type,
  actor_id,
  reason
) values (
  '25000000-0000-4000-8000-000000000004',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000003',
  1,
  '{"nodes":[{"id":"spend-audit-node"}],"edges":[]}'::jsonb,
  repeat('2', 64),
  'user',
  '25252525-2525-4252-8252-252525252525',
  'spend audit fixture'
);

update public.canvases
set head_revision_id = '25000000-0000-4000-8000-000000000004'
where id = '25000000-0000-4000-8000-000000000003';

insert into public.provider_registrations (
  id, provider_key, display_name, transport_version, status, evidence_ref
) values (
  '25000000-0000-4000-8000-000000000005',
  'spend-audit-provider',
  'Spend Audit Provider',
  '1.0.0',
  'enabled',
  'governance/evidence/WP-P0-001/golden-20-run-proof.md'
);

insert into public.price_catalog_versions (
  id, provider_registration_id, version, source_hash, source_ref, status, effective_at
) values (
  '25000000-0000-4000-8000-000000000006',
  '25000000-0000-4000-8000-000000000005',
  'spend-audit-v1',
  repeat('3', 64),
  'governance/evidence/WP-P0-001/golden-20-run-proof.md',
  'draft',
  statement_timestamp()
);

insert into public.quotes (
  id,
  workspace_id,
  project_id,
  canvas_id,
  canvas_revision_id,
  price_catalog_version_id,
  execution_plan,
  quote_hash,
  maximum_charge_micros,
  created_by,
  created_at,
  expires_at
) values
  (
    '25000000-0000-4000-8000-000000000007',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    '25000000-0000-4000-8000-000000000003',
    '25000000-0000-4000-8000-000000000004',
    '25000000-0000-4000-8000-000000000006',
    '[{"node_id":"one"}]'::jsonb,
    repeat('4', 64),
    4550000,
    '25252525-2525-4252-8252-252525252525',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 hour',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 hour 15 minutes'
  ),
  (
    '25000000-0000-4000-8000-000000000008',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    '25000000-0000-4000-8000-000000000003',
    '25000000-0000-4000-8000-000000000004',
    '25000000-0000-4000-8000-000000000006',
    '[{"node_id":"two"}]'::jsonb,
    repeat('5', 64),
    4550000,
    '25252525-2525-4252-8252-252525252525',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '2 hours',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '2 hours 15 minutes'
  );

insert into public.runs (
  id,
  workspace_id,
  project_id,
  canvas_id,
  canvas_revision_id,
  canvas_revision_hash,
  quote_id,
  status,
  confirmed_by,
  confirmed_at,
  created_at,
  updated_at
) values
  (
    '25000000-0000-4000-8000-000000000009',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    '25000000-0000-4000-8000-000000000003',
    '25000000-0000-4000-8000-000000000004',
    repeat('2', 64),
    '25000000-0000-4000-8000-000000000007',
    'succeeded',
    '25252525-2525-4252-8252-252525252525',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 hour',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 hour',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 hour'
  ),
  (
    '25000000-0000-4000-8000-000000000010',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000002',
    '25000000-0000-4000-8000-000000000003',
    '25000000-0000-4000-8000-000000000004',
    repeat('2', 64),
    '25000000-0000-4000-8000-000000000008',
    'running',
    '25252525-2525-4252-8252-252525252525',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '2 hours',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '2 hours',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '2 hours'
  );

insert into public.cost_reservations (
  id,
  workspace_id,
  quote_id,
  run_id,
  amount_micros,
  captured_micros,
  released_micros,
  status,
  created_at,
  updated_at
) values
  (
    '25000000-0000-4000-8000-000000000011',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000007',
    '25000000-0000-4000-8000-000000000009',
    4550000,
    4550000,
    0,
    'captured',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 hour',
    statement_timestamp()
  ),
  (
    '25000000-0000-4000-8000-000000000012',
    '25000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000008',
    '25000000-0000-4000-8000-000000000010',
    4550000,
    2000000,
    0,
    'partially_captured',
    date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '2 hours',
    statement_timestamp()
  );

select is(
  public.get_global_spend_exposure() ->> 'global_daily_cap_micros',
  '100000000',
  'the aggregate exposes the configured global cap in integer micros'
);
select is(
  public.get_global_spend_exposure() ->> 'global_exposure_micros',
  '9100000',
  'the aggregate exactly mirrors the start_run global exposure formula'
);
select is(
  public.get_global_spend_exposure() ->> 'global_remaining_micros',
  '90900000',
  'the aggregate reports remaining headroom without tenant rows'
);
select is(
  (public.get_global_spend_exposure() ->> 'reservation_count')::bigint,
  2::bigint,
  'the aggregate counts current UTC-day reservations'
);
select is(
  (public.get_global_spend_exposure() ->> 'unsettled_reservation_count')::bigint,
  1::bigint,
  'the aggregate identifies an incompletely settled reservation'
);
select is(
  public.get_global_spend_exposure() #>> '{status_counts,captured}',
  '1',
  'the aggregate counts captured reservations by status'
);
select is(
  public.get_global_spend_exposure() #>> '{status_counts,partially_captured}',
  '1',
  'the aggregate counts partially captured reservations by status'
);
select ok(
  (public.get_global_spend_exposure() ->> 'observed_at')::timestamptz is not null,
  'the observation carries a timestamp'
);
select ok(
  not has_function_privilege('authenticated',
    'public.get_global_spend_exposure()'::regprocedure, 'execute'),
  'authenticated users cannot execute the aggregate'
);
select ok(
  has_function_privilege('service_role',
    'public.get_global_spend_exposure()'::regprocedure, 'execute'),
  'service_role can execute the aggregate through PostgREST'
);

select * from finish();

rollback;
