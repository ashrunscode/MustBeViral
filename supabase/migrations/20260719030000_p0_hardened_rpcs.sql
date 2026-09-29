begin;

create or replace function app_private.hash_canonical_json(p_value jsonb)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select encode(extensions.digest(convert_to(p_value::text, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function app_private.hash_canonical_json(jsonb)
from public, anon, authenticated, service_role;

create or replace function public.create_workspace(
  p_name text,
  p_slug text,
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
  v_workspace_id uuid := gen_random_uuid();
  v_request_hash text;
  v_response jsonb;
  v_existing public.idempotency_records%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_name is null or char_length(p_name) not between 1 and 120
    or p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'name', p_name,
    'slug', p_slug
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':create_workspace:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id is null
    and operation = 'create_workspace'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  insert into public.workspaces (id, name, slug, created_by)
  values (v_workspace_id, p_name, p_slug, v_actor_id);

  insert into public.workspace_memberships (workspace_id, user_id, role, status)
  values (v_workspace_id, v_actor_id, 'owner', 'active');

  v_response := jsonb_build_object(
    'workspace_id', v_workspace_id,
    'role', 'owner'
  );

  insert into public.idempotency_records (
    workspace_id,
    actor_id,
    operation,
    idempotency_key,
    request_hash,
    response_payload
  ) values (
    null,
    v_actor_id,
    'create_workspace',
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
    v_workspace_id,
    'user',
    v_actor_id,
    'workspace.created',
    'workspace',
    v_workspace_id,
    p_request_id,
    '{}'::jsonb
  );

  return v_response;
end;
$$;

create or replace function public.create_canvas_with_revision(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_graph_schema_version integer,
  p_graph_snapshot jsonb,
  p_reason text,
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
  v_canvas_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
  v_canonical_hash text;
  v_request_hash text;
  v_response jsonb;
  v_existing public.idempotency_records%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not app_private.is_workspace_owner(p_workspace_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_name is null or char_length(p_name) not between 1 and 160
    or p_graph_schema_version is null or p_graph_schema_version <= 0
    or p_graph_snapshot is null or jsonb_typeof(p_graph_snapshot) <> 'object'
    or jsonb_typeof(p_graph_snapshot -> 'nodes') <> 'array'
    or jsonb_typeof(p_graph_snapshot -> 'edges') <> 'array'
    or p_reason is null or char_length(p_reason) not between 1 and 500
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  if not exists (
    select 1 from public.projects
    where workspace_id = p_workspace_id and id = p_project_id and status <> 'archived'
  ) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  v_canonical_hash := app_private.hash_canonical_json(p_graph_snapshot);
  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'workspace_id', p_workspace_id,
    'project_id', p_project_id,
    'name', p_name,
    'graph_schema_version', p_graph_schema_version,
    'graph_snapshot', p_graph_snapshot,
    'reason', p_reason
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':' || p_workspace_id::text || ':create_canvas:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id = p_workspace_id
    and operation = 'create_canvas'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  insert into public.canvases (
    id, workspace_id, project_id, name, head_revision_id, created_by
  ) values (
    v_canvas_id, p_workspace_id, p_project_id, p_name, null, v_actor_id
  );

  insert into public.canvas_revisions (
    id,
    workspace_id,
    canvas_id,
    parent_revision_id,
    graph_schema_version,
    graph_snapshot,
    canonical_hash,
    actor_type,
    actor_id,
    reason
  ) values (
    v_revision_id,
    p_workspace_id,
    v_canvas_id,
    null,
    p_graph_schema_version,
    p_graph_snapshot,
    v_canonical_hash,
    'user',
    v_actor_id,
    p_reason
  );

  update public.canvases
  set head_revision_id = v_revision_id
  where workspace_id = p_workspace_id and id = v_canvas_id;

  v_response := jsonb_build_object(
    'canvas_id', v_canvas_id,
    'revision_id', v_revision_id,
    'canonical_hash', v_canonical_hash
  );

  insert into public.idempotency_records (
    workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload
  ) values (
    p_workspace_id, v_actor_id, 'create_canvas', p_idempotency_key, v_request_hash, v_response
  );

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    p_workspace_id,
    'user',
    v_actor_id,
    'canvas.created',
    'canvas',
    v_canvas_id,
    p_request_id,
    jsonb_build_object('revision_id', v_revision_id, 'canonical_hash', v_canonical_hash)
  );

  return v_response;
end;
$$;

create or replace function public.apply_canvas_revision(
  p_workspace_id uuid,
  p_canvas_id uuid,
  p_expected_revision_id uuid,
  p_graph_schema_version integer,
  p_graph_snapshot jsonb,
  p_reason text,
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
  v_revision_id uuid := gen_random_uuid();
  v_current_revision_id uuid;
  v_canonical_hash text;
  v_request_hash text;
  v_response jsonb;
  v_existing public.idempotency_records%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not app_private.is_workspace_owner(p_workspace_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_revision_id is null
    or p_graph_schema_version is null or p_graph_schema_version <= 0
    or p_graph_snapshot is null or jsonb_typeof(p_graph_snapshot) <> 'object'
    or jsonb_typeof(p_graph_snapshot -> 'nodes') <> 'array'
    or jsonb_typeof(p_graph_snapshot -> 'edges') <> 'array'
    or p_reason is null or char_length(p_reason) not between 1 and 500
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  v_canonical_hash := app_private.hash_canonical_json(p_graph_snapshot);
  v_request_hash := app_private.hash_canonical_json(jsonb_build_object(
    'workspace_id', p_workspace_id,
    'canvas_id', p_canvas_id,
    'expected_revision_id', p_expected_revision_id,
    'graph_schema_version', p_graph_schema_version,
    'graph_snapshot', p_graph_snapshot,
    'reason', p_reason
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_actor_id::text || ':' || p_workspace_id::text || ':apply_canvas_revision:' || p_idempotency_key,
    0
  ));

  select * into v_existing
  from public.idempotency_records
  where actor_id = v_actor_id
    and workspace_id = p_workspace_id
    and operation = 'apply_canvas_revision'
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.response_payload;
  end if;

  select head_revision_id into v_current_revision_id
  from public.canvases
  where workspace_id = p_workspace_id and id = p_canvas_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_current_revision_id <> p_expected_revision_id then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  insert into public.canvas_revisions (
    id,
    workspace_id,
    canvas_id,
    parent_revision_id,
    graph_schema_version,
    graph_snapshot,
    canonical_hash,
    actor_type,
    actor_id,
    reason
  ) values (
    v_revision_id,
    p_workspace_id,
    p_canvas_id,
    p_expected_revision_id,
    p_graph_schema_version,
    p_graph_snapshot,
    v_canonical_hash,
    'user',
    v_actor_id,
    p_reason
  );

  update public.canvases
  set head_revision_id = v_revision_id
  where workspace_id = p_workspace_id
    and id = p_canvas_id
    and head_revision_id = p_expected_revision_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
  end if;

  v_response := jsonb_build_object(
    'canvas_id', p_canvas_id,
    'revision_id', v_revision_id,
    'parent_revision_id', p_expected_revision_id,
    'canonical_hash', v_canonical_hash
  );

  insert into public.idempotency_records (
    workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload
  ) values (
    p_workspace_id,
    v_actor_id,
    'apply_canvas_revision',
    p_idempotency_key,
    v_request_hash,
    v_response
  );

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    p_workspace_id,
    'user',
    v_actor_id,
    'canvas.revision_applied',
    'canvas_revision',
    v_revision_id,
    p_request_id,
    jsonb_build_object('canvas_id', p_canvas_id, 'parent_revision_id', p_expected_revision_id)
  );

  return v_response;
end;
$$;

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
    workspace_id, run_id, node_key, model_route_id, status
  )
  select
    p_workspace_id,
    v_run_id,
    plan.item ->> 'node_id',
    (plan.item ->> 'model_route_id')::uuid,
    case when coalesce((plan.item ->> 'ready')::boolean, false) then 'ready' else 'pending' end
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
    and run_node.run_id = v_run_id
    and run_node.status = 'ready';

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

create or replace function public.record_ledger_movement(
  p_workspace_id uuid,
  p_entry_type text,
  p_amount_micros bigint,
  p_causative_key text,
  p_reservation_id uuid,
  p_run_id uuid,
  p_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_transaction_id uuid := gen_random_uuid();
  v_existing_transaction_id uuid;
  v_existing_entry_type text;
  v_existing_amount bigint;
  v_debit_account text;
  v_credit_account text;
  v_reservation public.cost_reservations%rowtype;
  v_new_captured bigint;
  v_new_released bigint;
  v_new_refunded bigint;
  v_new_status text;
begin
  if current_user <> 'postgres' and session_user <> 'service_role' and current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_entry_type not in ('credit', 'reserve', 'capture', 'release', 'refund')
    or p_amount_micros is null or p_amount_micros <= 0
    or p_causative_key is null or char_length(p_causative_key) not between 1 and 240
    or p_request_id is null or char_length(p_request_id) not between 1 and 200
    or p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  if not exists (select 1 from public.workspaces where id = p_workspace_id) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_workspace_id::text || ':ledger:' || p_causative_key,
    0
  ));

  select transaction_id, min(entry_type), min(amount_micros)
  into v_existing_transaction_id, v_existing_entry_type, v_existing_amount
  from public.ledger_transactions
  where workspace_id = p_workspace_id and causative_key = p_causative_key
  group by transaction_id;

  if found then
    if v_existing_entry_type <> p_entry_type or v_existing_amount <> p_amount_micros then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('transaction_id', v_existing_transaction_id, 'replayed', true);
  end if;

  case p_entry_type
    when 'credit' then
      v_debit_account := 'funding_clearing';
      v_credit_account := 'wallet_available';
      if p_reservation_id is not null or p_run_id is not null then
        raise exception using errcode = '22023', message = 'CREDIT_CANNOT_REFERENCE_RUN';
      end if;
    when 'reserve' then
      v_debit_account := 'wallet_available';
      v_credit_account := 'wallet_reserved';
    when 'capture' then
      v_debit_account := 'wallet_reserved';
      v_credit_account := 'usage_expense';
    when 'release' then
      v_debit_account := 'wallet_reserved';
      v_credit_account := 'wallet_available';
    when 'refund' then
      v_debit_account := 'usage_expense';
      v_credit_account := 'wallet_available';
  end case;

  if p_entry_type <> 'credit' then
    select * into v_reservation
    from public.cost_reservations
    where workspace_id = p_workspace_id
      and id = p_reservation_id
      and run_id = p_run_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'RESERVATION_NOT_FOUND';
    end if;

    v_new_captured := v_reservation.captured_micros;
    v_new_released := v_reservation.released_micros;
    v_new_refunded := v_reservation.refunded_micros;
    v_new_status := v_reservation.status;

    if p_entry_type = 'reserve' then
      if p_amount_micros <> v_reservation.amount_micros then
        raise exception using errcode = '23514', message = 'RESERVATION_AMOUNT_MISMATCH';
      end if;
    elsif p_entry_type = 'capture' then
      v_new_captured := v_new_captured + p_amount_micros;
      if v_new_captured + v_new_released > v_reservation.amount_micros then
        raise exception using errcode = '23514', message = 'CAPTURE_EXCEEDS_RESERVATION';
      end if;
      v_new_status := case
        when v_new_captured = v_reservation.amount_micros then 'captured'
        else 'partially_captured'
      end;
    elsif p_entry_type = 'release' then
      v_new_released := v_new_released + p_amount_micros;
      if v_new_captured + v_new_released > v_reservation.amount_micros then
        raise exception using errcode = '23514', message = 'RELEASE_EXCEEDS_RESERVATION';
      end if;
      v_new_status := case
        when v_new_captured = 0 and v_new_released = v_reservation.amount_micros then 'released'
        else 'partially_captured'
      end;
    elsif p_entry_type = 'refund' then
      v_new_refunded := v_new_refunded + p_amount_micros;
      if v_new_refunded > v_new_captured then
        raise exception using errcode = '23514', message = 'REFUND_EXCEEDS_CAPTURE';
      end if;
      v_new_status := 'refunded';
    end if;

    if p_entry_type in ('capture', 'release', 'refund') then
      update public.cost_reservations
      set
        captured_micros = v_new_captured,
        released_micros = v_new_released,
        refunded_micros = v_new_refunded,
        status = v_new_status
      where workspace_id = p_workspace_id and id = p_reservation_id;
    end if;
  end if;

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
      v_transaction_id,
      p_entry_type,
      v_debit_account,
      'debit',
      p_amount_micros,
      p_causative_key,
      p_reservation_id,
      p_run_id,
      p_metadata
    ),
    (
      p_workspace_id,
      v_transaction_id,
      p_entry_type,
      v_credit_account,
      'credit',
      p_amount_micros,
      p_causative_key,
      p_reservation_id,
      p_run_id,
      p_metadata
    );

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    p_workspace_id,
    'system',
    null,
    'ledger.' || p_entry_type,
    'ledger_transaction',
    v_transaction_id,
    p_request_id,
    jsonb_build_object(
      'causative_key', p_causative_key,
      'amount_micros', p_amount_micros,
      'reservation_id', p_reservation_id,
      'run_id', p_run_id
    )
  );

  return jsonb_build_object('transaction_id', v_transaction_id, 'replayed', false);
end;
$$;

revoke all on function public.create_workspace(text, text, text, text)
from public, anon, service_role;
revoke all on function public.create_canvas_with_revision(uuid, uuid, text, integer, jsonb, text, text, text)
from public, anon, service_role;
revoke all on function public.apply_canvas_revision(uuid, uuid, uuid, integer, jsonb, text, text, text)
from public, anon, service_role;
revoke all on function public.start_run_barrier(uuid, uuid, uuid, uuid, boolean, text, text)
from public, anon, service_role;
revoke all on function public.record_ledger_movement(uuid, text, bigint, text, uuid, uuid, text, jsonb)
from public, anon, authenticated;

grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.create_canvas_with_revision(uuid, uuid, text, integer, jsonb, text, text, text)
to authenticated;
grant execute on function public.apply_canvas_revision(uuid, uuid, uuid, integer, jsonb, text, text, text)
to authenticated;
grant execute on function public.start_run_barrier(uuid, uuid, uuid, uuid, boolean, text, text)
to authenticated;
grant execute on function public.record_ledger_movement(uuid, text, bigint, text, uuid, uuid, text, jsonb)
to service_role;

comment on function public.create_workspace(text, text, text, text) is
  'Authenticated, idempotent owner-workspace bootstrap. Actor identity is derived only from auth.uid().';
comment on function public.create_canvas_with_revision(uuid, uuid, text, integer, jsonb, text, text, text) is
  'Authenticated atomic canvas and immutable root revision creation with a server-computed canonical hash.';
comment on function public.apply_canvas_revision(uuid, uuid, uuid, integer, jsonb, text, text, text) is
  'Authenticated expected-head compare-and-swap for immutable graph revisions.';
comment on function public.start_run_barrier(uuid, uuid, uuid, uuid, boolean, text, text) is
  'Authenticated barrier: membership, head, quote, catalog, balance, caps, run, reservation, reserve ledger, attempts, outbox, and idempotency in one transaction.';
comment on function public.record_ledger_movement(uuid, text, bigint, text, uuid, uuid, text, jsonb) is
  'Machine-only semantic ledger writer. service_role has EXECUTE but no direct product-table privileges.';

commit;
