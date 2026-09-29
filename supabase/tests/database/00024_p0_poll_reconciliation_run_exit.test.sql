begin;

select plan(8);

-- Two independent poll-provider attempts share one run. The run starts in reconciliation_required:
-- resolving only the first attempt must leave it parked; resolving the second must terminalize it.
create temporary table poll_exit_graph (graph_snapshot jsonb) on commit drop;

insert into poll_exit_graph (graph_snapshot)
values (jsonb_build_object(
  'nodes', jsonb_build_array(
    jsonb_build_object('id', 'poll-1', 'kind', 'output', 'parameter_schema_version', 1,
      'parameters', jsonb_build_object('asset_role', 'master_static')),
    jsonb_build_object('id', 'poll-2', 'kind', 'output', 'parameter_schema_version', 1,
      'parameters', jsonb_build_object('asset_role', 'master_static'))
  ),
  'edges', '[]'::jsonb
));

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'poll-exit-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('c1200000-0000-4000-8000-000000000001', 'Poll Exit Workspace', 'poll-exit-workspace',
        'c1100000-0000-4000-8000-000000000001');

insert into public.projects (id, workspace_id, name, created_by)
values ('c1210000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
        'Poll Exit Project', 'c1100000-0000-4000-8000-000000000001');

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values ('c1220000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
        'c1210000-0000-4000-8000-000000000001', 'Poll Exit Canvas',
        'c1100000-0000-4000-8000-000000000001');

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot, canonical_hash,
  actor_type, reason
)
select 'c1230000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
       'c1220000-0000-4000-8000-000000000001', 1, graph_snapshot,
       repeat('3', 64), 'system', 'poll reconciliation exit fixture'
from poll_exit_graph;

insert into public.quotes (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, price_catalog_version_id,
  execution_plan, quote_hash, maximum_charge_micros, created_by, expires_at
) values (
  'c1240000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
  'c1210000-0000-4000-8000-000000000001', 'c1220000-0000-4000-8000-000000000001',
  'c1230000-0000-4000-8000-000000000001',
  (select id from public.price_catalog_versions where status = 'active'),
  jsonb_build_array(
    jsonb_build_object('node_id', 'poll-1', 'total_micros', '500000'),
    jsonb_build_object('node_id', 'poll-2', 'total_micros', '500000')
  ),
  repeat('4', 64), 1000000, 'c1100000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '15 minutes'
);

insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status
) values (
  'c1400000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
  'c1210000-0000-4000-8000-000000000001', 'c1220000-0000-4000-8000-000000000001',
  'c1230000-0000-4000-8000-000000000001', repeat('3', 64),
  'c1240000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000001',
  'reconciliation_required'
);

insert into public.run_nodes (id, workspace_id, run_id, node_key, model_route_id, status)
values
  ('c1500000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
   'c1400000-0000-4000-8000-000000000001', 'poll-1',
   '0b000000-0000-4000-8000-000000000002', 'reconciliation_required'),
  ('c1500000-0000-4000-8000-000000000002', 'c1200000-0000-4000-8000-000000000001',
   'c1400000-0000-4000-8000-000000000001', 'poll-2',
   '0b000000-0000-4000-8000-000000000002', 'running');

insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id, attempt_number, request_id, status
)
values
  ('c1600000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
   'c1400000-0000-4000-8000-000000000001', 'c1500000-0000-4000-8000-000000000001',
   '0a000000-0000-4000-8000-000000000003', 1, 'poll-exit-attempt-1', 'ambiguous'),
  ('c1600000-0000-4000-8000-000000000002', 'c1200000-0000-4000-8000-000000000001',
   'c1400000-0000-4000-8000-000000000001', 'c1500000-0000-4000-8000-000000000002',
   '0a000000-0000-4000-8000-000000000003', 1, 'poll-exit-attempt-2', 'running');

insert into public.provider_jobs (
  id, workspace_id, run_id, attempt_id, provider_registration_id, provider_request_id, request_hash,
  status
)
values
  ('c1800000-0000-4000-8000-000000000001', 'c1200000-0000-4000-8000-000000000001',
   'c1400000-0000-4000-8000-000000000001', 'c1600000-0000-4000-8000-000000000001',
   '0a000000-0000-4000-8000-000000000003', 'poll-exit-provider-1', repeat('5', 64), 'unknown'),
  ('c1800000-0000-4000-8000-000000000002', 'c1200000-0000-4000-8000-000000000001',
   'c1400000-0000-4000-8000-000000000001', 'c1600000-0000-4000-8000-000000000002',
   '0a000000-0000-4000-8000-000000000003', 'poll-exit-provider-2', repeat('6', 64), 'running');

select ok(
  has_function_privilege(
    'service_role',
    'public.record_provider_job_reconciliation(uuid,text,jsonb)'::regprocedure,
    'execute'
  ),
  'service_role can execute the poll reconciliation transition'
);

select is(
  public.record_provider_job_reconciliation(
    'c1800000-0000-4000-8000-000000000001', 'failed', '{"poll":"terminal"}'::jsonb
  ) ->> 'run_status',
  'reconciliation_required',
  'the first terminal poll reports that the run remains parked'
);

select is(
  (select status from public.attempts where id = 'c1600000-0000-4000-8000-000000000001'),
  'failed',
  'the resolved attempt reaches its terminal state'
);

select is(
  (select status from public.runs where id = 'c1400000-0000-4000-8000-000000000001'),
  'reconciliation_required',
  'a run with an unresolved attempt stays reconciliation_required'
);

select is(
  (select status from public.attempts where id = 'c1600000-0000-4000-8000-000000000002'),
  'running',
  'the unresolved sibling attempt is unchanged'
);

select is(
  public.record_provider_job_reconciliation(
    'c1800000-0000-4000-8000-000000000002', 'failed', '{"poll":"terminal"}'::jsonb
  ) ->> 'run_status',
  'failed',
  'the final terminal poll reports the aggregated run outcome'
);

select is(
  (select status from public.attempts where id = 'c1600000-0000-4000-8000-000000000002'),
  'failed',
  'the final unresolved attempt becomes terminal'
);

select is(
  (select status from public.runs where id = 'c1400000-0000-4000-8000-000000000001'),
  'failed',
  'a reconciliation_required run exits once every attempt is terminal'
);

select * from finish();

rollback;
