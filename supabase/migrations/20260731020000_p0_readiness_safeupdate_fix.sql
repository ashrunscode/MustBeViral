begin;

-- The true root cause of BOTH stranded-settlement incidents, found by replicating the Worker's
-- PostgREST call byte-for-byte with curl instead of validating through direct SQL:
--
--   HTTP 400 {"code":"21000","message":"DELETE requires a WHERE clause"}
--
-- app_private.advance_run_readiness cleared its per-transaction scratch table with a bare
-- `delete from pg_temp_run_edges;`. Supabase loads pg_safeupdate on API connections ONLY, so every
-- call arriving through PostgREST - which is every call the Worker makes - failed with 21000, while
-- every direct SQL validation (psql, the MCP tool, pgTAP as postgres) sailed through. The Worker
-- mapped the 400 to a retryable "unavailable", returned 503, and the provider redelivered forever.
--
-- advance_run_readiness runs inside every settle_attempt_transition, so this broke the terminal
-- advance for EVERY provider: the copy incident (three captured attempts stranded at 'submitted')
-- and the fal master stranded at 'running' eleven minutes after its capture were the same bug. The
-- five missing service_role grants found along the way were real defects - the dispatch cron was
-- genuinely failing on them - but fixing them only moved the failure one call further down the
-- chain, to here.
--
-- The lesson, recorded where the next person will look: pg_safeupdate makes "it works when I run
-- the SQL myself" categorically insufficient for anything the Worker calls. Verification must
-- replicate the PostgREST path (apikey header, service_role, REST /rpc endpoint) or it proves
-- nothing about production behaviour.
--
-- The fix is the function body below, identical to 20260730060000's definition except the one line:
-- `delete from pg_temp_run_edges where true;` - the explicit WHERE satisfies pg_safeupdate and is
-- semantically identical.
create or replace function app_private.advance_run_readiness(
  p_workspace_id uuid,
  p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_promoted integer := 0;
  v_next_wave integer;
  v_edges jsonb;
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

  -- Arm a NEW event for the wave rather than re-arming the run's existing dispatch row. Re-arming a
  -- row that may be under a live 90-second lease either double-claims it or silently drops the wave.
  -- dedupe_key is globally unique, so a replayed settlement collapses onto the same row and the
  -- insert is a no-op - which is what makes calling this twice safe.
  insert into public.outbox_events (
    workspace_id, aggregate_type, aggregate_id, event_type, dedupe_key, payload
  )
  values (
    p_workspace_id,
    'run',
    p_run_id,
    'run.dispatch_requested',
    'run:' || p_run_id::text || ':dispatch:' || v_next_wave::text,
    jsonb_build_object('run_id', p_run_id, 'workspace_id', p_workspace_id, 'wave', v_next_wave)
  )
  on conflict (dedupe_key) do nothing;

  update public.runs
  set dispatch_wave = greatest(dispatch_wave, v_next_wave)
  where workspace_id = p_workspace_id
    and id = p_run_id;
end;
$fn$;

revoke all on function app_private.advance_run_readiness(uuid, uuid) from public;

commit;
