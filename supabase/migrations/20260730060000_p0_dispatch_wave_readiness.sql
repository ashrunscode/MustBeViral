begin;

-- Track C: translate the pinned graph's edges into dispatch waves.
--
-- create_quote hardcoded 'ready', true on every plan line, so start_run_barrier marked all 16
-- launch-pack nodes ready and dispatched them simultaneously. The graph carried real edges and the
-- graph package validated the DAG; nothing ever turned those edges into scheduling. An adaptation
-- was therefore submitted at the same moment as the master whose output it needs as input.
--
-- create_quote and start_run_barrier below are the CURRENT definitions with targeted edits applied
-- mechanically (see .scratch/build-track-c-migration.mjs); everything else is reproduced byte for
-- byte so this migration cannot quietly alter caps, idempotency, revision-conflict handling, or
-- reservation creation.
--
-- The quote hash changes, deliberately: the execution plan now carries scheduling. Customer-facing
-- totals do not move - the launch pack still quotes 4,550,000 micros.

alter table public.runs
  add column if not exists dispatch_wave integer not null default 1
    check (dispatch_wave > 0);

alter table public.run_nodes
  add column if not exists dispatch_wave integer not null default 1
    check (dispatch_wave > 0);

comment on column public.run_nodes.dispatch_wave is
  'Topological depth within the run: 1 + the longest priced-parent chain. Set from the quote plan.';

-- Dispatch reads (status, wave) for every non-terminal node on a run; the reaper and the readiness
-- advance both scan the same shape.
create index if not exists run_nodes_run_wave_status_idx
  on public.run_nodes (workspace_id, run_id, dispatch_wave, status);



-- Promote the next wave once its priced parents have succeeded, and skip-plus-cancel the children of
-- a node that did not. Lives in app_private and is called only from inside the settlement
-- transaction: the moment that unlocks wave N+1 is artifact registration plus capture, which already
-- happens in one Postgres transaction. Deciding readiness in the Worker instead would open a window
-- where an artifact exists and nothing will ever consume it.
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
  delete from pg_temp_run_edges;

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

-- Dispatch gate. Every dispatched attempt passes through this expansion, so restricting it to
-- ready nodes with un-dispatched attempts is what makes eager attempt creation safe: the attempts
-- all exist from the barrier onward, but only the current wave's are ever handed to a provider.
create or replace function public.get_outbox_dispatch_attempts(
  p_event_id uuid,
  p_lease_owner text
)
returns table (
  event_id uuid,
  workspace_id uuid,
  run_id uuid,
  attempt_id uuid,
  provider_registration_id uuid,
  route_id text,
  billing_idempotency_key text,
  node_parameters jsonb,
  execution_plan_line jsonb
)
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
begin
  if p_event_id is null
    or p_lease_owner is null or char_length(p_lease_owner) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  return query
  select
    event.id,
    event.workspace_id,
    run.id,
    attempt.id,
    attempt.provider_registration_id,
    route.route_key,
    attempt.request_id,
    coalesce(node.item -> 'parameters', '{}'::jsonb),
    plan.item
  from public.outbox_events as event
  join public.runs as run
    on run.workspace_id = event.workspace_id
   and run.id = event.aggregate_id
  join public.quotes as quote
    on quote.workspace_id = run.workspace_id
   and quote.id = run.quote_id
  join public.canvas_revisions as revision
    on revision.workspace_id = run.workspace_id
   and revision.canvas_id = run.canvas_id
   and revision.id = run.canvas_revision_id
  join public.run_nodes as run_node
    on run_node.workspace_id = run.workspace_id
   and run_node.run_id = run.id
  join public.attempts as attempt
    on attempt.workspace_id = run_node.workspace_id
   and attempt.run_node_id = run_node.id
  join public.model_routes as route
    on route.id = run_node.model_route_id
   and route.provider_registration_id = attempt.provider_registration_id
  cross join lateral jsonb_array_elements(revision.graph_snapshot -> 'nodes') as node(item)
  cross join lateral jsonb_array_elements(quote.execution_plan) as plan(item)
  where event.id = p_event_id
    and event.status = 'leased'
    and event.lease_owner = p_lease_owner
    and event.event_type = 'run.dispatch_requested'
    and event.aggregate_type = 'run'
    and run.status not in ('cancel_requested', 'canceled', 'failed', 'succeeded', 'partial_succeeded')
    -- The dispatch gate.
    and run_node.status = 'ready'
    and attempt.status = 'created'
    and node.item ->> 'id' = run_node.node_key
    and plan.item ->> 'node_id' = run_node.node_key
    and plan.item ->> 'model_route_id' = route.id::text
  order by attempt.created_at, attempt.id;
