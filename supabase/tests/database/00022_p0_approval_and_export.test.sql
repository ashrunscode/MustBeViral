begin;

select plan(16);

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

-- The last of the six original execution-engine defects: get_export_context requires
-- artifact_kind = 'approved_output' and nothing in the system ever produced one, so create_export
-- could never succeed and receipts stayed unretrievable. approve_run_artifacts closes it by
-- promoting the provider_output row IN PLACE - content_hash preserved (it is the artifact's
-- identity), no byte duplication, provenance recorded on the row itself.
--
-- These tests also pin the two late-redelivery hazards approval creates: a fal webhook redelivered
-- AFTER promotion must replay through register_artifact (not die on IDEMPOTENCY_CONFLICT and
-- 503-loop), and must still satisfy settle_attempt_transition's capture proof (relaxed to admit
-- both kinds).

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c0100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'approval-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
), (
  'c0100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'approval-outsider@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('c0200000-0000-4000-8000-000000000001', 'Approval Workspace', 'approval-workspace',
        'c0100000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values ('c0200000-0000-4000-8000-000000000001', 'c0100000-0000-4000-8000-000000000001',
        'owner', 'active');

insert into public.projects (id, workspace_id, name, created_by)
values ('c0210000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
        'Approval Project', 'c0100000-0000-4000-8000-000000000001');

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values ('c0220000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
        'c0210000-0000-4000-8000-000000000001', 'Approval Canvas',
        'c0100000-0000-4000-8000-000000000001');

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot, canonical_hash,
  actor_type, reason
) values (
  'c0230000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
  'c0220000-0000-4000-8000-000000000001', 1,
  '{"nodes":[{"id":"copy-1","kind":"planner_text","parameter_schema_version":1,"parameters":{"asset_role":"copy_set"}}],"edges":[]}'::jsonb,
  repeat('c', 64), 'system', 'approval fixture'
);

insert into public.quotes (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, price_catalog_version_id,
  execution_plan, quote_hash, maximum_charge_micros, created_by, expires_at
) values (
  'c0240000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
  'c0210000-0000-4000-8000-000000000001', 'c0220000-0000-4000-8000-000000000001',
  'c0230000-0000-4000-8000-000000000001',
  (select id from public.price_catalog_versions where status = 'active'),
  '[{"ready":true,"dispatch_wave":1,"node_id":"copy-1","model_route_id":"0b000000-0000-4000-8000-000000000005","total_micros":"150000","price_components":[{"unit":"request","quantity":"1","unit_price_micros":"150000","total_micros":"150000"}]}]'::jsonb,
  repeat('a', 64), 150000, 'c0100000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '15 minutes'
);

-- Run A: settled and succeeded - the approvable case.
insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status
) values (
  'c0400000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
  'c0210000-0000-4000-8000-000000000001', 'c0220000-0000-4000-8000-000000000001',
  'c0230000-0000-4000-8000-000000000001', repeat('c', 64),
  'c0240000-0000-4000-8000-000000000001', 'c0100000-0000-4000-8000-000000000001', 'succeeded'
);

insert into public.run_nodes (id, workspace_id, run_id, node_key, model_route_id, status)
values ('c0500000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
        'c0400000-0000-4000-8000-000000000001', 'copy-1',
        '0b000000-0000-4000-8000-000000000005', 'succeeded');

insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id, attempt_number, request_id, status
) values ('c0600000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
          'c0400000-0000-4000-8000-000000000001', 'c0500000-0000-4000-8000-000000000001',
          '0a000000-0000-4000-8000-000000000004', 1, 'approval-fixture-1', 'succeeded');

insert into public.provider_jobs (
  id, workspace_id, run_id, attempt_id, provider_registration_id, provider_request_id, request_hash,
  status
) values (
  'c0800000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
  'c0400000-0000-4000-8000-000000000001', 'c0600000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000004', 'approval-or-req-1', repeat('1', 64), 'succeeded'
);

-- Settled reservation: fully captured, zero residual.
insert into public.cost_reservations (id, workspace_id, quote_id, run_id, amount_micros)
values ('c0700000-0000-4000-8000-000000000001', 'c0200000-0000-4000-8000-000000000001',
        'c0240000-0000-4000-8000-000000000001', 'c0400000-0000-4000-8000-000000000001', 150000);

select public.record_ledger_movement(
  'c0200000-0000-4000-8000-000000000001', 'credit', 150000,
  'approval-fixture-credit', null, null, 'approval-fixture', '{}'::jsonb);
select public.record_ledger_movement(
  'c0200000-0000-4000-8000-000000000001', 'reserve', 150000,
  'run:c0400000-0000-4000-8000-000000000001:reserve',
  'c0700000-0000-4000-8000-000000000001', 'c0400000-0000-4000-8000-000000000001',
  'approval-fixture', '{}'::jsonb);
