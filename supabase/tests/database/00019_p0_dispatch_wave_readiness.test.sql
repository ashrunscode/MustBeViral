begin;

select plan(15);

-- create_quote hardcoded 'ready', true on every plan line, so start_run_barrier marked all 16
-- launch-pack nodes ready and handed them to providers simultaneously. The graph carried real edges
-- and the graph package validated the DAG; nothing translated those edges into scheduling, so an
-- adaptation was submitted at the same moment as the master whose output it needs as input.
--
-- These tests drive the whole readiness lifecycle with FABRICATED artifacts and no provider call:
-- waves are derived from edges, attempts are created eagerly but gated at dispatch, a wave unlocks
-- only when every one of its parents has succeeded, and a failed parent skips its children AND
-- cancels their attempts so the run can still terminalize.

create temporary table wave_graph (graph_snapshot jsonb) on commit drop;
create temporary table quote_result (payload jsonb) on commit drop;
create temporary table run_result (payload jsonb) on commit drop;

-- The fixture tables are owned by the session user, but the quote and barrier calls below run as
-- `authenticated`, so that role needs explicit access to them.
grant select on pg_temp.wave_graph to authenticated;
grant select, insert on pg_temp.quote_result to authenticated;
grant select, insert on pg_temp.run_result to authenticated;

-- The real launch-pack shape: copy -> masters -> {adaptations, motion}. motion-1 deliberately has
-- TWO parents (master-1 and master-2) so the "every parent must have succeeded" rule is exercised
-- rather than assumed.
insert into wave_graph (graph_snapshot)
select jsonb_build_object(
  'nodes',
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', node.node_id,
        'kind', 'output',
        'parameter_schema_version', 1,
        'parameters',
          case
            when node.role = 'motion_branch'
              then jsonb_build_object('asset_role', node.role, 'duration_seconds', 8)
            else jsonb_build_object('asset_role', node.role)
          end
      )
      order by node.sort_order, node.node_id
    )
    from (
      select 'copy_set'::text as role, 'copy-' || ordinal::text as node_id, 1 as sort_order
      from generate_series(1, 3) as ordinal
      union all
      select 'master_static', 'master-' || ordinal::text, 2
      from generate_series(1, 3) as ordinal
      union all
      select 'adaptation', 'adaptation-' || ordinal::text, 3
      from generate_series(1, 9) as ordinal
      union all
      select 'motion_branch', 'motion-1', 4
    ) as node
  ),
  'edges',
  (
    -- The edge id is derived in an inner query: a window function cannot sit inside jsonb_agg.
    select jsonb_agg(
      jsonb_build_object(
        'id', 'edge-' || numbered.edge_number::text,
        'kind', 'dependency',
        'source_node_id', numbered.source_node_id,
        'target_node_id', numbered.target_node_id
      )
      order by numbered.edge_number
    )
    from (
      select
        edge.source_node_id,
        edge.target_node_id,
        row_number() over (order by edge.source_node_id, edge.target_node_id) as edge_number
      from (
      -- copy-N feeds master-N
      select 'copy-' || ordinal::text as source_node_id, 'master-' || ordinal::text as target_node_id
      from generate_series(1, 3) as ordinal
      union all
      -- master-N feeds adaptations 3N-2 .. 3N
      select 'master-' || ordinal::text, 'adaptation-' || ((ordinal - 1) * 3 + offset_n)::text
      from generate_series(1, 3) as ordinal
      cross join generate_series(1, 3) as offset_n
      union all
      -- motion-1 needs BOTH master-1 and master-2
      select 'master-1', 'motion-1'
      union all
      select 'master-2', 'motion-1'
      ) as edge
    ) as numbered
  )
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'ae100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'wave-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('ae200000-0000-4000-8000-000000000001', 'Wave Workspace', 'wave-workspace',
        'ae100000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values ('ae200000-0000-4000-8000-000000000001', 'ae100000-0000-4000-8000-000000000001',
        'owner', 'active');

