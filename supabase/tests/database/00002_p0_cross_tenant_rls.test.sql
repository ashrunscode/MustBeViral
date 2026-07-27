begin;

select plan(81);

create or replace function pg_temp.sqlstate_of(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000';
exception when others then
  return sqlstate;
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
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'authenticated',
    'authenticated',
    'tenant-a@example.test',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'authenticated',
    'authenticated',
    'tenant-b@example.test',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

insert into public.workspaces (id, name, slug, created_by) values
  (
    '10000000-0000-4000-8000-000000000001',
    'Tenant A',
    'tenant-a',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Tenant B',
    'tenant-b',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
  );

insert into public.workspace_memberships (id, workspace_id, user_id) values
  (
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  (
    '20000000-0000-4000-8000-000000000012',
    '20000000-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
  );

insert into public.provider_registrations (
  id, provider_key, display_name, transport_version, status, evidence_ref
) values (
  '30000000-0000-4000-8000-000000000001',
  'fixture-provider',
  'Fixture Provider',
  '1.0.0',
  'enabled',
  'governance/evidence/test-provider'
);

insert into public.price_catalog_versions (
  id,
  provider_registration_id,
  version,
  source_hash,
  source_ref,
  status,
  effective_at
) values (
  '31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'fixture-v1',
  repeat('a', 64),
  'governance/evidence/test-price',
  'draft',
  statement_timestamp()
);

insert into public.model_routes (
  id,
  provider_registration_id,
  route_key,
  provider_model_id,
  driver_version,
  capability,
  status,
  input_schema_version,
  output_schema_version
) values (
  '32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'fixture.image',
  'fixture/image',
  '1.0.0',
  'image',
  'enabled',
  1,
  1
);

insert into public.model_route_prices (
  id, price_catalog_version_id, model_route_id, unit, unit_price_micros
) values (
  '33000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  'image',
  1000000
);

insert into public.briefs (
  id, workspace_id, title, brief_data, created_by
) values (
  '11000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Tenant A brief',
  '{}'::jsonb,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);

insert into public.brand_kits (
  id, workspace_id, name, kit_data, created_by
) values (
  '11100000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Tenant A kit',
  '{}'::jsonb,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);

insert into public.projects (
  id, workspace_id, brief_id, brand_kit_id, name, status, created_by
) values (
  '11200000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '11100000-0000-4000-8000-000000000001',
  'Tenant A project',
  'active',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);

insert into public.canvases (
  id, workspace_id, project_id, name, created_by
) values (
  '11300000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11200000-0000-4000-8000-000000000001',
  'Tenant A canvas',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
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
  '11400000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11300000-0000-4000-8000-000000000001',
  1,
  '{"nodes":[],"edges":[]}'::jsonb,
  repeat('b', 64),
  'user',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'fixture root'
);

update public.canvases
set head_revision_id = '11400000-0000-4000-8000-000000000001'
where id = '11300000-0000-4000-8000-000000000001';

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
  '11500000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11200000-0000-4000-8000-000000000001',
  '11300000-0000-4000-8000-000000000001',
  '11400000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  '[{"node_id":"node-1","model_route_id":"32000000-0000-4000-8000-000000000001","ready":true}]'::jsonb,
  repeat('c', 64),
  1000000,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
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
  confirmed_by
) values (
  '11600000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11200000-0000-4000-8000-000000000001',
  '11300000-0000-4000-8000-000000000001',
  '11400000-0000-4000-8000-000000000001',
  repeat('b', 64),
  '11500000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
);

insert into public.run_nodes (
  id, workspace_id, run_id, node_key, model_route_id, status
) values (
  '11700000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11600000-0000-4000-8000-000000000001',
  'node-1',
  '32000000-0000-4000-8000-000000000001',
  'ready'
);

insert into public.attempts (
  id,
  workspace_id,
  run_id,
  run_node_id,
  provider_registration_id,
  attempt_number,
  request_id
) values (
  '11800000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11600000-0000-4000-8000-000000000001',
  '11700000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  1,
  'fixture-attempt-1'
);

insert into public.provider_jobs (
  id,
  workspace_id,
  run_id,
  attempt_id,
  provider_registration_id,
  provider_request_id,
  request_hash
) values (
  '11900000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11600000-0000-4000-8000-000000000001',
  '11800000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'provider-request-1',
  repeat('d', 64)
);

insert into public.artifacts (
  id,
  workspace_id,
  project_id,
  run_id,
  canvas_revision_id,
  artifact_kind,
  status,
  object_key,
  content_hash,
  mime_type,
  byte_size
) values
  (
    '12000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '11200000-0000-4000-8000-000000000001',
    '11600000-0000-4000-8000-000000000001',
    '11400000-0000-4000-8000-000000000001',
    'input',
    'available',
    'private/tenant-a/input-1',
    repeat('e', 64),
    'image/png',
    100
  ),
  (
    '12100000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '11200000-0000-4000-8000-000000000001',
    '11600000-0000-4000-8000-000000000001',
    '11400000-0000-4000-8000-000000000001',
    'provider_output',
    'available',
    'private/tenant-a/output-1',
    repeat('f', 64),
    'image/png',
    200
  );

insert into public.artifact_lineage (
  id, workspace_id, parent_artifact_id, child_artifact_id, relationship
) values (
  '12200000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
  '12100000-0000-4000-8000-000000000001',
  'input_to_output'
);

insert into public.cost_reservations (
  id, workspace_id, quote_id, run_id, amount_micros
) values (
  '12300000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '11500000-0000-4000-8000-000000000001',
  '11600000-0000-4000-8000-000000000001',
  1000000
);

insert into public.ledger_transactions (
  id,
  workspace_id,
  transaction_id,
  entry_type,
  account_code,
  direction,
  amount_micros,
  causative_key
) values
  (
    '12800000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '12400000-0000-4000-8000-000000000001',
    'credit',
    'funding_clearing',
    'debit',
    5000000,
    'fixture-credit'
  ),
  (
    '12900000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '12400000-0000-4000-8000-000000000001',
    'credit',
    'wallet_available',
    'credit',
    5000000,
    'fixture-credit'
  );

insert into public.idempotency_records (
  id,
  workspace_id,
  actor_id,
  operation,
  idempotency_key,
  request_hash,
  response_payload
) values (
  '12500000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'fixture.operation',
  'fixture-key',
  repeat('1', 64),
  '{"ok":true}'::jsonb
);

insert into public.audit_events (
  id,
  workspace_id,
  actor_type,
  actor_id,
  action,
  entity_type,
  entity_id,
  request_id
) values (
  '12600000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'user',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'fixture.created',
  'project',
  '11200000-0000-4000-8000-000000000001',
  'fixture-request'
);

insert into public.outbox_events (
  id,
  workspace_id,
  aggregate_type,
  aggregate_id,
  event_type,
  dedupe_key,
  payload
) values (
  '12700000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'run',
  '11600000-0000-4000-8000-000000000001',
  'fixture.created',
  'fixture-outbox-1',
  '{}'::jsonb
);

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

select results_eq(
  format(
    'select count(*)::bigint from public.%I where %s',
    probe.table_name,
    case
      when probe.table_name = 'workspaces'
        then 'id = ''10000000-0000-4000-8000-000000000001''::uuid'
      else 'workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid'
    end
  ),
  array[0::bigint],
  format('%s SELECT hides tenant A from tenant B', probe.table_name)
)
from (values
  ('workspaces'),
  ('workspace_memberships'),
  ('briefs'),
  ('brand_kits'),
  ('projects'),
  ('canvases'),
  ('canvas_revisions'),
  ('quotes'),
  ('runs'),
  ('run_nodes'),
  ('attempts'),
  ('provider_jobs'),
  ('artifacts'),
  ('artifact_lineage'),
  ('cost_reservations'),
  ('ledger_transactions'),
  ('idempotency_records'),
  ('audit_events'),
  ('outbox_events')
) as probe(table_name);

select ok(
  not app_private.is_workspace_member('10000000-0000-4000-8000-000000000001'),
  'tenant B membership helper cannot authorize tenant A'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.workspaces (id, name, slug, created_by)
    values (
      '90000000-0000-4000-8000-000000000001',
      'Cross tenant',
      'cross-tenant',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
    )
  $sql$),
  '42501',
  'workspaces INSERT is denied'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.briefs (id, workspace_id, title, brief_data, created_by)
    values (
      '90000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001',
      'Cross tenant',
      '{}'::jsonb,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
    )
  $sql$),
  '42501',
  'briefs INSERT is denied by tenant WITH CHECK'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.brand_kits (id, workspace_id, name, kit_data, created_by)
    values (
      '90000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'Cross tenant',
      '{}'::jsonb,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
    )
  $sql$),
  '42501',
  'brand_kits INSERT is denied by tenant WITH CHECK'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.projects (id, workspace_id, name, created_by)
    values (
      '90000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000001',
      'Cross tenant',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
    )
  $sql$),
  '42501',
  'projects INSERT is denied by tenant WITH CHECK'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.%I (id, workspace_id) values (gen_random_uuid(), %L::uuid)',
    probe.table_name,
    '10000000-0000-4000-8000-000000000001'
  )),
  '42501',
  format('%s INSERT is denied before machine-owned state can be supplied', probe.table_name)
)
from (values
  ('workspace_memberships'),
  ('canvases'),
  ('canvas_revisions'),
  ('quotes'),
  ('runs'),
  ('run_nodes'),
  ('attempts'),
  ('provider_jobs'),
  ('artifacts'),
  ('artifact_lineage'),
  ('cost_reservations'),
  ('ledger_transactions'),
  ('idempotency_records'),
  ('audit_events'),
  ('outbox_events')
) as probe(table_name);

