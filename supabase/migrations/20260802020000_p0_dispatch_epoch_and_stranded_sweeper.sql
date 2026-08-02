-- p0-005: a wave whose nodes become ready at different times lost every promotion after the first.
--
-- advance_run_readiness armed one outbox event per WAVE:
--
--   dedupe_key = 'run:<run_id>:dispatch:<wave>'  ... on conflict (dedupe_key) do nothing
--
-- but readiness inside a wave is staggered, because each child is promoted when ITS parents finish.
-- In the WashBodega pack, wave 3 holds nine adaptations and one motion node fed by three different
-- masters. master-2 settled first, promoted its three adaptations, and armed dispatch:3. When
-- master-1 and master-3 settled they promoted their own children, tried to arm dispatch:3 again, hit
-- the conflict, and were dropped on the floor. Seven of sixteen nodes were left `ready` with a
-- `created` attempt and no event that would ever dispatch them.
--
-- The state is unrecoverable rather than merely slow: reap_dead_dispatch only rescues runs that have
-- a `dead` dispatch event, and these events all reached `published` normally. The run can never
-- terminalize, so its reservation remainder is never released.
--
-- The dedupe key was never what made replays safe - the `v_promoted = 0 then return` guard above the
-- insert already makes a replayed settlement a no-op, because the second call promotes nothing. The
-- key only needs to separate DISTINCT promotion batches, so it now carries a per-run monotonic
-- epoch. `dispatch:3:2` reads as "wave 3, second promotion batch", which keeps the audit trail.
--
-- Also adds arm_stranded_dispatch: a cron-driven backstop that arms an event for any live run
-- holding ready+created work with no queued dispatch event. The epoch fix closes the known cause;
-- the sweeper closes the category, including runs already stranded by the old code.

alter table public.runs
  add column if not exists dispatch_epoch integer not null default 0;

