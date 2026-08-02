begin;

select plan(14);

-- Suite 00019 settles a whole wave in one statement, which is why it never caught this.
--
-- Real waves do not complete atomically. Each child is promoted when ITS OWN parents finish, so a
-- wave containing nine adaptations fed by three masters is promoted in three separate batches as
-- each master settles. advance_run_readiness keyed its outbox event on the wave alone
-- ('run:<id>:dispatch:3') with `on conflict do nothing`, so only the FIRST batch ever armed an
-- event. The rest were left `ready` with a `created` attempt and nothing to dispatch them.
--
-- Live consequence, WashBodega August pack: seven of sixteen nodes orphaned, run stuck at 'running'
-- forever, 2,000,000 micros of a 4,550,000 reservation never released. reap_dead_dispatch could not
-- recover it - that reaper requires a 'dead' event, and these events had published normally.
--
-- These tests settle the masters ONE AT A TIME, which is the only way the bug is visible.

create temporary table stagger_graph (graph_snapshot jsonb) on commit drop;
create temporary table stagger_quote (payload jsonb) on commit drop;
create temporary table stagger_run (payload jsonb) on commit drop;

grant select on pg_temp.stagger_graph to authenticated;
grant select, insert on pg_temp.stagger_quote to authenticated;
grant select, insert on pg_temp.stagger_run to authenticated;