select is(
  pg_temp.sqlstate_of(probe.sql),
  '00000',
  probe.description
)
from (values
  (
    'update public.workspaces set name = ''compromised'' where id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'workspaces UPDATE sees zero cross-tenant rows'
  ),
  (
    'update public.briefs set title = ''compromised'' where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'briefs UPDATE sees zero cross-tenant rows'
  ),
  (
    'update public.brand_kits set name = ''compromised'' where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'brand_kits UPDATE sees zero cross-tenant rows'
  ),
  (
    'update public.projects set name = ''compromised'' where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'projects UPDATE sees zero cross-tenant rows'
  )
) as probe(sql, description);

select is(
  pg_temp.sqlstate_of(format(
    'update public.%I set workspace_id = %L::uuid where workspace_id = %L::uuid',
    probe.table_name,
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001'
  )),
  '42501',
  format('%s UPDATE is not granted to authenticated', probe.table_name)
)
from (values
  ('workspace_memberships'),
  ('canvases'),
  ('canvas_revisions'),
  ('quotes'),
  ('runs'),
  ('run_nodes'),
  ('attempts'),
  ('provider_jobs'),
  ('artifacts'),
  ('artifact_lineage'),
  ('cost_reservations'),
  ('ledger_transactions'),
  ('idempotency_records'),
  ('audit_events'),
  ('outbox_events')
) as probe(table_name);

