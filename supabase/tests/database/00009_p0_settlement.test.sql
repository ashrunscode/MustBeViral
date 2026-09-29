begin;

select plan(9);

create or replace function pg_temp.error_of(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000:';
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

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
  '88800000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'settlement-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '88810000-0000-4000-8000-000000000001',
  'Settlement Workspace',
  'settlement-workspace',
  '88800000-0000-4000-8000-000000000001'
);

insert into public.projects (id, workspace_id, name, status, created_by)
values (
  '88820000-0000-4000-8000-000000000001',
  '88810000-0000-4000-8000-000000000001',
  'Settlement Project',
  'active',
  '88800000-0000-4000-8000-000000000001'
);

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values (
  '88830000-0000-4000-8000-000000000001',
  '88810000-0000-4000-8000-000000000001',
  '88820000-0000-4000-8000-000000000001',
  'Settlement Canvas',
  '88800000-0000-4000-8000-000000000001'
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
  '88840000-0000-4000-8000-000000000001',
  '88810000-0000-4000-8000-000000000001',
  '88830000-0000-4000-8000-000000000001',
  1,
  '{"nodes":[{"id":"settlement-node"}],"edges":[]}'::jsonb,
  repeat('8', 64),
  'user',
  '88800000-0000-4000-8000-000000000001',
  'settlement fixture'
);

update public.canvases
set head_revision_id = '88840000-0000-4000-8000-000000000001'
where id = '88830000-0000-4000-8000-000000000001';

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
) values (
  '88850000-0000-4000-8000-000000000001',
  '88810000-0000-4000-8000-000000000001',
  '88820000-0000-4000-8000-000000000001',
  '88830000-0000-4000-8000-000000000001',
  '88840000-0000-4000-8000-000000000001',
  '0c000000-0000-4000-8000-000000000001',
  '[{"node_id":"settlement-node","ready":true}]'::jsonb,
  repeat('9', 64),
  1000000,
  '88800000-0000-4000-8000-000000000001',
  statement_timestamp(),
  statement_timestamp() + interval '15 minutes'
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
  confirmed_by
) values (
  '88860000-0000-4000-8000-000000000001',
  '88810000-0000-4000-8000-000000000001',
  '88820000-0000-4000-8000-000000000001',
  '88830000-0000-4000-8000-000000000001',
  '88840000-0000-4000-8000-000000000001',
  repeat('8', 64),
  '88850000-0000-4000-8000-000000000001',
  'running',
  '88800000-0000-4000-8000-000000000001'
);

insert into public.cost_reservations (
  id,
  workspace_id,
  quote_id,
  run_id,
  amount_micros
) values (
  '88870000-0000-4000-8000-000000000001',
  '88810000-0000-4000-8000-000000000001',
  '88850000-0000-4000-8000-000000000001',
  '88860000-0000-4000-8000-000000000001',
  1000000
);

select is(
  (public.record_ledger_movement(
    '88810000-0000-4000-8000-000000000001',
    'reserve',
    1000000,
    'run:88860000-0000-4000-8000-000000000001:reserve',
    '88870000-0000-4000-8000-000000000001',
    '88860000-0000-4000-8000-000000000001',
    'request-settlement-reserve',
    '{}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'the authoritative reservation is recorded once'
);

select is(
  (public.record_ledger_movement(
    '88810000-0000-4000-8000-000000000001',
    'capture',
    250000,
    'run:88860000-0000-4000-8000-000000000001:attempt:attempt-a:capture',
    '88870000-0000-4000-8000-000000000001',
    '88860000-0000-4000-8000-000000000001',
    'request-settlement-capture-a',
    '{"attempt_id":"attempt-a"}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'the first successful attempt is captured independently'
);

select is(
  (public.record_ledger_movement(
    '88810000-0000-4000-8000-000000000001',
    'capture',
    350000,
    'run:88860000-0000-4000-8000-000000000001:attempt:attempt-c:capture',
    '88870000-0000-4000-8000-000000000001',
    '88860000-0000-4000-8000-000000000001',
    'request-settlement-capture-c',
    '{"attempt_id":"attempt-c"}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'a second successful attempt is captured independently'
);

select is(
  (public.record_ledger_movement(
    '88810000-0000-4000-8000-000000000001',
    'release',
    400000,
    'run:88860000-0000-4000-8000-000000000001:settlement:release',
    '88870000-0000-4000-8000-000000000001',
    '88860000-0000-4000-8000-000000000001',
    'request-settlement-release',
    '{"reason":"attempt_remainder"}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'the exact failed-attempt remainder is released'
);

select is(
  (
    select captured_micros
    from public.cost_reservations
    where id = '88870000-0000-4000-8000-000000000001'
  ),
  600000::bigint,
  'the reservation records the sum of per-attempt captures'
);

select is(
  (
    select released_micros
    from public.cost_reservations
    where id = '88870000-0000-4000-8000-000000000001'
  ),
  400000::bigint,
  'the reservation records the exact release remainder'
);

select is(
  (
    select amount_micros - captured_micros - released_micros
    from public.cost_reservations
    where id = '88870000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'a fully settled partial-success run leaves zero residual reservation'
);

select is(
  (
    select status
    from public.cost_reservations
    where id = '88870000-0000-4000-8000-000000000001'
  ),
  'partially_captured',
  'partial capture plus full remainder release has the expected terminal accounting state'
);

select is(
  pg_temp.error_of($sql$
    select public.record_ledger_movement(
      '88810000-0000-4000-8000-000000000001',
      'capture',
      1,
      'run:88860000-0000-4000-8000-000000000001:attempt:attempt-over:capture',
      '88870000-0000-4000-8000-000000000001',
      '88860000-0000-4000-8000-000000000001',
      'request-settlement-capture-over',
      '{}'::jsonb
    )
  $sql$),
  '23514:CAPTURE_EXCEEDS_RESERVATION',
  'capture exceeding the reservation is rejected'
);

select * from finish();

rollback;