select public.record_ledger_movement(
  'c0200000-0000-4000-8000-000000000001', 'capture', 150000,
  'run:c0400000-0000-4000-8000-000000000001:attempt:c0600000-0000-4000-8000-000000000001:capture',
  'c0700000-0000-4000-8000-000000000001', 'c0400000-0000-4000-8000-000000000001',
  'approval-fixture', '{}'::jsonb);

-- The provider_output the customer will approve, registered through the real machine path.
do $$
begin
  perform public.register_artifact(
    'c0400000-0000-4000-8000-000000000001',
    'c0500000-0000-4000-8000-000000000001',
    'provider_output',
    'available',
    'workspaces/c0200000-0000-4000-8000-000000000001/runs/c0400000-0000-4000-8000-000000000001/attempts/c0600000-0000-4000-8000-000000000001/provider-output',
    repeat('2', 64),
    'application/json',
    512
  );
end;
$$;

-- === approve_run_artifacts, called as the authenticated owner ===
set local role authenticated;
set local request.jwt.claim.sub = 'c0100000-0000-4000-8000-000000000001';

select is(
  (public.approve_run_artifacts(
    'c0400000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'artifact_id',
        (select id from public.artifacts
         where run_id = 'c0400000-0000-4000-8000-000000000001' limit 1),
      'accessibility_description', 'Three ad copy variants for the approval fixture.'
    )),
    'approval-req-1'
  ) ->> 'approved')::integer,
  1,
  'the owner approves a settled provider_output'
);

select is(
  (select artifact_kind from public.artifacts
   where run_id = 'c0400000-0000-4000-8000-000000000001'),
  'approved_output',
  'approval promotes the artifact kind in place'
);

select is(
  (select approved_by from public.artifacts
   where run_id = 'c0400000-0000-4000-8000-000000000001'),
  'c0100000-0000-4000-8000-000000000001'::uuid,
  'approval records who approved'
);

select is(
  (select accessibility_description from public.artifacts
   where run_id = 'c0400000-0000-4000-8000-000000000001'),
  'Three ad copy variants for the approval fixture.',
  'approval records the WCAG-required accessibility description'
);

select is(
  (select content_hash from public.artifacts
   where run_id = 'c0400000-0000-4000-8000-000000000001'),
  repeat('2', 64),
  'promotion preserves the content hash - the artifact identity does not move'
);

-- Idempotent replay: approving again reports replayed, changes nothing.
select is(
  (public.approve_run_artifacts(
    'c0400000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'artifact_id',
        (select id from public.artifacts
         where run_id = 'c0400000-0000-4000-8000-000000000001' limit 1),
      'accessibility_description', 'A different description that must NOT overwrite the record.'
    )),
    'approval-req-2'
  ) ->> 'replayed')::integer,
  1,
  'a second approval replays instead of double-approving'
);

select is(
  (select accessibility_description from public.artifacts
   where run_id = 'c0400000-0000-4000-8000-000000000001'),
  'Three ad copy variants for the approval fixture.',
  'replay does not overwrite the recorded description'
);

-- The WCAG gate: a missing description refuses the approval.
select throws_ok(
  $$select public.approve_run_artifacts(
      'c0400000-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'artifact_id', (select id from public.artifacts
          where run_id = 'c0400000-0000-4000-8000-000000000001' limit 1),
        'accessibility_description', '')),
      'approval-req-3')$$,
  '22023',
  'ACCESSIBILITY_DESCRIPTION_REQUIRED',
  'an empty accessibility description refuses the approval'
);

-- A non-member cannot even discover the run exists.
set local request.jwt.claim.sub = 'c0100000-0000-4000-8000-000000000002';
select throws_ok(
  $$select public.approve_run_artifacts(
      'c0400000-0000-4000-8000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'artifact_id', '00000000-0000-4000-8000-000000000000',
        'accessibility_description', 'x')),
      'approval-req-4')$$,
  'P0002',
  'NOT_FOUND',
  'a non-member gets NOT_FOUND, not FORBIDDEN - membership is not disclosed'
);
set local request.jwt.claim.sub = 'c0100000-0000-4000-8000-000000000001';

reset role;

-- === the late-redelivery hazards ===

-- A fal webhook redelivered after approval replays through register_artifact.
select is(
  (public.register_artifact(
    'c0400000-0000-4000-8000-000000000001',
    'c0500000-0000-4000-8000-000000000001',
    'provider_output',
    'available',
    'workspaces/c0200000-0000-4000-8000-000000000001/runs/c0400000-0000-4000-8000-000000000001/attempts/c0600000-0000-4000-8000-000000000001/provider-output',
    repeat('2', 64),
    'application/json',
    512
  ) ->> 'replayed')::boolean,
  true,
  'a provider_output registration replayed over the approved row reports replayed, not conflict'
);