select is(
  pg_temp.sqlstate_of(format(
    'delete from public.%I where workspace_id = %L::uuid',
    probe.table_name,
    '10000000-0000-4000-8000-000000000001'
  )),
  '00000',
  format('%s DELETE sees zero cross-tenant rows', probe.table_name)
)
from (values ('briefs'), ('brand_kits'), ('projects')) as probe(table_name);

select is(
  pg_temp.sqlstate_of(probe.sql),
  '42501',
  probe.description
)
from (values
  (
    'delete from public.workspaces where id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'workspaces DELETE is not granted to authenticated'
  ),
  (
    'delete from public.workspace_memberships where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'workspace_memberships DELETE is not granted to authenticated'
  ),
  (
    'delete from public.canvases where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'canvases DELETE is not granted to authenticated'
  ),
  (
    'delete from public.canvas_revisions where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'canvas_revisions DELETE is not granted to authenticated'
  ),
  (
    'delete from public.quotes where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'quotes DELETE is not granted to authenticated'
  ),
  (
    'delete from public.runs where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'runs DELETE is not granted to authenticated'
  ),
  (
    'delete from public.run_nodes where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'run_nodes DELETE is not granted to authenticated'
  ),
  (
    'delete from public.attempts where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'attempts DELETE is not granted to authenticated'
  ),
  (
    'delete from public.provider_jobs where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'provider_jobs DELETE is not granted to authenticated'
  ),
  (
    'delete from public.artifacts where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'artifacts DELETE is not granted to authenticated'
  ),
  (
    'delete from public.artifact_lineage where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'artifact_lineage DELETE is not granted to authenticated'
  ),
  (
    'delete from public.cost_reservations where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'cost_reservations DELETE is not granted to authenticated'
  ),
  (
    'delete from public.ledger_transactions where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'ledger_transactions DELETE is not granted to authenticated'
  ),
  (
    'delete from public.idempotency_records where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'idempotency_records DELETE is not granted to authenticated'
  ),
  (
    'delete from public.audit_events where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'audit_events DELETE is not granted to authenticated'
  ),
  (
    'delete from public.outbox_events where workspace_id = ''10000000-0000-4000-8000-000000000001''::uuid',
    'outbox_events DELETE is not granted to authenticated'
  )
) as probe(sql, description);

reset role;

select is(
  (select name from public.workspaces where id = '10000000-0000-4000-8000-000000000001'),
  'Tenant A',
  'tenant A workspace survived cross-tenant update and delete probes'
);
select is(
  (select title from public.briefs where id = '11000000-0000-4000-8000-000000000001'),
  'Tenant A brief',
  'tenant A brief survived cross-tenant CRUD probes'
);
select is(
  (select name from public.brand_kits where id = '11100000-0000-4000-8000-000000000001'),
  'Tenant A kit',
  'tenant A brand kit survived cross-tenant CRUD probes'
);
select is(
  (select name from public.projects where id = '11200000-0000-4000-8000-000000000001'),
  'Tenant A project',
  'tenant A project survived cross-tenant CRUD probes'
);

select * from finish();

rollback;
