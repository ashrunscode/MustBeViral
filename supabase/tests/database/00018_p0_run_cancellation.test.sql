begin;

select plan(12);

-- The emergency brake. Before this, cancel_run always returned conflict and nothing could stop a
-- run's undispatched nodes from spending. Semantics under test: created attempts cancel
-- immediately; submitted attempts are left to the webhook/reconciler; a fully-drained cancel
-- terminalizes with a billing-honest status and a full remainder release; a cancel with work in
-- flight parks at cancel_requested and the finalizer drains it later.

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'ad100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'cancel-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('ad200000-0000-4000-8000-000000000001', 'Cancel Workspace', 'cancel-workspace',
        'ad100000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values ('ad200000-0000-4000-8000-000000000001', 'ad100000-0000-4000-8000-000000000001',
        'owner', 'active');

insert into public.projects (id, workspace_id, name, created_by)
values ('ad210000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
        'Cancel Project', 'ad100000-0000-4000-8000-000000000001');

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values ('ad220000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
        'ad210000-0000-4000-8000-000000000001', 'Cancel Canvas',
        'ad100000-0000-4000-8000-000000000001');

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot, canonical_hash,
  actor_type, reason
) values (
  'ad230000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
  'ad220000-0000-4000-8000-000000000001', 1, '{"nodes":[],"edges":[]}'::jsonb,
  repeat('c', 64), 'user', 'cancel fixture'
);

insert into public.quotes (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, price_catalog_version_id,
  execution_plan, quote_hash, maximum_charge_micros, created_by, expires_at
) values (
  'ad240000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
  'ad210000-0000-4000-8000-000000000001', 'ad220000-0000-4000-8000-000000000001',
  'ad230000-0000-4000-8000-000000000001', '0c000000-0000-4000-8000-000000000002',
  '[]'::jsonb, repeat('d', 64), 1000000, 'ad100000-0000-4000-8000-000000000001',
  statement_timestamp() + interval '15 minutes'
);

-- Run A: all attempts still created; cancel should terminalize immediately.
insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status
) values (
  'ad400000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
  'ad210000-0000-4000-8000-000000000001', 'ad220000-0000-4000-8000-000000000001',
  'ad230000-0000-4000-8000-000000000001', repeat('c', 64),
  'ad240000-0000-4000-8000-000000000001', 'ad100000-0000-4000-8000-000000000001', 'queued'
);

insert into public.run_nodes (id, workspace_id, run_id, node_key, model_route_id, status)
values ('ad500000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
        'ad400000-0000-4000-8000-000000000001', 'master-1',
        '0b000000-0000-4000-8000-000000000002', 'ready');

insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id, attempt_number, request_id,
  status
) values ('ad600000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
          'ad400000-0000-4000-8000-000000000001', 'ad500000-0000-4000-8000-000000000001',
          '0a000000-0000-4000-8000-000000000001', 1, 'cancel-fixture-a1', 'created');

insert into public.cost_reservations (id, workspace_id, quote_id, run_id, amount_micros)
values ('ad700000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001',
        'ad240000-0000-4000-8000-000000000001', 'ad400000-0000-4000-8000-000000000001', 1000000);

select public.record_ledger_movement(
  'ad200000-0000-4000-8000-000000000001', 'credit', 2000000,
  'cancel-fixture-credit', null, null, 'cancel-fixture', '{}'::jsonb);
select public.record_ledger_movement(
  'ad200000-0000-4000-8000-000000000001', 'reserve', 1000000,
  'run:ad400000-0000-4000-8000-000000000001:reserve',
  'ad700000-0000-4000-8000-000000000001', 'ad400000-0000-4000-8000-000000000001',
  'cancel-fixture', '{}'::jsonb);

-- Run B: one attempt with the provider; cancel must park, not terminalize.
insert into public.runs (
  id, workspace_id, project_id, canvas_id, canvas_revision_id, canvas_revision_hash,
  quote_id, confirmed_by, status
) values (
  'ad400000-0000-4000-8000-000000000002', 'ad200000-0000-4000-8000-000000000001',
  'ad210000-0000-4000-8000-000000000001', 'ad220000-0000-4000-8000-000000000001',
  'ad230000-0000-4000-8000-000000000001', repeat('c', 64),
  'ad240000-0000-4000-8000-000000000001', 'ad100000-0000-4000-8000-000000000001', 'running'
);

