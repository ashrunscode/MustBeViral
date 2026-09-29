begin;

-- Repoints the server-authoritative quote resolver to the OpenRouter copy route.
--
-- create_quote hardcodes role -> route_key in SQL, deliberately: the caller's plan is only an
-- idempotency input, so the RPC is the single authority on what a run costs. That means the
-- app-side launch-catalog change and the catalog v2 rows were not sufficient - this function still
-- named 'moonshot/kimi-k2.6/chat-completions' in two places:
--
--   1. the catalog-completeness guard, which requires the active version to price every required
--      route. Catalog v2 has no Moonshot price, so no active version qualified and every quote
--      failed with QUOTE_STALE.
--   2. the copy_set branch of the role mapping.
--
-- Caught by running a real quote through the Worker rather than trusting the arithmetic: verifying
-- prices could confirm the amounts but could never reveal that the resolver still pointed at a
-- retired provider.
--
-- Only those two strings change. The body is otherwise reproduced exactly so this migration cannot
-- quietly alter caps, idempotency, revision conflict handling, or the quote hash.

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
      'ready', true,
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

revoke all on function public.create_quote(uuid, uuid, uuid, text, text) from public;
grant execute on function public.create_quote(uuid, uuid, uuid, text, text) to authenticated;

commit;
