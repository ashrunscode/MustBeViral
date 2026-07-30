begin;

select plan(12);

-- A run whose dispatch event dies with attempts still at 'created' held its full reservation
-- forever: nothing dispatched the attempts, the terminal predicate never fired, and the remainder
-- was never released. Two live reservations stranded exactly this way. The reaper is the code path
-- out, and these tests fabricate the whole chain so it is proven without any provider.

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'ab100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'reaper-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('ab200000-0000-4000-8000-000000000001', 'Reaper Workspace', 'reaper-workspace',
        'ab100000-0000-4000-8000-000000000001');

insert into public.projects (id, workspace_id, name, created_by)
values ('ab210000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
        'Reaper Project', 'ab100000-0000-4000-8000-000000000001');

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values ('ab220000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
        'ab210000-0000-4000-8000-000000000001', 'Reaper Canvas',
        'ab100000-0000-4000-8000-000000000001');

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot, canonical_hash,
  actor_type, reason
) values (
  'ab230000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
  'ab220000-0000-4000-8000-000000000001', 1, '{"nodes":[],"edges":[]}'::jsonb,
  -- canvas_revisions_check1 requires actor_id alongside actor_type 'user'; this is a machine
  -- fixture with no acting user, so 'system' is both correct and constraint-satisfying.
  repeat('a', 64), 'system', 'reaper fixture'
);

insert into public.quotes (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, price_catalog_version_id,
  execution_plan, quote_hash, maximum_charge_micros, created_by, expires_at
) values (
  'ab240000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
  'ab210000-0000-4000-8000-000000000001', 'ab220000-0000-4000-8000-000000000001',
  'ab230000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002',
  '[]'::jsonb, repeat('b', 64), 1000000, 'ab100000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '15 minutes'
);

-- Run A: every attempt still 'created' when its dispatch event dies. The reap target.
insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status
) values (
  'ab400000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
  'ab210000-0000-4000-8000-000000000001', 'ab220000-0000-4000-8000-000000000001',
  'ab230000-0000-4000-8000-000000000001', repeat('a', 64),
  'ab240000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001', 'queued'
);

insert into public.run_nodes (id, workspace_id, run_id, node_key, model_route_id, status)
values
  ('ab500000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000001', 'master-1', '0b000000-0000-4000-8000-000000000002',
   'ready'),
  ('ab500000-0000-4000-8000-000000000002', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000001', 'master-2', '0b000000-0000-4000-8000-000000000002',
   'ready');

insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id, attempt_number, request_id,
  status
) values
  ('ab600000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000001', 'ab500000-0000-4000-8000-000000000001',
   '0a000000-0000-4000-8000-000000000001', 1, 'reap-fixture-a1', 'created'),
  ('ab600000-0000-4000-8000-000000000002', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000001', 'ab500000-0000-4000-8000-000000000002',
   '0a000000-0000-4000-8000-000000000001', 1, 'reap-fixture-a2', 'created');

insert into public.cost_reservations (id, workspace_id, quote_id, run_id, amount_micros)
values ('ab700000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001',
        'ab240000-0000-4000-8000-000000000001', 'ab400000-0000-4000-8000-000000000001', 1000000);

-- Real ledger movements so the release has a balanced double-entry history behind it.
select public.record_ledger_movement(
  'ab200000-0000-4000-8000-000000000001', 'credit', 1000000,
  'reap-fixture-credit', null, null, 'reap-fixture', '{}'::jsonb);
select public.record_ledger_movement(
  'ab200000-0000-4000-8000-000000000001', 'reserve', 1000000,
  'run:ab400000-0000-4000-8000-000000000001:reserve',
  'ab700000-0000-4000-8000-000000000001', 'ab400000-0000-4000-8000-000000000001',
  'reap-fixture', '{}'::jsonb);

insert into public.outbox_events (
  id, workspace_id, aggregate_type, aggregate_id, event_type, dedupe_key, payload, status,
  publish_attempts
) values (
  'ab300000-0000-4000-8000-000000000001', 'ab200000-0000-4000-8000-000000000001', 'run',
  'ab400000-0000-4000-8000-000000000001', 'run.dispatch_requested',
  'run:ab400000-0000-4000-8000-000000000001:dispatch:1',
  '{}'::jsonb, 'dead', 1
);

