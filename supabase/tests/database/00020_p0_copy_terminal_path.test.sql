begin;

select plan(11);

-- The OpenRouter copy route had no terminal path at all. advance_fal_provider_attempt joins
-- provider_registrations on provider_key = 'fal', so a copy attempt raised NOT_FOUND: its output was
-- discarded, its node never captured, and the run could never settle.
--
-- The consequence was worse than a stuck node. app_private.advance_run_readiness - the function that
-- promotes the next dispatch wave - is called from exactly ONE place, inside
-- advance_fal_provider_attempt, behind that same fal-only join. Wave 1 of the launch pack is all
-- three copy nodes, so the entire DAG would have stalled at wave 1 and no image would ever have been
-- generated. Wave ordering was built to be graph-driven and provider-neutral, but its only trigger
-- was fal-specific.
--
-- These tests drive the copy settlement with fabricated artifacts and no provider call.

create temporary table wave_graph (graph_snapshot jsonb) on commit drop;

insert into wave_graph (graph_snapshot)
values (jsonb_build_object(
  'nodes', jsonb_build_array(
    jsonb_build_object('id', 'copy-1', 'kind', 'output', 'parameter_schema_version', 1,
      'parameters', jsonb_build_object('asset_role', 'copy_set')),
    jsonb_build_object('id', 'master-1', 'kind', 'output', 'parameter_schema_version', 1,
      'parameters', jsonb_build_object('asset_role', 'master_static'))
  ),
  'edges', jsonb_build_array(
    jsonb_build_object('id', 'edge-1', 'kind', 'dependency',
      'source_node_id', 'copy-1', 'target_node_id', 'master-1')
  )
));

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'af100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'copy-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('af200000-0000-4000-8000-000000000001', 'Copy Workspace', 'copy-workspace',
        'af100000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values ('af200000-0000-4000-8000-000000000001', 'af100000-0000-4000-8000-000000000001',
        'owner', 'active');

insert into public.projects (id, workspace_id, name, created_by)
values ('af210000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
        'Copy Project', 'af100000-0000-4000-8000-000000000001');

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values ('af220000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
        'af210000-0000-4000-8000-000000000001', 'Copy Canvas',
        'af100000-0000-4000-8000-000000000001');

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot, canonical_hash,
  actor_type, reason
)
select 'af230000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
       'af220000-0000-4000-8000-000000000001', 1, graph_snapshot,
       repeat('7', 64), 'system', 'copy fixture'
from wave_graph;

-- Plan mirrors what create_quote emits: copy in wave 1 and ready, master in wave 2 and not.
insert into public.quotes (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, price_catalog_version_id,
  execution_plan, quote_hash, maximum_charge_micros, created_by, expires_at
) values (
  'af240000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
  'af210000-0000-4000-8000-000000000001', 'af220000-0000-4000-8000-000000000001',
  'af230000-0000-4000-8000-000000000001',
  (select id from public.price_catalog_versions where status = 'active'),
  jsonb_build_array(
    jsonb_build_object(
      'ready', true, 'dispatch_wave', 1, 'node_id', 'copy-1',
      'model_route_id', '0b000000-0000-4000-8000-000000000005',
      'provider_model_id', 'qwen/qwen3-30b-a3b-instruct-2507',
      'total_micros', '150000',
      'price_components', jsonb_build_array(jsonb_build_object(
        'unit', 'request', 'quantity', '1',
        'unit_price_micros', '150000', 'total_micros', '150000'))
    ),
    jsonb_build_object(
      'ready', false, 'dispatch_wave', 2, 'node_id', 'master-1',
      'model_route_id', '0b000000-0000-4000-8000-000000000002',
      'provider_model_id', 'fal-ai/flux-2-pro',
      'total_micros', '500000',
      'price_components', jsonb_build_array(jsonb_build_object(
        'unit', 'image', 'quantity', '1',
        'unit_price_micros', '500000', 'total_micros', '500000'))
    )
  ),
  repeat('8', 64), 650000, 'af100000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '15 minutes'
);

insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status, dispatch_wave
) values (
  'af400000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
  'af210000-0000-4000-8000-000000000001', 'af220000-0000-4000-8000-000000000001',
  'af230000-0000-4000-8000-000000000001', repeat('7', 64),
  'af240000-0000-4000-8000-000000000001', 'af100000-0000-4000-8000-000000000001', 'running', 1
);

insert into public.run_nodes (id, workspace_id, run_id, node_key, model_route_id, status, dispatch_wave)
values
  ('af500000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
   'af400000-0000-4000-8000-000000000001', 'copy-1', '0b000000-0000-4000-8000-000000000005',
   'ready', 1),
  ('af500000-0000-4000-8000-000000000002', 'af200000-0000-4000-8000-000000000001',
   'af400000-0000-4000-8000-000000000001', 'master-1', '0b000000-0000-4000-8000-000000000002',
   'pending', 2);

-- Both attempts exist from the barrier onward; only wave 1's is dispatched.
insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id, attempt_number, request_id, status
) values
  ('af600000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
   'af400000-0000-4000-8000-000000000001', 'af500000-0000-4000-8000-000000000001',
   '0a000000-0000-4000-8000-000000000004', 1, 'copy-fixture-1', 'submitted'),
  ('af600000-0000-4000-8000-000000000002', 'af200000-0000-4000-8000-000000000001',
   'af400000-0000-4000-8000-000000000001', 'af500000-0000-4000-8000-000000000002',
   '0a000000-0000-4000-8000-000000000003', 1, 'copy-fixture-2', 'created');