end;
$fn$;

revoke all on function public.get_outbox_dispatch_attempts(uuid, text) from public;


create or replace function public.create_quote(
  p_workspace_id uuid,
  p_canvas_id uuid,
  p_expected_revision_id uuid,
  p_idempotency_key text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_actor_id uuid := auth.uid();
  v_request_hash text;
  v_existing public.idempotency_records%rowtype;
  v_project_id uuid;
  v_head_revision_id uuid;
  v_graph_snapshot jsonb;
  v_per_run_spend_cap_micros bigint;
  v_catalog_version_id uuid;
  v_execution_plan jsonb := '[]'::jsonb;
  v_waves jsonb;
  v_wave integer;
  v_grand_total numeric := 0;
  v_node jsonb;
  v_role text;
  v_route_key text;
  v_unit text;
  v_duration_seconds text;
  v_quantity integer;
  v_route_id uuid;
  v_provider_model_id text;
  v_unit_price_micros bigint;
  v_line_total numeric;
  v_quote_id uuid := gen_random_uuid();
  v_quote_hash text;
  v_expires_at timestamptz;
  v_response jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not app_private.is_workspace_owner(p_workspace_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_workspace_id is null
    or p_canvas_id is null
    or p_expected_revision_id is null
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null
    or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'workspace_id', p_workspace_id,
    'canvas_id', p_canvas_id,
    'expected_revision_id', p_expected_revision_id
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':' || p_workspace_id::text || ':create_quote:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id = p_workspace_id
    and operation = 'quote_run'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  select
    canvas.project_id,
    canvas.head_revision_id,
    revision.graph_snapshot,
    workspace.per_run_spend_cap_micros
  into
    v_project_id,
    v_head_revision_id,
    v_graph_snapshot,
    v_per_run_spend_cap_micros
  from public.canvases as canvas
  join public.canvas_revisions as revision
    on revision.workspace_id = canvas.workspace_id
   and revision.canvas_id = canvas.id
   and revision.id = canvas.head_revision_id
  join public.workspaces as workspace
    on workspace.id = canvas.workspace_id
  where canvas.workspace_id = p_workspace_id
    and canvas.id = p_canvas_id
  for share of canvas, revision, workspace;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_head_revision_id <> p_expected_revision_id then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  select catalog.id
  into v_catalog_version_id
  from public.price_catalog_versions as catalog
  where catalog.status = 'active'
    and not exists (
      select 1
      from (
        values
          ('openrouter/chat-completions/copy', 'request'),
          ('fal/flux-2-pro/masters', 'image'),
          ('fal/flux-kontext-pro/adaptations', 'image'),
          ('fal/seedance-1.0-lite/motion', 'video_second')
      ) as required(route_key, unit)
      where not exists (
        select 1
        from public.model_routes as route
        join public.model_route_prices as price
          on price.model_route_id = route.id
         and price.price_catalog_version_id = catalog.id
         and price.unit = required.unit
        where route.route_key = required.route_key
          and route.status = 'enabled'
      )
    )
  order by catalog.effective_at desc, catalog.id desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'QUOTE_STALE';
  end if;


  -- Translate the pinned graph's edges into dispatch waves. Before this, every plan line carried
  -- 'ready', true, so start_run_barrier marked all 16 launch-pack nodes ready and dispatched them at
  -- once: the DAG was validated and then ignored. A node's wave is 1 + the longest priced-parent
  -- chain above it, which for the launch pack yields copy (1) -> masters (2) -> adaptations and
  -- motion (3, 4).
  --
  -- Only edges whose BOTH endpoints are priced participate. Unpriced nodes (brief, brand_context)
  -- are inputs supplied to every node, not producers anything waits on; treating them as parents
  -- would push the whole graph one wave later and leave wave 1 empty.
  with recursive priced as (
    select nodes.item ->> 'id' as node_id
    from jsonb_array_elements(v_graph_snapshot -> 'nodes') as nodes(item)
    where nodes.item -> 'parameters' ->> 'asset_role'
      in ('copy_set', 'master_static', 'adaptation', 'motion_branch')
      and nodes.item ->> 'id' is not null
  ),
  priced_edges as (
    select
      edges.item ->> 'source_node_id' as parent_id,
      edges.item ->> 'target_node_id' as child_id
    from jsonb_array_elements(v_graph_snapshot -> 'edges') as edges(item)
    where exists (
      select 1 from priced where priced.node_id = edges.item ->> 'source_node_id'
    )
    and exists (
      select 1 from priced where priced.node_id = edges.item ->> 'target_node_id'
    )
  ),
  depth as (
    select priced.node_id, 1 as wave
    from priced
    where not exists (
      select 1 from priced_edges where priced_edges.child_id = priced.node_id
    )
    union all
    -- The depth cap bounds the walk. The graph package already rejects cycles, so this is a
    -- belt-and-braces stop rather than the primary defence; a node left unresolved by it is caught
    -- by the per-node null check in the pricing loop below.
    select priced_edges.child_id, depth.wave + 1
    from depth
    join priced_edges on priced_edges.parent_id = depth.node_id
    where depth.wave < 64
  )
  select jsonb_object_agg(resolved.node_id, resolved.wave)
  into v_waves
  from (
    select depth.node_id, max(depth.wave) as wave
    from depth
    group by depth.node_id
  ) as resolved;

  v_waves := coalesce(v_waves, '{}'::jsonb);

  for v_node in
    select nodes.item
    from jsonb_array_elements(v_graph_snapshot -> 'nodes') with ordinality as nodes(item, ordinal)
    order by nodes.ordinal
  loop
    v_role := v_node -> 'parameters' ->> 'asset_role';
    if v_role is null
      or v_role not in ('copy_set', 'master_static', 'adaptation', 'motion_branch') then
      continue;
    end if;

    if v_node ->> 'id' is null or char_length(v_node ->> 'id') not between 1 and 200 then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;

    -- A priced node with no resolved wave means the walk above could not reach it, which for an
    -- acyclic graph is impossible and for a cyclic one is the only safe answer. Never guess a
    -- wave: guessing schedules a node before its input exists.
    v_wave := (v_waves ->> (v_node ->> 'id'))::integer;
    if v_wave is null or v_wave < 1 then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;

    case v_role
      when 'copy_set' then
        v_route_key := 'openrouter/chat-completions/copy';
        v_unit := 'request';
        v_quantity := 1;
      when 'master_static' then
        v_route_key := 'fal/flux-2-pro/masters';
        v_unit := 'image';
        v_quantity := 1;
      when 'adaptation' then
        v_route_key := 'fal/flux-kontext-pro/adaptations';
        v_unit := 'image';
        v_quantity := 1;
      when 'motion_branch' then
        v_route_key := 'fal/seedance-1.0-lite/motion';
        v_unit := 'video_second';
        v_duration_seconds := v_node -> 'parameters' ->> 'duration_seconds';
        if coalesce(v_duration_seconds, '') !~ '^[1-9][0-9]*$'
          or length(v_duration_seconds) > 9 then
          raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
        end if;
        if v_duration_seconds::numeric > 2147483647 then
          raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
        end if;
        v_quantity := v_duration_seconds::integer;
    end case;

    select route.id, route.provider_model_id, price.unit_price_micros
    into v_route_id, v_provider_model_id, v_unit_price_micros
    from public.model_routes as route
    join public.model_route_prices as price
      on price.model_route_id = route.id
     and price.price_catalog_version_id = v_catalog_version_id
     and price.unit = v_unit
    where route.route_key = v_route_key
      and route.status = 'enabled';

    if not found then
      raise exception using errcode = 'P0001', message = 'QUOTE_STALE';
    end if;

    v_line_total := v_unit_price_micros::numeric * v_quantity::numeric;
    if v_line_total < 0 or v_line_total > 9223372036854775807 then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;

    v_execution_plan := v_execution_plan || jsonb_build_array(jsonb_build_object(
      'ready', v_wave = 1,
      'dispatch_wave', v_wave,
      'node_id', v_node ->> 'id',
      'model_route_id', v_route_id::text,
      'provider_model_id', v_provider_model_id,
      'price_components', jsonb_build_array(jsonb_build_object(
        'unit', v_unit,
        'quantity', v_quantity::text,
        'unit_price_micros', v_unit_price_micros::text,
        'total_micros', v_line_total::text
      )),
      'total_micros', v_line_total::text
    ));
    v_grand_total := v_grand_total + v_line_total;
  end loop;

  if jsonb_array_length(v_execution_plan) = 0 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  if v_grand_total > 9223372036854775807 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  if v_grand_total > v_per_run_spend_cap_micros then
    raise exception using errcode = 'P0001', message = 'BUDGET_EXCEEDED';
  end if;

  v_quote_hash := app_private.hash_canonical_json(v_execution_plan);

  insert into public.quotes (
    id, workspace_id, project_id, canvas_id, canvas_revision_id, price_catalog_version_id,
    execution_plan, quote_hash, maximum_charge_micros, currency, created_by
  ) values (
    v_quote_id, p_workspace_id, v_project_id, p_canvas_id, p_expected_revision_id, v_catalog_version_id,
    v_execution_plan, v_quote_hash, v_grand_total::bigint, 'USD', v_actor_id
  )
  returning expires_at into v_expires_at;

  v_response := jsonb_build_object(
    'quote_id', v_quote_id,
    'maximum_charge_micros', v_grand_total::text,
    'price_catalog_version_id', v_catalog_version_id,
    'expires_at', v_expires_at
  );

  insert into public.idempotency_records (
    workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload
  ) values (
    p_workspace_id, v_actor_id, 'quote_run', p_idempotency_key, v_request_hash, v_response
  );

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    p_workspace_id, 'user', v_actor_id, 'quote.created', 'quote', v_quote_id, p_request_id,
    jsonb_build_object(
      'canvas_id', p_canvas_id,
      'revision_id', p_expected_revision_id,
      'price_catalog_version_id', v_catalog_version_id,
      'maximum_charge_micros', v_grand_total::text
    )
  );

  return v_response;
end;
$fn$;

create or replace function public.start_run_barrier(
  p_workspace_id uuid,
  p_canvas_id uuid,
  p_expected_revision_id uuid,
  p_quote_id uuid,
  p_confirmed boolean,
  p_idempotency_key text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_id uuid := auth.uid();
  v_workspace public.workspaces%rowtype;
  v_quote public.quotes%rowtype;
  v_current_revision_id uuid;
  v_current_revision_hash text;
  v_run_id uuid := gen_random_uuid();
  v_reservation_id uuid := gen_random_uuid();
  v_ledger_transaction_id uuid := gen_random_uuid();
  v_request_hash text;
  v_response jsonb;
  v_existing public.idempotency_records%rowtype;
  v_wallet_balance bigint;
  v_workspace_exposure bigint;
  v_global_exposure bigint;
  v_global_cap bigint;
  v_ready_count integer;
  v_day_start timestamptz := date_trunc('day', timezone('UTC', statement_timestamp())) at time zone 'UTC';
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not app_private.is_workspace_owner(p_workspace_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_confirmed is distinct from true
    or p_expected_revision_id is null
    or p_quote_id is null
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'workspace_id', p_workspace_id,
    'canvas_id', p_canvas_id,
    'expected_revision_id', p_expected_revision_id,
    'quote_id', p_quote_id,
    'confirmed', p_confirmed
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':' || p_workspace_id::text || ':start_run:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id = p_workspace_id
    and operation = 'start_run'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  select * into v_workspace
  from public.workspaces
  where id = p_workspace_id
  for update;

  if not found or v_workspace.status <> 'active' then
    raise exception using errcode = '42501', message = 'WORKSPACE_UNAVAILABLE';
  end if;

  select canvas.head_revision_id, revision.canonical_hash
  into v_current_revision_id, v_current_revision_hash
  from public.canvases as canvas
  join public.canvas_revisions as revision
    on revision.workspace_id = canvas.workspace_id
   and revision.canvas_id = canvas.id
   and revision.id = canvas.head_revision_id
  where canvas.workspace_id = p_workspace_id and canvas.id = p_canvas_id
  for update of canvas;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_current_revision_id <> p_expected_revision_id then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  select * into v_quote
  from public.quotes
  where workspace_id = p_workspace_id
    and canvas_id = p_canvas_id
    and canvas_revision_id = p_expected_revision_id
    and id = p_quote_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_quote.expires_at <= statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'QUOTE_EXPIRED';
  end if;
  if not exists (
    select 1
    from public.price_catalog_versions
    where id = v_quote.price_catalog_version_id and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'QUOTE_STALE';
  end if;
  if v_quote.maximum_charge_micros > v_workspace.per_run_spend_cap_micros then
    raise exception using errcode = 'P0001', message = 'BUDGET_EXCEEDED';
  end if;
  if exists (
    select 1 from public.runs
    where workspace_id = p_workspace_id and quote_id = p_quote_id
  ) then
    raise exception using errcode = 'P0001', message = 'QUOTE_ALREADY_USED';
  end if;

  select count(*)::integer into v_ready_count
  from jsonb_array_elements(v_quote.execution_plan) as plan(item)
  where coalesce((item ->> 'ready')::boolean, false)
    and item ? 'node_id'
    and item ? 'model_route_id';

  if v_ready_count < 1 then
    raise exception using errcode = '22023', message = 'QUOTE_PLAN_HAS_NO_READY_ATTEMPT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mustbeviral:global-spend:' || v_day_start::text, 0));

  select global_daily_spend_cap_micros into v_global_cap
  from app_private.platform_billing_settings
  where singleton
  for update;

  select coalesce(sum(greatest(
    amount_micros - released_micros,
    captured_micros - refunded_micros
  )), 0)::bigint
  into v_workspace_exposure
  from public.cost_reservations
  where workspace_id = p_workspace_id
    and created_at >= v_day_start
    and created_at < v_day_start + interval '1 day';

  select coalesce(sum(greatest(
    amount_micros - released_micros,
    captured_micros - refunded_micros
  )), 0)::bigint
  into v_global_exposure
  from public.cost_reservations
  where created_at >= v_day_start
    and created_at < v_day_start + interval '1 day';

  if v_workspace_exposure + v_quote.maximum_charge_micros > v_workspace.daily_spend_cap_micros
    or v_global_exposure + v_quote.maximum_charge_micros > v_global_cap then
    raise exception using errcode = 'P0001', message = 'BUDGET_EXCEEDED';
  end if;

  select coalesce(sum(
    case direction when 'credit' then amount_micros else -amount_micros end
  ), 0)::bigint
  into v_wallet_balance
  from public.ledger_transactions
  where workspace_id = p_workspace_id and account_code = 'wallet_available';

  if v_wallet_balance < v_quote.maximum_charge_micros then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_BALANCE';
  end if;

  insert into public.runs (
    id,
    workspace_id,
    project_id,
    canvas_id,
    canvas_revision_id,
    canvas_revision_hash,
    quote_id,
    status,
    confirmed_by
  ) values (
    v_run_id,
    p_workspace_id,
    v_quote.project_id,
    p_canvas_id,
    p_expected_revision_id,
    v_current_revision_hash,
    p_quote_id,
    'queued',
    v_actor_id
  );

  insert into public.cost_reservations (
    id, workspace_id, quote_id, run_id, amount_micros, status
  ) values (
    v_reservation_id,
    p_workspace_id,
    p_quote_id,
    v_run_id,
    v_quote.maximum_charge_micros,
    'active'
  );

  if v_quote.maximum_charge_micros > 0 then
    insert into public.ledger_transactions (
      workspace_id,
      transaction_id,
      entry_type,
      account_code,
      direction,
      amount_micros,
      causative_key,
      reservation_id,
      run_id,
      metadata
    ) values
      (
        p_workspace_id,
        v_ledger_transaction_id,
        'reserve',
        'wallet_available',
        'debit',
        v_quote.maximum_charge_micros,
        'run:' || v_run_id::text || ':reserve',
        v_reservation_id,
        v_run_id,
        jsonb_build_object('quote_id', p_quote_id)
      ),
      (
        p_workspace_id,
        v_ledger_transaction_id,
        'reserve',
        'wallet_reserved',
        'credit',
        v_quote.maximum_charge_micros,
        'run:' || v_run_id::text || ':reserve',
        v_reservation_id,
        v_run_id,
        jsonb_build_object('quote_id', p_quote_id)
      );
  end if;

  insert into public.run_nodes (
    workspace_id, run_id, node_key, model_route_id, status, dispatch_wave
  )
  select
    p_workspace_id,
    v_run_id,
    plan.item ->> 'node_id',
    (plan.item ->> 'model_route_id')::uuid,
    case when coalesce((plan.item ->> 'ready')::boolean, false) then 'ready' else 'pending' end,
    -- Quotes issued before dispatch waves existed carry no dispatch_wave and were all ready, so
    -- they collapse to a single wave 1 and behave exactly as they did.
    coalesce((plan.item ->> 'dispatch_wave')::integer, 1)
  from jsonb_array_elements(v_quote.execution_plan) as plan(item);

  insert into public.attempts (
    workspace_id,
    run_id,
    run_node_id,
    provider_registration_id,
    attempt_number,
    request_id,
    status
  )
  select
    run_node.workspace_id,
    run_node.run_id,
    run_node.id,
    route.provider_registration_id,
    1,
    v_run_id::text || ':' || substring(run_node.node_key from 1 for 120) || ':1',
    'created'
  from public.run_nodes as run_node
  join public.model_routes as route on route.id = run_node.model_route_id
  where run_node.workspace_id = p_workspace_id
    and run_node.run_id = v_run_id;

  insert into public.outbox_events (
    workspace_id,
    aggregate_type,
    aggregate_id,
    event_type,
    dedupe_key,
    payload
  ) values (
    p_workspace_id,
    'run',
    v_run_id,
    'run.dispatch_requested',
    'run:' || v_run_id::text || ':dispatch:1',
    jsonb_build_object('run_id', v_run_id, 'workspace_id', p_workspace_id)
  );

  v_response := jsonb_build_object(
    'run_id', v_run_id,
    'reservation_id', v_reservation_id,
    'quote_id', p_quote_id,
    'revision_id', p_expected_revision_id,
    'revision_hash', v_current_revision_hash,
    'status', 'queued'
  );

  insert into public.idempotency_records (
    workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload
  ) values (
    p_workspace_id, v_actor_id, 'start_run', p_idempotency_key, v_request_hash, v_response
  );

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    p_workspace_id,
    'user',
    v_actor_id,
    'run.started',
    'run',
    v_run_id,
    p_request_id,
    jsonb_build_object(
      'quote_id', p_quote_id,
      'revision_id', p_expected_revision_id,
      'reservation_id', v_reservation_id
    )
  );

  return v_response;
end;
$$;

create or replace function public.advance_fal_provider_attempt(
  p_provider_request_id text,
  p_status text,
  p_event_id text,
  p_artifact_id uuid default null,
  p_capture_micros bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.provider_jobs%rowtype;
  v_attempt public.attempts%rowtype;
  v_run_node public.run_nodes%rowtype;
  v_run public.runs%rowtype;
  v_reservation public.cost_reservations%rowtype;
  v_effective_status text;
  v_run_status text;
  v_all_terminal boolean;
  v_succeeded integer;
  v_failed integer;
  v_canceled integer;
  v_outcomes jsonb;
begin
  if p_provider_request_id is null
    or char_length(p_provider_request_id) not between 1 and 300
    or p_status not in ('running', 'succeeded', 'failed')
    or p_event_id is null or char_length(p_event_id) not between 1 and 500
    or (p_status = 'succeeded' and (p_artifact_id is null or p_capture_micros is null
      or p_capture_micros <= 0))
    or (p_status <> 'succeeded' and (p_artifact_id is not null or p_capture_micros is not null)) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select job.* into v_job
  from public.provider_jobs as job
  join public.provider_registrations as registration
    on registration.id = job.provider_registration_id
   and registration.provider_key = 'fal'
  where job.provider_request_id = p_provider_request_id
  for update of job;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_attempt
  from public.attempts
  where workspace_id = v_job.workspace_id and id = v_job.attempt_id
  for update;

  select * into v_run_node
  from public.run_nodes
  where workspace_id = v_attempt.workspace_id and id = v_attempt.run_node_id
  for update;

  select * into v_run
  from public.runs
  where workspace_id = v_attempt.workspace_id and id = v_attempt.run_id
  for update;

  if p_status = 'succeeded' then
    if not exists (
      select 1
      from public.artifacts
      where workspace_id = v_attempt.workspace_id
        and run_id = v_attempt.run_id
        and run_node_id = v_attempt.run_node_id
        and id = p_artifact_id
        and artifact_kind = 'provider_output'
        and status = 'available'
        and content_hash is not null
    ) or not exists (
      select 1
      from public.ledger_transactions
      where workspace_id = v_attempt.workspace_id
        and run_id = v_attempt.run_id
        and reservation_id is not null
        and entry_type = 'capture'
        and causative_key =
          'run:' || v_attempt.run_id::text || ':attempt:' || v_attempt.id::text || ':capture'
        and amount_micros = p_capture_micros
    ) then
      raise exception using errcode = '23514', message = 'SUCCEEDED_ATTEMPT_REQUIRES_ARTIFACT_CAPTURE';
    end if;
  elsif p_status = 'failed' and not exists (
    select 1
    from public.ledger_transactions
    where workspace_id = v_attempt.workspace_id
      and run_id = v_attempt.run_id
      and reservation_id is not null
      and entry_type = 'release'
      and causative_key =
        'run:' || v_attempt.run_id::text || ':attempt:' || v_attempt.id::text || ':release'
  ) then
    raise exception using errcode = '23514', message = 'FAILED_ATTEMPT_REQUIRES_RELEASE';
  end if;

  if v_attempt.status in ('succeeded', 'failed', 'canceled') then
    v_effective_status := v_attempt.status;
  else
    v_effective_status := p_status;

    update public.provider_jobs
    set
      status = p_status,
      normalized_evidence = normalized_evidence || jsonb_strip_nulls(jsonb_build_object(
        'last_webhook_event_id', p_event_id,
        'artifact_id', p_artifact_id,
        'capture_micros', case
          when p_capture_micros is null then null
          else p_capture_micros::text
        end
      ))
    where id = v_job.id;

    update public.attempts
    set status = p_status
    where workspace_id = v_attempt.workspace_id and id = v_attempt.id;

    update public.run_nodes
    set status = p_status
    where workspace_id = v_run_node.workspace_id and id = v_run_node.id;
  end if;

  -- Unlock the next wave, or skip and cancel the children of a node that failed. Must precede the
  -- aggregation below so any cancellation it performs is counted here rather than stranding the run.
  perform app_private.advance_run_readiness(v_run.workspace_id, v_run.id);

  select
    not exists (
      select 1
      from public.attempts
      where workspace_id = v_run.workspace_id
        and run_id = v_run.id
        and status not in ('succeeded', 'failed', 'canceled')
    ),
    count(*) filter (where status = 'succeeded')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'canceled')::integer
  into v_all_terminal, v_succeeded, v_failed, v_canceled
  from public.attempts
  where workspace_id = v_run.workspace_id and run_id = v_run.id;

  if v_all_terminal then
    v_run_status := case
      when v_succeeded > 0 and v_failed = 0 and v_canceled = 0 then 'succeeded'
      when v_succeeded > 0 then 'partial_succeeded'
      when v_failed > 0 then 'failed'
      else 'canceled'
    end;
  else
    v_run_status := 'running';
  end if;

  update public.runs
  set status = v_run_status
  where workspace_id = v_run.workspace_id
    and id = v_run.id
    and status <> 'cancel_requested';

  select * into v_reservation
  from public.cost_reservations
  where workspace_id = v_run.workspace_id and run_id = v_run.id;

  select jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'attempt_id', attempt.id,
      'status', attempt.status,
      'capture_micros', case
        when attempt.status = 'succeeded' then (
          select max(ledger.amount_micros)::text
          from public.ledger_transactions as ledger
          where ledger.workspace_id = attempt.workspace_id
            and ledger.run_id = attempt.run_id
            and ledger.entry_type = 'capture'
            and ledger.causative_key =
              'run:' || attempt.run_id::text || ':attempt:' || attempt.id::text || ':capture'
        )
        else null
      end
    ))
    order by attempt.created_at, attempt.id
  )
  into v_outcomes
  from public.attempts as attempt
  where attempt.workspace_id = v_run.workspace_id and attempt.run_id = v_run.id;

  return jsonb_build_object(
    'effective_attempt_status', v_effective_status,
    'run_status', v_run_status,
    'run_terminal', v_all_terminal,
    'reservation', jsonb_build_object(
      'id', v_reservation.id,
      'amount_micros', v_reservation.amount_micros::text,
      'captured_micros', v_reservation.captured_micros::text,
      'released_micros', v_reservation.released_micros::text
    ),
    'outcomes', coalesce(v_outcomes, '[]'::jsonb)
  );
end;
$$;

commit;