select is(
  (select artifact_kind from public.artifacts
   where run_id = 'c0400000-0000-4000-8000-000000000001'),
  'approved_output',
  'the replay does not demote the approval'
);

-- And the settle precondition admits the promoted kind: a redelivered terminal webhook after
-- approval still satisfies SUCCEEDED_ATTEMPT_REQUIRES_ARTIFACT_CAPTURE.
select is(
  (public.advance_copy_provider_attempt(
    'approval-or-req-1', 'succeeded', 'redelivered-after-approval',
    (select id from public.artifacts where run_id = 'c0400000-0000-4000-8000-000000000001'),
    150000
  ) ->> 'effective_attempt_status'),
  'succeeded',
  'a terminal advance redelivered after approval settles idempotently instead of 503-looping'
);

-- === export finally works ===
select is(
  (public.get_export_context(
    'c0400000-0000-4000-8000-000000000001',
    array[(select id from public.artifacts where run_id = 'c0400000-0000-4000-8000-000000000001')]
  ) -> 'artifacts' -> 0 ->> 'artifact_kind'),
  'approved_output',
  'get_export_context accepts the promoted artifact - the last engine defect is closed'
);

-- The machine cannot mint an approval.
select throws_ok(
  $$select public.register_artifact(
      'c0400000-0000-4000-8000-000000000001',
      'c0500000-0000-4000-8000-000000000001',
      'approved_output',
      'available',
      'workspaces/c0200000-0000-4000-8000-000000000001/runs/c0400000-0000-4000-8000-000000000001/machine-approved',
      repeat('3', 64),
      'application/json',
      64)$$,
  '22023',
  'VALIDATION_FAILED',
  'register_artifact refuses approved_output - approval is the only path'
);

-- An unsettled run cannot be approved. Run B: still running.
insert into public.quotes (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, price_catalog_version_id,
  execution_plan, quote_hash, maximum_charge_micros, created_by, expires_at
) values (
  'c0240000-0000-4000-8000-000000000002', 'c0200000-0000-4000-8000-000000000001',
  'c0210000-0000-4000-8000-000000000001', 'c0220000-0000-4000-8000-000000000001',
  'c0230000-0000-4000-8000-000000000001',
  (select id from public.price_catalog_versions where status = 'active'),
  '[{"ready":true,"dispatch_wave":1,"node_id":"copy-1","model_route_id":"0b000000-0000-4000-8000-000000000005","total_micros":"150000","price_components":[{"unit":"request","quantity":"1","unit_price_micros":"150000","total_micros":"150000"}]}]'::jsonb,
  repeat('b', 64), 150000, 'c0100000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '15 minutes'
);
insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status
) values (
  'c0400000-0000-4000-8000-000000000002', 'c0200000-0000-4000-8000-000000000001',
  'c0210000-0000-4000-8000-000000000001', 'c0220000-0000-4000-8000-000000000001',
  'c0230000-0000-4000-8000-000000000001', repeat('c', 64),
  'c0240000-0000-4000-8000-000000000002', 'c0100000-0000-4000-8000-000000000001', 'running'
);

set local role authenticated;
set local request.jwt.claim.sub = 'c0100000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.approve_run_artifacts(
      'c0400000-0000-4000-8000-000000000002',
      jsonb_build_array(jsonb_build_object(
        'artifact_id', '00000000-0000-4000-8000-000000000000',
        'accessibility_description', 'x')),
      'approval-req-5')$$,
  '23514',
  'RUN_NOT_APPROVABLE',
  'approval refuses a run whose money is still moving'
);
reset role;

-- Provenance is structural, not procedural: an approved_output without approval columns is
-- impossible at the schema level, even for a superuser bypassing every function.
select alike(
  pg_temp.error_of($sql$
    insert into public.artifacts (
      workspace_id, project_id, run_id, run_node_id, canvas_revision_id,
      artifact_kind, status, object_key, content_hash, mime_type, byte_size
    ) values (
      'c0200000-0000-4000-8000-000000000001',
      'c0210000-0000-4000-8000-000000000001',
      'c0400000-0000-4000-8000-000000000001',
      'c0500000-0000-4000-8000-000000000001',
      'c0230000-0000-4000-8000-000000000001',
      'approved_output', 'available',
      'workspaces/c0200000-0000-4000-8000-000000000001/runs/c0400000-0000-4000-8000-000000000001/forged-approval',
      repeat('4', 64), 'application/json', 64
    )
  $sql$),
  '23514:%',
  'the check constraint refuses an approved_output with no provenance'
);

select * from finish();

rollback;