-- Run B: one attempt already with the provider. The reaper must cancel only the stragglers and
-- must NOT terminalize or release, because the webhook path still owns the submitted attempt.
insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status
) values (
  'ab400000-0000-4000-8000-000000000002', 'ab200000-0000-4000-8000-000000000001',
  'ab210000-0000-4000-8000-000000000001', 'ab220000-0000-4000-8000-000000000001',
  'ab230000-0000-4000-8000-000000000001', repeat('a', 64),
  'ab240000-0000-4000-8000-000000000001', 'ab100000-0000-4000-8000-000000000001', 'running'
);

insert into public.run_nodes (id, workspace_id, run_id, node_key, model_route_id, status)
values
  ('ab500000-0000-4000-8000-000000000003', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000002', 'master-1', '0b000000-0000-4000-8000-000000000002',
   'queued'),
  ('ab500000-0000-4000-8000-000000000004', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000002', 'master-2', '0b000000-0000-4000-8000-000000000002',
   'ready');

insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id, attempt_number, request_id,
  status
) values
  ('ab600000-0000-4000-8000-000000000003', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000002', 'ab500000-0000-4000-8000-000000000003',
   '0a000000-0000-4000-8000-000000000001', 1, 'reap-fixture-b1', 'submitted'),
  ('ab600000-0000-4000-8000-000000000004', 'ab200000-0000-4000-8000-000000000001',
   'ab400000-0000-4000-8000-000000000002', 'ab500000-0000-4000-8000-000000000004',
   '0a000000-0000-4000-8000-000000000001', 1, 'reap-fixture-b2', 'created');

insert into public.outbox_events (
  id, workspace_id, aggregate_type, aggregate_id, event_type, dedupe_key, payload, status,
  publish_attempts
) values (
  'ab300000-0000-4000-8000-000000000002', 'ab200000-0000-4000-8000-000000000001', 'run',
  'ab400000-0000-4000-8000-000000000002', 'run.dispatch_requested',
  'run:ab400000-0000-4000-8000-000000000002:dispatch:1',
  '{}'::jsonb, 'dead', 1
);

-- Validation guard.
select throws_ok(
  $$select public.reap_dead_dispatch(0)$$,
  '22023', 'VALIDATION_FAILED',
  'the reap limit is validated'
);

-- The reap.
select is(
  (select (public.reap_dead_dispatch(10) ->> 'runs_terminalized')::integer),
  1,
  'exactly one run terminalizes: the one with nothing left in flight'
);

select is(
  (select status from public.runs where id = 'ab400000-0000-4000-8000-000000000001'),
  'canceled',
  'run A is canceled: every attempt was undispatchable'
);

select is(
  (select count(*)::integer from public.attempts
   where run_id = 'ab400000-0000-4000-8000-000000000001' and status = 'canceled'),
  2,
  'both of run A''s created attempts are canceled'
);

select is(
  (select released_micros from public.cost_reservations
   where id = 'ab700000-0000-4000-8000-000000000001'),
  1000000::bigint,
  'run A''s reservation remainder is released in full'
);

select is(
  (select amount_micros - captured_micros - released_micros from public.cost_reservations
   where id = 'ab700000-0000-4000-8000-000000000001'),
  0::bigint,
  'run A''s reservation nets to zero residual'
);

select is(
  (select status from public.runs where id = 'ab400000-0000-4000-8000-000000000002'),
  'running',
  'run B keeps running: an attempt is still with the provider'
);

select is(
  (select status from public.attempts where id = 'ab600000-0000-4000-8000-000000000003'),
  'submitted',
  'run B''s submitted attempt is untouched; the webhook path owns it'
);

select is(
  (select status from public.attempts where id = 'ab600000-0000-4000-8000-000000000004'),
  'canceled',
  'run B''s undispatchable straggler is canceled so the run can terminalize later'
);

-- Idempotency: nothing left matches the predicate, and money does not move twice.
select is(
  (select (public.reap_dead_dispatch(10) ->> 'runs_examined')::integer),
  0,
  'a second reap finds nothing: the predicate excludes already-reaped runs'
);

select is(
  (select released_micros from public.cost_reservations
   where id = 'ab700000-0000-4000-8000-000000000001'),
  1000000::bigint,
  'the release is not repeated'
);

select is(
  (select coalesce(sum(case when direction = 'credit' then amount_micros else -amount_micros end), 0)
   from public.ledger_transactions
   where workspace_id = 'ab200000-0000-4000-8000-000000000001'),
  0::bigint,
  'the workspace ledger stays balanced through the reap'
);

select * from finish();

rollback;