create or replace function app_private.advance_run_readiness(p_workspace_id uuid, p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_promoted integer := 0;
  v_next_wave integer;
  v_edges jsonb;
  v_epoch integer;
begin
  if p_workspace_id is null or p_run_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  -- Resolve the run's pinned graph edges once. The run pins a revision id, so this is the exact
  -- graph the run was quoted against and cannot drift if the canvas is edited mid-run.
  select revision.graph_snapshot -> 'edges'
  into v_edges
  from public.runs as run
  join public.canvas_revisions as revision
    on revision.workspace_id = run.workspace_id
   and revision.id = run.canvas_revision_id
  where run.workspace_id = p_workspace_id
    and run.id = p_run_id;

  if v_edges is null or jsonb_typeof(v_edges) <> 'array' then
    return;
  end if;

  -- Parent/child pairs for this run, restricted to nodes the run actually priced. run_nodes contains
  -- only priced nodes, so joining through it filters out brief and brand_context automatically -
  -- those are inputs every node reads, not producers anything waits on.
  create temporary table if not exists pg_temp_run_edges (
    parent_node_id uuid,
    child_node_id uuid,
    parent_status text
  ) on commit drop;
  -- `where true` is load-bearing: pg_safeupdate (API connections only) rejects a bare DELETE with
  -- SQLSTATE 21000, which is how every Worker-side settlement silently failed.
  delete from pg_temp_run_edges where true;

  insert into pg_temp_run_edges (parent_node_id, child_node_id, parent_status)
  select parent.id, child.id, parent.status
  from jsonb_array_elements(v_edges) as edge(item)
  join public.run_nodes as parent
    on parent.workspace_id = p_workspace_id
   and parent.run_id = p_run_id
   and parent.node_key = edge.item ->> 'source_node_id'
  join public.run_nodes as child
    on child.workspace_id = p_workspace_id
   and child.run_id = p_run_id
   and child.node_key = edge.item ->> 'target_node_id';

  -- A parent that failed, was canceled, or was itself skipped can never produce the input its
  -- children need. Marking the children 'skipped' is not enough: their attempts were created eagerly
  -- by start_run_barrier and would sit at 'created' forever, so the run would never reach a terminal
  -- state and its reservation would never settle. Cancel those attempts in the same statement.
  with doomed as (
    update public.run_nodes as child
    set status = 'skipped'
    where child.workspace_id = p_workspace_id
      and child.run_id = p_run_id
      and child.status in ('pending', 'ready')
      and exists (
        select 1
        from pg_temp_run_edges as edge
        where edge.child_node_id = child.id
          and edge.parent_status in ('failed', 'skipped', 'canceled')
      )
    returning child.id
  )
  update public.attempts as attempt
  set status = 'canceled'
  where attempt.workspace_id = p_workspace_id
    and attempt.run_node_id in (select id from doomed)
    and attempt.status not in ('succeeded', 'failed', 'canceled');

  -- Promote a pending node once EVERY one of its priced parents has succeeded. "Every" matters: a
  -- motion node with two parents must not start when only one of them is done.
  update public.run_nodes as child
  set status = 'ready'
  where child.workspace_id = p_workspace_id
    and child.run_id = p_run_id
    and child.status = 'pending'
    and exists (
      select 1 from pg_temp_run_edges as edge where edge.child_node_id = child.id
    )
    and not exists (
      select 1
      from pg_temp_run_edges as edge
      where edge.child_node_id = child.id
        and edge.parent_status <> 'succeeded'
    );

  -- This guard - not the dedupe key - is what makes a replayed settlement safe. A replay finds its
  -- children already promoted, updates zero rows, and returns without arming anything.
  get diagnostics v_promoted = row_count;
  if v_promoted = 0 then
    return;
  end if;

  select min(node.dispatch_wave)
  into v_next_wave
  from public.run_nodes as node
  where node.workspace_id = p_workspace_id
    and node.run_id = p_run_id
    and node.status = 'ready'
    and exists (
      select 1
      from public.attempts as attempt
      where attempt.workspace_id = node.workspace_id
        and attempt.run_node_id = node.id
        and attempt.status = 'created'
    );

  if v_next_wave is null then
    return;
  end if;

  -- Take the next epoch for this run. Distinct promotion batches must produce distinct events even
  -- when they land in the same wave; keying on the wave alone silently discarded every batch after
  -- the first, which is what stranded seven nodes of a sixteen-node pack.
  update public.runs
  set dispatch_epoch = dispatch_epoch + 1,
      dispatch_wave = greatest(dispatch_wave, v_next_wave)
  where workspace_id = p_workspace_id
    and id = p_run_id
  returning dispatch_epoch into v_epoch;

  -- Arm a NEW event rather than re-arming the run's existing dispatch row. Re-arming a row that may
  -- be under a live 90-second lease either double-claims it or silently drops the wave.
  insert into public.outbox_events (
    workspace_id, aggregate_type, aggregate_id, event_type, dedupe_key, payload
  )
  values (
    p_workspace_id,
    'run',
    p_run_id,
    'run.dispatch_requested',
    'run:' || p_run_id::text || ':dispatch:' || v_next_wave::text || ':' || v_epoch::text,
    jsonb_build_object(
      'run_id', p_run_id, 'workspace_id', p_workspace_id, 'wave', v_next_wave, 'epoch', v_epoch
    )
  )
  on conflict (dedupe_key) do nothing;
end;
$function$;

-- Backstop for the whole category, not just the epoch bug: any live run holding dispatchable work
-- with nothing queued to dispatch it. Covers runs stranded by the old keying, plus future causes
-- (an event lost, a crash between promotion and insert). Dispatch is gated on
-- run_node.status = 'ready' and attempt.status = 'created', so arming a redundant event is a no-op -
-- the claimant simply finds no attempts. That makes this safe to run every minute.
create or replace function public.arm_stranded_dispatch(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_run record;
  v_runs_examined integer := 0;
  v_events_armed integer := 0;
  v_epoch integer;
  v_wave integer;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  for v_run in
    select run.id, run.workspace_id
    from public.runs as run
    where run.status in ('queued', 'dispatching', 'running')
      -- Dispatchable work: a ready node whose attempt has not been handed to a provider.
      and exists (
        select 1
        from public.run_nodes as node
        join public.attempts as attempt
          on attempt.workspace_id = node.workspace_id
         and attempt.run_node_id = node.id
        where node.workspace_id = run.workspace_id
          and node.run_id = run.id
          and node.status = 'ready'
          and attempt.status = 'created'
      )
      -- ...and nothing already queued to pick it up. 'published' and 'dead' are both spent:
      -- published means the dispatcher already ran and did not take this work, dead is the
      -- reaper's business, not ours.
      and not exists (
        select 1
        from public.outbox_events as event
        where event.workspace_id = run.workspace_id
          and event.aggregate_id = run.id
          and event.event_type = 'run.dispatch_requested'
          and event.status in ('pending', 'leased')
      )
    order by run.created_at
    limit p_limit
    for update of run skip locked
  loop
    v_runs_examined := v_runs_examined + 1;

    select min(node.dispatch_wave)
    into v_wave
    from public.run_nodes as node
    where node.workspace_id = v_run.workspace_id
      and node.run_id = v_run.id
      and node.status = 'ready'
      and exists (
        select 1
        from public.attempts as attempt
        where attempt.workspace_id = node.workspace_id
          and attempt.run_node_id = node.id
          and attempt.status = 'created'
      );

    if v_wave is null then
      continue;
    end if;

    update public.runs
    set dispatch_epoch = dispatch_epoch + 1
    where workspace_id = v_run.workspace_id
      and id = v_run.id
    returning dispatch_epoch into v_epoch;

    insert into public.outbox_events (
      workspace_id, aggregate_type, aggregate_id, event_type, dedupe_key, payload
    )
    values (
      v_run.workspace_id,
      'run',
      v_run.id,
      'run.dispatch_requested',
      'run:' || v_run.id::text || ':dispatch:' || v_wave::text || ':' || v_epoch::text,
      jsonb_build_object(
        'run_id', v_run.id, 'workspace_id', v_run.workspace_id, 'wave', v_wave,
        'epoch', v_epoch, 'armed_by', 'stranded_sweeper'
      )
    )
    on conflict (dedupe_key) do nothing;

    v_events_armed := v_events_armed + 1;
  end loop;

  return jsonb_build_object(
    'runs_examined', v_runs_examined,
    'events_armed', v_events_armed
  );
end;
$function$;

-- The default-privileges bootstrap revokes execute from service_role on every new function, so a
-- privileged RPC that the Worker calls is dead on arrival without this. Suite 00021 guards the set.
revoke all on function public.arm_stranded_dispatch(integer) from public, anon, authenticated;
grant execute on function public.arm_stranded_dispatch(integer) to service_role;