insert into public.provider_jobs (
  id, workspace_id, run_id, attempt_id, provider_registration_id, provider_request_id, request_hash,
  status
) values (
  'af800000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
  'af400000-0000-4000-8000-000000000001', 'af600000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000004', 'openrouter-req-1', repeat('1', 64), 'submitted'
);

insert into public.cost_reservations (id, workspace_id, quote_id, run_id, amount_micros)
values ('af700000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
        'af240000-0000-4000-8000-000000000001', 'af400000-0000-4000-8000-000000000001', 650000);

select public.record_ledger_movement(
  'af200000-0000-4000-8000-000000000001', 'credit', 1000000,
  'copy-fixture-credit', null, null, 'copy-fixture', '{}'::jsonb);
select public.record_ledger_movement(
  'af200000-0000-4000-8000-000000000001', 'reserve', 650000,
  'run:af400000-0000-4000-8000-000000000001:reserve',
  'af700000-0000-4000-8000-000000000001', 'af400000-0000-4000-8000-000000000001',
  'copy-fixture', '{}'::jsonb);

-- The copy artifact is JSON, not an image. It must never travel the fal image verification path.
insert into public.artifacts (
  id, workspace_id, project_id, run_id, run_node_id, canvas_revision_id,
  artifact_kind, status, object_key, content_hash, mime_type, byte_size
) values (
  'af900000-0000-4000-8000-000000000001', 'af200000-0000-4000-8000-000000000001',
  'af210000-0000-4000-8000-000000000001', 'af400000-0000-4000-8000-000000000001',
  'af500000-0000-4000-8000-000000000001', 'af230000-0000-4000-8000-000000000001',
  'provider_output', 'available',
  'workspaces/af200000-0000-4000-8000-000000000001/runs/af400000-0000-4000-8000-000000000001/attempts/af600000-0000-4000-8000-000000000001/provider-output',
  repeat('2', 64), 'application/json', 512
);

-- Capture the PINNED CUSTOMER price, not OpenRouter's ~17 micros of real cost. The ledger records
-- what the customer is charged; provider cost is margin telemetry. Capturing cost instead would make
-- the settlement release the ~432,000 micro remainder and silently turn a confirmed charge into a
-- fraction of it.
select public.record_ledger_movement(
  'af200000-0000-4000-8000-000000000001', 'capture', 150000,
  'run:af400000-0000-4000-8000-000000000001:attempt:af600000-0000-4000-8000-000000000001:capture',
  'af700000-0000-4000-8000-000000000001', 'af400000-0000-4000-8000-000000000001',
  'copy-fixture', '{}'::jsonb);

-- The provider-neutral context lookup must resolve an OpenRouter job.
select is(
  (public.get_provider_artifact_context('openrouter-req-1', 'openrouter') ->> 'attempt_id')::uuid,
  'af600000-0000-4000-8000-000000000001'::uuid,
  'the context lookup resolves an OpenRouter job once the provider key is a parameter'
);

select is(
  public.get_provider_artifact_context('openrouter-req-1', 'openrouter') ->> 'quoted_total_micros',
  '150000',
  'the copy node carries its pinned 150,000-micro line total into the ingest context'
);

-- The fal-named wrapper must be unchanged for existing callers: an OpenRouter job stays invisible.
-- It raises rather than returning null, which is the pre-existing contract.
select throws_ok(
  $$select public.get_fal_artifact_context('openrouter-req-1')$$,
  'P0002',
  'NOT_FOUND',
  'the fal-named context wrapper still cannot see a non-fal job'
);

-- Provider isolation in both directions.
select throws_ok(
  $$select public.advance_fal_provider_attempt(
      'openrouter-req-1', 'succeeded', 'evt-1',
      'af900000-0000-4000-8000-000000000001'::uuid, 150000)$$,
  'P0002',
  'NOT_FOUND',
  'the fal advance still refuses an OpenRouter job rather than settling it by accident'
);

select is(
  (select status from public.run_nodes where id = 'af500000-0000-4000-8000-000000000002'),
  'pending',
  'the master is still waiting before the copy node settles'
);

-- The copy terminal path.
select is(
  public.advance_copy_provider_attempt(
    'openrouter-req-1', 'succeeded', 'evt-1',
    'af900000-0000-4000-8000-000000000001'::uuid, 150000
  ) ->> 'effective_attempt_status',
  'succeeded',
  'a copy attempt can finally reach a terminal state'
);

select is(
  (select status from public.attempts where id = 'af600000-0000-4000-8000-000000000001'),
  'succeeded',
  'the copy attempt is recorded terminal'
);

-- The regression that matters most: readiness is triggered from the settlement tail, so a COPY node
-- completing promotes the next wave. Before this, advance_run_readiness was reachable only through
-- the fal-only entry point, and wave 1 of the launch pack is entirely copy.
select is(
  (select status from public.run_nodes where id = 'af500000-0000-4000-8000-000000000002'),
  'ready',
  'a copy node completing promotes the next wave, so the DAG no longer stalls at wave 1'
);

select is(
  (select count(*)::integer from public.outbox_events
   where aggregate_id = 'af400000-0000-4000-8000-000000000001'
     and dedupe_key like '%:dispatch:2'),
  1,
  'completing the copy wave arms exactly one dispatch event for wave 2'
);

select is(
  (select captured_micros from public.cost_reservations
   where id = 'af700000-0000-4000-8000-000000000001'),
  150000::bigint,
  'the reservation captures the pinned customer price for copy, not provider cost'
);

select is(
  (select coalesce(sum(case when direction = 'credit' then amount_micros else -amount_micros end), 0)::bigint
   from public.ledger_transactions
   where workspace_id = 'af200000-0000-4000-8000-000000000001'),
  0::bigint,
  'the workspace ledger stays balanced through the copy settlement'
);

select * from finish();

rollback;
