-- P3: return the existing outbox_events.id from start_run_barrier so the
-- post-commit queue wake can use the durable event_id. Do not derive it from
-- run_id. Grants stay unchanged (CREATE OR REPLACE keeps them).
begin;

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
  v_outbox_event_id uuid;
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
  )
  returning id into v_outbox_event_id;

  v_response := jsonb_build_object(
    'run_id', v_run_id,
    'reservation_id', v_reservation_id,
    'quote_id', p_quote_id,
    'revision_id', p_expected_revision_id,
    'revision_hash', v_current_revision_hash,
    'status', 'queued',
    'event_id', v_outbox_event_id
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

comment on function public.start_run_barrier(uuid, uuid, uuid, uuid, boolean, text, text) is
  'Authenticated barrier: membership, head, quote, catalog, balance, caps, run, reservation, reserve ledger, attempts, outbox, and idempotency in one transaction. Returns the existing outbox event_id after commit.';

commit;