-- copy-N -> master-N -> adaptations 3N-2..3N, and motion-1 needs BOTH master-1 and master-2.
insert into stagger_graph (graph_snapshot)
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
      select 'master_static', 'master-' || ordinal::text, 2 from generate_series(1, 3) as ordinal
      union all
      select 'adaptation', 'adaptation-' || ordinal::text, 3 from generate_series(1, 9) as ordinal
      union all
      select 'motion_branch', 'motion-1', 4
    ) as node
  ),
  'edges',
  (
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
        select 'copy-' || ordinal::text as source_node_id,
               'master-' || ordinal::text as target_node_id
        from generate_series(1, 3) as ordinal
        union all
        select 'master-' || ordinal::text, 'adaptation-' || ((ordinal - 1) * 3 + offset_n)::text
        from generate_series(1, 3) as ordinal cross join generate_series(1, 3) as offset_n
        union all
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
  'b1100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'stagger-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('b1200000-0000-4000-8000-000000000001', 'Stagger Workspace', 'stagger-workspace',
        'b1100000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values ('b1200000-0000-4000-8000-000000000001', 'b1100000-0000-4000-8000-000000000001',
        'owner', 'active');

insert into public.projects (id, workspace_id, name, created_by)
values ('b1210000-0000-4000-8000-000000000001', 'b1200000-0000-4000-8000-000000000001',
        'Stagger Project', 'b1100000-0000-4000-8000-000000000001');

insert into public.canvases (id, workspace_id, project_id, name, created_by)
values ('b1220000-0000-4000-8000-000000000001', 'b1200000-0000-4000-8000-000000000001',
        'b1210000-0000-4000-8000-000000000001', 'Stagger Canvas',
        'b1100000-0000-4000-8000-000000000001');

insert into public.canvas_revisions (
  id, workspace_id, canvas_id, graph_schema_version, graph_snapshot, canonical_hash,
  actor_type, reason
)
select
  'b1230000-0000-4000-8000-000000000001', 'b1200000-0000-4000-8000-000000000001',
  'b1220000-0000-4000-8000-000000000001', 1, graph_snapshot,
  repeat('7', 64), 'system', 'stagger fixture'
from stagger_graph;

update public.canvases
set head_revision_id = 'b1230000-0000-4000-8000-000000000001'
where id = 'b1220000-0000-4000-8000-000000000001';

select public.record_ledger_movement(
  'b1200000-0000-4000-8000-000000000001', 'credit', 8000000,
  'stagger-fixture-credit', null, null, 'stagger-fixture', '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = 'b1100000-0000-4000-8000-000000000001';

insert into stagger_quote (payload)
select public.create_quote(
  'b1200000-0000-4000-8000-000000000001',
  'b1220000-0000-4000-8000-000000000001',
  'b1230000-0000-4000-8000-000000000001',
  'stagger-quote-key',
  'stagger-quote-request'
);

insert into stagger_run (payload)
select public.start_run_barrier(
  'b1200000-0000-4000-8000-000000000001',
  'b1220000-0000-4000-8000-000000000001',
  'b1230000-0000-4000-8000-000000000001',
  (select (payload ->> 'quote_id')::uuid from stagger_quote),
  true,
  'stagger-run-key',
  'stagger-run-request'
);

reset role;

-- Settle the copy wave so the masters become ready. Whole-wave settlement here is deliberate: this
-- reproduces the ONE shape the old keying handled correctly, establishing the baseline.
update public.attempts set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
  and run_node_id in (select id from public.run_nodes
                      where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
                        and node_key like 'copy-%');
update public.run_nodes set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
  and node_key like 'copy-%';

select app_private.advance_run_readiness(
  'b1200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from stagger_run));

select is(
  (select count(*)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and dedupe_key like '%:dispatch:2:%'),
  1,
  'the copy wave completing arms one wave-2 event'
);

select is(
  (select dispatch_epoch from public.runs
   where id = (select (payload ->> 'run_id')::uuid from stagger_run)),
  1,
  'the first promotion takes epoch 1'
);

-- ---------------------------------------------------------------------------------------------
-- master-1 alone. Promotes adaptations 1-3, but NOT motion-1, which also waits on master-2.
-- ---------------------------------------------------------------------------------------------
update public.attempts set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
  and run_node_id in (select id from public.run_nodes
                      where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
                        and node_key = 'master-1');
update public.run_nodes set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
  and node_key = 'master-1';

select app_private.advance_run_readiness(
  'b1200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from stagger_run));

select is(
  (select count(*)::integer from public.run_nodes
   where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and status = 'ready' and node_key like 'adaptation-%'),
  3,
  'master-1 settling promotes exactly its own three adaptations'
);

select is(
  (select count(*)::integer from public.run_nodes
   where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and node_key = 'motion-1' and status = 'pending'),
  1,
  'motion-1 stays pending while master-2 is outstanding'
);

-- Counted as total dispatch events, not by wave number. The wave in the key is only a label: it is
-- min(dispatch_wave) over everything still ready, so while masters 2 and 3 were outstanding these
-- wave-3 promotions were stamped "wave 2". The dispatch gate ignores it entirely and takes every
-- ready+created attempt. That is the second reason keying the dedupe on it was wrong - the label is
-- neither unique per batch nor descriptive of what dispatches.
-- Running total: 1 from the barrier, 1 from the copy wave, 1 here.
select is(
  (select count(*)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and event_type = 'run.dispatch_requested'),
  3,
  'the first wave-3 batch arms its own event'
);

-- ---------------------------------------------------------------------------------------------
-- master-2 alone. THE REGRESSION: a second promotion inside wave 3. Under the old key this
-- collided with the row above and was silently discarded, orphaning everything it promoted.
-- ---------------------------------------------------------------------------------------------
update public.attempts set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
  and run_node_id in (select id from public.run_nodes
                      where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
                        and node_key = 'master-2');
update public.run_nodes set status = 'succeeded'
where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
  and node_key = 'master-2';

select app_private.advance_run_readiness(
  'b1200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from stagger_run));

-- THE REGRESSION. Under the old wave-only key this insert collided with the batch above and did
-- nothing, so everything master-2 promoted - including motion-1 - was orphaned.
select is(
  (select count(*)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and event_type = 'run.dispatch_requested'),
  4,
  'a second promotion in the same wave arms its own event rather than colliding'
);

select is(
  (select count(*)::integer from public.run_nodes
   where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and node_key = 'motion-1' and status = 'ready'),
  1,
  'motion-1 is promoted once both of its parents have succeeded'
);

-- The invariant that actually matters, stated directly: nothing is dispatchable-but-unqueued.
select is(
  (
    select count(*)::integer
    from public.run_nodes as node
    join public.attempts as attempt on attempt.run_node_id = node.id
    where node.run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
      and node.status = 'ready'
      and attempt.status = 'created'
      and not exists (
        select 1 from public.outbox_events as event
        where event.aggregate_id = node.run_id
          and event.event_type = 'run.dispatch_requested'
          and event.status in ('pending', 'leased')
      )
  ),
  0,
  'no ready attempt is left without a queued dispatch event'
);

-- A replayed settlement must still not arm anything: the promotion count guard, not the key, is
-- what makes that safe.
select app_private.advance_run_readiness(
  'b1200000-0000-4000-8000-000000000001',
  (select (payload ->> 'run_id')::uuid from stagger_run));

select is(
  (select count(*)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and event_type = 'run.dispatch_requested'),
  4,
  'replaying a settlement that promotes nothing arms no event'
);

-- ---------------------------------------------------------------------------------------------
-- arm_stranded_dispatch: the backstop that recovers runs already stranded by the old keying.
-- ---------------------------------------------------------------------------------------------
update public.outbox_events
set status = 'published', published_at = statement_timestamp()
where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run);

select is(
  ((select public.arm_stranded_dispatch(10)) ->> 'events_armed')::integer,
  1,
  'the sweeper arms an event for a run holding ready work with nothing queued'
);

select is(
  ((select public.arm_stranded_dispatch(10)) ->> 'events_armed')::integer,
  0,
  'the sweeper does not pile on while a queued event already exists'
);

-- With no dispatchable work left there is nothing to arm, published events notwithstanding.
update public.outbox_events
set status = 'published', published_at = statement_timestamp()
where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run);
update public.attempts set status = 'canceled'
where run_id = (select (payload ->> 'run_id')::uuid from stagger_run)
  and status = 'created';

select is(
  ((select public.arm_stranded_dispatch(10)) ->> 'events_armed')::integer,
  0,
  'the sweeper ignores a run with no created attempts left'
);

select ok(
  has_function_privilege('service_role', 'public.arm_stranded_dispatch(integer)', 'execute'),
  'service_role can execute arm_stranded_dispatch'
);

-- Every dedupe key the run produced after the barrier must be distinct, which is the property the
-- old key lacked. (The barrier's own 'dispatch:1' carries no epoch.)
select is(
  (select count(distinct dedupe_key)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and event_type = 'run.dispatch_requested'),
  (select count(*)::integer from public.outbox_events
   where aggregate_id = (select (payload ->> 'run_id')::uuid from stagger_run)
     and event_type = 'run.dispatch_requested'),
  'every dispatch event the run armed has a distinct dedupe key'
);

select * from finish();

rollback;
