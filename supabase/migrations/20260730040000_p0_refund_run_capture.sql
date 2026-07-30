begin;

-- The operator escape for money captured wrongly. The refund ledger primitive has existed since
-- the settlement work (record_ledger_movement handles the 'refund' entry type and enforces
-- refunded <= captured), but nothing called it: a mis-captured run had no recovery path short of
-- raw operator SQL. This wraps it with validation and an audit trail.
--
-- Deliberately NOT granted to authenticated. A refund is an operator decision with money attached;
-- it runs only through the privileged service connection, and every call leaves an audit_events
-- row naming the reason and request id. Who may authorize a refund, and on what evidence, is an
-- operator policy question - this function is the mechanism, not the policy.

create or replace function public.refund_run_capture(
  p_run_id uuid,
  p_amount_micros bigint,
  p_reason text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_run public.runs%rowtype;
  v_reservation public.cost_reservations%rowtype;
  v_movement jsonb;
begin
  if p_run_id is null
    or p_amount_micros is null or p_amount_micros <= 0
    or p_reason is null or char_length(p_reason) not between 1 and 500
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_run from public.runs where id = p_run_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_reservation
  from public.cost_reservations
  where workspace_id = v_run.workspace_id and run_id = v_run.id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- record_ledger_movement enforces refunded <= captured; this pre-check exists to fail with a
  -- named message before any row is written.
  if p_amount_micros > v_reservation.captured_micros - v_reservation.refunded_micros then
    raise exception using errcode = '23514', message = 'REFUND_EXCEEDS_CAPTURED';
  end if;

  v_movement := public.record_ledger_movement(
    v_run.workspace_id,
    'refund',
    p_amount_micros,
    -- Keyed on the request id so a retried operator command replays instead of refunding twice,
    -- while distinct refunds against the same run remain possible.
    'run:' || v_run.id::text || ':refund:' || p_request_id,
    v_reservation.id,
    v_run.id,
    p_request_id,
    jsonb_build_object('reason', p_reason)
  );

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    v_run.workspace_id, 'operator', null, 'run.capture_refunded', 'run', v_run.id, p_request_id,
    jsonb_build_object('reason', p_reason, 'amount_micros', p_amount_micros)
  );

  return jsonb_build_object('status', 'ok', 'movement', v_movement);
end;
$fn$;

revoke all on function public.refund_run_capture(uuid, bigint, text, text) from public;

commit;
