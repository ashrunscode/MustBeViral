begin;

alter table public.model_routes
  drop constraint model_routes_route_key_check;

alter table public.model_routes
  add constraint model_routes_route_key_check
  check (route_key ~ '^[a-z0-9][a-z0-9_./-]*$');

insert into public.provider_registrations (
  id,
  provider_key,
  display_name,
  transport_version,
  status,
  evidence_ref
) values
  (
    '0a000000-0000-4000-8000-000000000001',
    'fal',
    'fal.ai',
    '1.0.0',
    'enabled',
    'governance/evidence/WP-P0-001/pricing-decision.md'
  ),
  (
    '0a000000-0000-4000-8000-000000000002',
    'moonshot',
    'Moonshot AI',
    '1.0.0',
    'enabled',
    'governance/evidence/WP-P0-001/pricing-decision.md'
  ),
  (
    '0a000000-0000-4000-8000-000000000003',
    'mustbeviral',
    'MustBeViral Launch Catalog',
    '1.0.0',
    'enabled',
    'governance/evidence/WP-P0-001/pricing-decision.md'
  );

insert into public.model_routes (
  id,
  provider_registration_id,
  route_key,
  provider_model_id,
  driver_version,
  capability,
  status,
  input_schema_version,
  output_schema_version
) values
  (
    '0b000000-0000-4000-8000-000000000001',
    '0a000000-0000-4000-8000-000000000002',
    'moonshot/kimi-k2.6/chat-completions',
    'kimi-k2.6',
    '1.0.0',
    'text',
    'enabled',
    1,
    1
  ),
  (
    '0b000000-0000-4000-8000-000000000002',
    '0a000000-0000-4000-8000-000000000001',
    'fal/flux-2-pro/masters',
    'fal-ai/flux-2-pro',
    '1.0.0',
    'image',
    'enabled',
    1,
    1
  ),
  (
    '0b000000-0000-4000-8000-000000000003',
    '0a000000-0000-4000-8000-000000000001',
    'fal/flux-kontext-pro/adaptations',
    'fal-ai/flux-kontext/pro',
    '1.0.0',
    'image',
    'enabled',
    1,
    1
  ),
  (
    '0b000000-0000-4000-8000-000000000004',
    '0a000000-0000-4000-8000-000000000001',
    'fal/seedance-1.0-lite/motion',
    'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    '1.0.0',
    'video',
    'enabled',
    1,
    1
  );

insert into public.price_catalog_versions (
  id,
  provider_registration_id,
  version,
  currency,
  source_hash,
  source_ref,
  status,
  effective_at
) values (
  '0c000000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000003',
  'p0-launch-2026-07-26',
  'USD',
  '9c756fc2a104080e0921db8e119735aba2ab84000ee81595313640296fece086',
  'governance/evidence/WP-P0-001/pricing-decision.md',
  'active',
  '2026-07-26T00:00:00Z'
);

insert into public.model_route_prices (
  id,
  price_catalog_version_id,
  model_route_id,
  unit,
  unit_price_micros
) values
  (
    '0d000000-0000-4000-8000-000000000001',
    '0c000000-0000-4000-8000-000000000001',
    '0b000000-0000-4000-8000-000000000001',
    'request',
    150000
  ),
  (
    '0d000000-0000-4000-8000-000000000002',
    '0c000000-0000-4000-8000-000000000001',
    '0b000000-0000-4000-8000-000000000002',
    'image',
    500000
  ),
  (
    '0d000000-0000-4000-8000-000000000003',
    '0c000000-0000-4000-8000-000000000001',
    '0b000000-0000-4000-8000-000000000003',
    'image',
    200000
  ),
  (
    '0d000000-0000-4000-8000-000000000004',
    '0c000000-0000-4000-8000-000000000001',
    '0b000000-0000-4000-8000-000000000004',
    'video_second',
    100000
  );

-- P0 has one unified, platform-owned launch catalog. This prevents a stale
-- concurrently-active version from ever being selected for a launch quote.
create unique index price_catalog_versions_one_active_idx
  on public.price_catalog_versions (status)
  where status = 'active';

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
as $$
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
          ('moonshot/kimi-k2.6/chat-completions', 'request'),
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
        v_route_key := 'moonshot/kimi-k2.6/chat-completions';
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
    id,
    workspace_id,
    project_id,
    canvas_id,
    canvas_revision_id,
    price_catalog_version_id,
    execution_plan,
    quote_hash,
    maximum_charge_micros,
    currency,
    created_by
  ) values (
    v_quote_id,
    p_workspace_id,
    v_project_id,
    p_canvas_id,
    p_expected_revision_id,
    v_catalog_version_id,
    v_execution_plan,
    v_quote_hash,
    v_grand_total::bigint,
    'USD',
    v_actor_id
  )
  returning expires_at into v_expires_at;

  v_response := jsonb_build_object(
    'quote_id', v_quote_id,
    'maximum_charge_micros', v_grand_total::text,
    'price_catalog_version_id', v_catalog_version_id,
    'expires_at', v_expires_at
  );

  insert into public.idempotency_records (
    workspace_id,
    actor_id,
    operation,
    idempotency_key,
    request_hash,
    response_payload
  ) values (
    p_workspace_id,
    v_actor_id,
    'quote_run',
    p_idempotency_key,
    v_request_hash,
    v_response
  );

  insert into public.audit_events (
    workspace_id,
    actor_type,
    actor_id,
    action,
    entity_type,
    entity_id,
    request_id,
    details
  ) values (
    p_workspace_id,
    'user',
    v_actor_id,
    'quote.created',
    'quote',
    v_quote_id,
    p_request_id,
    jsonb_build_object(
      'canvas_id', p_canvas_id,
      'revision_id', p_expected_revision_id,
      'price_catalog_version_id', v_catalog_version_id,
      'maximum_charge_micros', v_grand_total::text
    )
  );

  return v_response;
end;
$$;

revoke all on function public.create_quote(uuid, uuid, uuid, text, text)
from public, anon, service_role;

grant execute on function public.create_quote(uuid, uuid, uuid, text, text)
to authenticated;

comment on function public.create_quote(uuid, uuid, uuid, text, text) is
  'Authenticated, idempotent, server-authoritative launch quote creation from the immutable canvas head and active price catalog.';

commit;
