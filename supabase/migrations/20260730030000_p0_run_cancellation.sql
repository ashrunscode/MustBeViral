begin;

-- Real cancellation. The composition previously returned conflict unconditionally and no cancel
-- RPC existed, so once a run started there was no way to stop nodes that had not yet reached a
-- provider - the emergency brake for the first real pack did not exist.
--
-- Semantics: attempts still at 'created' are canceled immediately (they carry no money and no
-- provider work). Attempts at 'submitted' or beyond are with the provider and are NOT interfered
-- with - fal has no reliable cancel and the webhook/reconciler own their terminal state. If
-- anything is still in flight the run parks at 'cancel_requested' and a companion finalizer
-- terminalizes it once the in-flight work drains; otherwise it terminalizes here, releasing the
-- reservation remainder under the same causative key as every other settlement path so replays
-- stay idempotent.
--
-- Terminal status is billing-honest rather than table-pure: a canceled run that already produced
-- captured successes reports 'partial_succeeded', because the customer paid for and received that
-- work. The in-memory domain table lacks that edge (cancel_requested -> partial_succeeded); the
-- SQL is authoritative and the domain table is amended in the same change set.

create or replace function app_private.finalize_run_after_cancel(
  p_workspace_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
set search_path = pg_catalog
as $fn$
declare
  v_non_terminal integer;
  v_succeeded integer;
  v_failed integer;
  v_reservation public.cost_reservations%rowtype;
  v_remainder bigint;
  v_run_status text;
begin
  select
    count(*) filter (where status not in ('succeeded', 'failed', 'canceled')),
    count(*) filter (where status = 'succeeded'),
    count(*) filter (where status = 'failed')
  into v_non_terminal, v_succeeded, v_failed
  from public.attempts
  where workspace_id = p_workspace_id and run_id = p_run_id;

  if v_non_terminal > 0 then
    return jsonb_build_object('finalized', false, 'run_status', 'cancel_requested');
  end if;

  v_run_status := case
    when v_succeeded > 0 then 'partial_succeeded'
    when v_failed > 0 then 'failed'
    else 'canceled'
  end;

  update public.runs
  set status = v_run_status
  where workspace_id = p_workspace_id and id = p_run_id;

  select * into v_reservation
  from public.cost_reservations
  where workspace_id = p_workspace_id and run_id = p_run_id;

  if found then
    v_remainder :=
      v_reservation.amount_micros - v_reservation.captured_micros - v_reservation.released_micros;
    if v_remainder < 0 then
      raise exception using errcode = '23514', message = 'RESERVATION_REMAINDER_NEGATIVE';
    end if;
    if v_remainder > 0 then
      perform public.record_ledger_movement(
        p_workspace_id,
        'release',
        v_remainder,
        'run:' || p_run_id::text || ':settlement:release',
        v_reservation.id,
        p_run_id,
        'cancel:' || p_run_id::text,
        jsonb_build_object('reason', 'run_canceled_remainder')
      );
    end if;
  end if;

  return jsonb_build_object('finalized', true, 'run_status', v_run_status);
end;
$fn$;

revoke all on function app_private.finalize_run_after_cancel(uuid, uuid) from public;

create or replace function public.request_run_cancellation(
  p_run_id uuid,
  p_reason text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_actor_id uuid := auth.uid();
  v_run public.runs%rowtype;
  v_finalized jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_run_id is null
    or p_reason is null or char_length(p_reason) not between 1 and 500
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if not app_private.is_workspace_owner(v_run.workspace_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  -- Repeating a cancel is not an error; the caller learns where the drain stands.
  if v_run.status = 'cancel_requested' then
    v_finalized := app_private.finalize_run_after_cancel(v_run.workspace_id, v_run.id);
    return jsonb_build_object('status', 'ok') || v_finalized;
  end if;

  if v_run.status not in ('queued', 'dispatching', 'running') then
    return jsonb_build_object('status', 'conflict', 'actual_state', v_run.status);
  end if;

  update public.runs
  set status = 'cancel_requested'
  where workspace_id = v_run.workspace_id and id = v_run.id;

  update public.attempts
  set status = 'canceled'
  where workspace_id = v_run.workspace_id
    and run_id = v_run.id
    and status = 'created';

  update public.run_nodes as run_node
  set status = 'canceled'
  where run_node.workspace_id = v_run.workspace_id
    and run_node.run_id = v_run.id
    and run_node.status not in ('succeeded', 'failed', 'canceled', 'skipped')
    and not exists (
      select 1
      from public.attempts as attempt
      where attempt.workspace_id = run_node.workspace_id
        and attempt.run_node_id = run_node.id
        and attempt.status not in ('succeeded', 'failed', 'canceled')
    );

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    v_run.workspace_id, 'user', v_actor_id, 'run.cancel_requested', 'run', v_run.id, p_request_id,
    jsonb_build_object('reason', p_reason)
  );

  v_finalized := app_private.finalize_run_after_cancel(v_run.workspace_id, v_run.id);
  return jsonb_build_object('status', 'ok') || v_finalized;
end;
$fn$;

revoke all on function public.request_run_cancellation(uuid, text, text) from public;
grant execute on function public.request_run_cancellation(uuid, text, text) to authenticated;

-- Drains parked cancellations. The attempt-advance tail deliberately never overwrites a
-- cancel_requested run, so once the in-flight attempts reach terminal states someone must compute
-- the final status and release the remainder. Runs from the scheduled cycle.
create or replace function public.finalize_cancel_requested_runs(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_run record;
  v_examined integer := 0;
  v_finalized integer := 0;
  v_result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  for v_run in
    select run.id, run.workspace_id
    from public.runs as run
    where run.status = 'cancel_requested'
      and not exists (
        select 1
        from public.attempts as attempt
        where attempt.workspace_id = run.workspace_id
          and attempt.run_id = run.id
          and attempt.status not in ('succeeded', 'failed', 'canceled')
      )
    order by run.created_at
    limit p_limit
    for update of run skip locked
  loop
    v_examined := v_examined + 1;
    v_result := app_private.finalize_run_after_cancel(v_run.workspace_id, v_run.id);
    if (v_result ->> 'finalized')::boolean then
      v_finalized := v_finalized + 1;
    end if;
  end loop;

  return jsonb_build_object('examined', v_examined, 'finalized', v_finalized);
end;
$fn$;

revoke all on function public.finalize_cancel_requested_runs(integer) from public;

-- Cancelling runs must stop receiving new submissions even while a dispatch event is mid-lease:
-- the expansion is the gate every dispatched attempt passes through.
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
    and node.item ->> 'id' = run_node.node_key
    and plan.item ->> 'node_id' = run_node.node_key
    and plan.item ->> 'model_route_id' = route.id::text
  order by attempt.created_at, attempt.id;
end;
$fn$;

revoke all on function public.get_outbox_dispatch_attempts(uuid, text) from public;

commit;