insert into public.projects (id, workspace_id, name, created_by)
values ('ae210000-0000-4000-8000-000000000001', 'ae200000-0000-4000-8000-000000000001',
        'Wave Project', 'ae100000-0000-4000-8000-000000000001');

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values ('ae220000-0000-4000-8000-000000000001', 'ae200000-0000-4000-8000-000000000001',
        'ae210000-0000-4000-8000-000000000001', 'Wave Canvas',
        'ae100000-0000-4000-8000-000000000001');

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot, canonical_hash,
  actor_type, reason
)
select
  'ae230000-0000-4000-8000-000000000001', 'ae200000-0000-4000-8000-000000000001',
  'ae220000-0000-4000-8000-000000000001', 1, graph_snapshot,
  repeat('9', 64), 'system', 'wave fixture'
from wave_graph;

update public.canvases
set head_revision_id = 'ae230000-0000-4000-8000-000000000001'
where id = 'ae220000-0000-4000-8000-000000000001';

-- Fund the wallet so the barrier's cap and balance checks pass on their own terms.
select public.record_ledger_movement(
  'ae200000-0000-4000-8000-000000000001', 'credit', 8000000,
  'wave-fixture-credit', null, null, 'wave-fixture', '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = 'ae100000-0000-4000-8000-000000000001';

insert into quote_result (payload)
select public.create_quote(
  'ae200000-0000-4000-8000-000000000001',
  'ae220000-0000-4000-8000-000000000001',
  'ae230000-0000-4000-8000-000000000001',
  'wave-quote-key',
  'wave-quote-request'
);

-- Scheduling is now in the plan, but the customer-facing total must not move.
select is(
  (select payload ->> 'maximum_charge_micros' from quote_result),
  '4550000',
  'adding dispatch waves leaves the launch pack priced at 4,550,000 micros'
);

select is(
  (
    select count(*)::integer
    from quote_result
    cross join lateral jsonb_array_elements(
      (select execution_plan from public.quotes
       where id = (quote_result.payload ->> 'quote_id')::uuid)
    ) as line(item)
    where (line.item ->> 'dispatch_wave')::integer = 1
  ),
  3,
  'wave 1 is exactly the three copy nodes'
);

select is(
  (
    select count(*)::integer
    from quote_result
    cross join lateral jsonb_array_elements(
      (select execution_plan from public.quotes
       where id = (quote_result.payload ->> 'quote_id')::uuid)
    ) as line(item)
    where (line.item ->> 'ready')::boolean
  ),
  3,
  'only wave 1 is marked ready; the other thirteen nodes wait'
);

select is(
  (
    select count(distinct line.item ->> 'dispatch_wave')::integer
    from quote_result
    cross join lateral jsonb_array_elements(
      (select execution_plan from public.quotes
       where id = (quote_result.payload ->> 'quote_id')::uuid)
    ) as line(item)
  ),
  3,
  'the pack resolves to three waves: copy, masters, then adaptations and motion together'
);

insert into run_result (payload)
select public.start_run_barrier(
  'ae200000-0000-4000-8000-000000000001',
  'ae220000-0000-4000-8000-000000000001',
  'ae230000-0000-4000-8000-000000000001',
  (select (payload ->> 'quote_id')::uuid from quote_result),
  true,
  'wave-run-key',
  'wave-run-request'
);

reset role;

select is(
  (select count(*)::integer from public.run_nodes
   where run_id = (select (payload ->> 'run_id')::uuid from run_result)
     and status = 'ready'),
  3,
  'the barrier marks only wave 1 ready'
);

-- Load-bearing: attempts are created for EVERY node up front. advance_fal_provider_attempt's
-- terminal predicate is "no attempt in a non-terminal state", so if attempts were created per wave,
-- wave 1 completing would satisfy it, release the whole reservation, and leave wave 2 submitting
-- against nothing.
select is(
  (select count(*)::integer from public.attempts
   where run_id = (select (payload ->> 'run_id')::uuid from run_result)
     and status = 'created'),
  16,
  'all sixteen attempts exist at created immediately after the barrier'
);

-- The dispatch gate is what makes eager attempts safe.
select is(
  (
    select count(*)::integer
    from public.get_outbox_dispatch_attempts(
      (select id from public.outbox_events
       where aggregate_id = (select (payload ->> 'run_id')::uuid from run_result)
       order by created_at limit 1),
      'wave-lease-owner'
    )
  ),
  0,
  'dispatch expands nothing while the event is unleased'
);

update public.outbox_events
set status = 'leased', lease_owner = 'wave-lease-owner', lease_expires_at = now() + interval '90 seconds'
where aggregate_id = (select (payload ->> 'run_id')::uuid from run_result);

select is(
  (
    select count(*)::integer
    from public.get_outbox_dispatch_attempts(
      (select id from public.outbox_events
       where aggregate_id = (select (payload ->> 'run_id')::uuid from run_result)
       order by created_at limit 1),
      'wave-lease-owner'
    )
  ),
  3,
  'dispatch hands over only wave 1, not all sixteen attempts'
);

-- Wave 1 completes. No provider involved: mark the copy attempts succeeded directly.
update public.attempts
set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from run_result)
  and run_node_id in (
    select id from public.run_nodes
    where run_id = (select (payload ->> 'run_id')::uuid from run_result)
      and node_key like 'copy-%'
  );