insert into public.run_nodes (id, workspace_id, run_id, node_key, model_route_id, status)
values
  ('ad500000-0000-4000-8000-000000000002', 'ad200000-0000-4000-8000-000000000001',
   'ad400000-0000-4000-8000-000000000002', 'master-1',
   '0b000000-0000-4000-8000-000000000002', 'queued'),
  ('ad500000-0000-4000-8000-000000000003', 'ad200000-0000-4000-8000-000000000001',
   'ad400000-0000-4000-8000-000000000002', 'master-2',
   '0b000000-0000-4000-8000-000000000002', 'ready');

insert into public.attempts (
  id, workspace_id, run_id, run_node_id, provider_registration_id, attempt_number, request_id,
  status
) values
  ('ad600000-0000-4000-8000-000000000002', 'ad200000-0000-4000-8000-000000000001',
   'ad400000-0000-4000-8000-000000000002', 'ad500000-0000-4000-8000-000000000002',
   '0a000000-0000-4000-8000-000000000001', 1, 'cancel-fixture-b1', 'submitted'),
  ('ad600000-0000-4000-8000-000000000003', 'ad200000-0000-4000-8000-000000000001',
   'ad400000-0000-4000-8000-000000000002', 'ad500000-0000-4000-8000-000000000003',
   '0a000000-0000-4000-8000-000000000001', 1, 'cancel-fixture-b2', 'created');

set local role authenticated;
set local request.jwt.claim.sub = 'ad100000-0000-4000-8000-000000000001';

-- Run A: immediate terminalization with full release.
select is(
  (public.request_run_cancellation(
    'ad400000-0000-4000-8000-000000000001', 'operator asked', 'req-cancel-a'
  ) ->> 'status'),
  'ok',
  'cancelling a queued run is accepted'
);

select is(
  (select status from public.runs where id = 'ad400000-0000-4000-8000-000000000001'),
  'canceled',
  'a run with nothing in flight terminalizes as canceled'
);

select is(
  (select status from public.attempts where id = 'ad600000-0000-4000-8000-000000000001'),
  'canceled',
  'its created attempt is canceled'
);

select is(
  (select amount_micros - captured_micros - released_micros from public.cost_reservations
   where id = 'ad700000-0000-4000-8000-000000000001'),
  0::bigint,
  'its reservation nets to zero residual'
);

-- Repeat cancel is idempotent, not an error.
select is(
  (public.request_run_cancellation(
    'ad400000-0000-4000-8000-000000000001', 'operator asked again', 'req-cancel-a2'
  ) ->> 'status'),
  'conflict',
  'cancelling an already-canceled run reports conflict with the terminal state'
);

-- Run B: parks at cancel_requested; submitted attempt untouched.
select is(
  (public.request_run_cancellation(
    'ad400000-0000-4000-8000-000000000002', 'operator asked', 'req-cancel-b'
  ) ->> 'status'),
  'ok',
  'cancelling a running run is accepted'
);

select is(
  (select status from public.runs where id = 'ad400000-0000-4000-8000-000000000002'),
  'cancel_requested',
  'a run with in-flight work parks at cancel_requested'
);

select is(
  (select status from public.attempts where id = 'ad600000-0000-4000-8000-000000000002'),
  'submitted',
  'the in-flight attempt is left to the webhook and reconciler'
);

select is(
  (select status from public.attempts where id = 'ad600000-0000-4000-8000-000000000003'),
  'canceled',
  'the not-yet-dispatched attempt is canceled'
);

-- Drain the in-flight attempt, then the finalizer terminalizes the parked run.
reset role;

update public.attempts set status = 'failed'
where id = 'ad600000-0000-4000-8000-000000000002';

select is(
  (public.finalize_cancel_requested_runs(10) ->> 'finalized')::integer,
  1,
  'the finalizer terminalizes a drained cancel_requested run'
);

select is(
  (select status from public.runs where id = 'ad400000-0000-4000-8000-000000000002'),
  'failed',
  'a drained cancel with a failed in-flight attempt reports failed, not canceled'
);

-- Dispatch expansion refuses cancelling runs even mid-lease.
insert into public.outbox_events (
  id, workspace_id, aggregate_type, aggregate_id, event_type, dedupe_key, payload, status,
  lease_owner, lease_expires_at
) values (
  'ad300000-0000-4000-8000-000000000001', 'ad200000-0000-4000-8000-000000000001', 'run',
  'ad400000-0000-4000-8000-000000000001', 'run.dispatch_requested',
  'run:ad400000-0000-4000-8000-000000000001:dispatch:1', '{}'::jsonb, 'leased',
  'cancel-test-lease', statement_timestamp() + interval '90 seconds'
);

select is(
  (select count(*)::integer from public.get_outbox_dispatch_attempts(
    'ad300000-0000-4000-8000-000000000001', 'cancel-test-lease')),
  0,
  'the dispatch expansion returns nothing for a canceled run'
);

select * from finish();

rollback;