update public.run_nodes
set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from run_result)
  and node_key like 'copy-%';

select app_private.advance_run_readiness(
  'ae200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from run_result)
);

select is(
  (select count(*)::integer from public.run_nodes
   where run_id = (select (payload ->> 'run_id')::uuid from run_result)
     and status = 'ready'
     and node_key like 'master-%'),
  3,
  'completing the copy wave promotes exactly the three masters'
);

select is(
  (select count(*)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from run_result)
     and dedupe_key like '%:dispatch:2'),
  1,
  'exactly one new dispatch event is armed for wave 2'
);

-- Idempotency: a replayed settlement must not arm a second event for the same wave.
select app_private.advance_run_readiness(
  'ae200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from run_result)
);

select is(
  (select count(*)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from run_result)
     and dedupe_key like '%:dispatch:2'),
  1,
  'advancing readiness twice arms no duplicate event for the same wave'
);

-- motion-1 has two parents. Succeed only one and it must stay put.
update public.attempts
set status = 'succeeded'
where run_node_id in (
  select id from public.run_nodes
  where run_id = (select (payload ->> 'run_id')::uuid from run_result)
    and node_key = 'master-1'
);
update public.run_nodes
set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from run_result)
  and node_key = 'master-1';

select app_private.advance_run_readiness(
  'ae200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from run_result)
);

select is(
  (select status from public.run_nodes
   where run_id = (select (payload ->> 'run_id')::uuid from run_result)
     and node_key = 'motion-1'),
  'pending',
  'a node with two parents waits until both have succeeded, not just one'
);

-- master-3 fails. Its three adaptations can never receive an input, and their eagerly created
-- attempts must be canceled or the run never terminalizes and the reservation never settles.
update public.attempts
set status = 'failed'
where run_node_id in (
  select id from public.run_nodes
  where run_id = (select (payload ->> 'run_id')::uuid from run_result)
    and node_key = 'master-3'
);
update public.run_nodes
set status = 'failed'
where run_id = (select (payload ->> 'run_id')::uuid from run_result)
  and node_key = 'master-3';

select app_private.advance_run_readiness(
  'ae200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from run_result)
);

select is(
  (select count(*)::integer from public.run_nodes
   where run_id = (select (payload ->> 'run_id')::uuid from run_result)
     and status = 'skipped'
     and node_key in ('adaptation-7', 'adaptation-8', 'adaptation-9')),
  3,
  'a failed master skips exactly its own three adaptations'
);

select is(
  (select count(*)::integer from public.attempts
   where run_node_id in (
     select id from public.run_nodes
     where run_id = (select (payload ->> 'run_id')::uuid from run_result)
       and node_key in ('adaptation-7', 'adaptation-8', 'adaptation-9')
   )
   and status = 'canceled'),
  3,
  'skipping a node also cancels its attempts so the run can still terminalize'
);

select is(
  (select coalesce(sum(case when direction = 'credit' then amount_micros else -amount_micros end), 0)::bigint
   from public.ledger_transactions
   where workspace_id = 'ae200000-0000-4000-8000-000000000001'),
  0::bigint,
  'the workspace ledger stays balanced across the whole readiness lifecycle'
);

select * from finish();

rollback;
