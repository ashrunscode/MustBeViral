begin;

-- Gives a dead dispatch a path to a terminal, settled run.
--
-- A run's outbox event covers every attempt and carries a bounded publish budget. When it goes
-- 'dead', any attempt still at 'created' can never be dispatched: nothing advances it, the run's
-- terminal predicate ("no attempt in a non-terminal state") never fires, and the reservation is
-- held forever. This is not hypothetical - it stranded two $4.55 reservations on 2026-07-29, both
-- released only by manual operator SQL.
--
-- The reaper cancels the undispatchable attempts, terminalizes the run when nothing else is in
-- flight, and releases the reservation remainder through record_ledger_movement so the double-entry
-- and cost_reservations bookkeeping stay consistent. Attempts at 'submitted' are deliberately left
-- alone: they are with the provider, the webhook/reconciler owns them, and the run will terminalize
-- through the normal advance path once they resolve - by then its 'created' stragglers are gone.

create or replace function public.reap_dead_dispatch(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_run record;
  v_runs_examined integer := 0;
  v_attempts_canceled integer := 0;
  v_runs_terminalized integer := 0;
  v_released_micros bigint := 0;
  v_canceled_now integer;
  v_non_terminal integer;
  v_succeeded integer;
  v_failed integer;
  v_canceled integer;
  v_reservation public.cost_reservations%rowtype;
  v_remainder bigint;
  v_run_status text;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  for v_run in
    select run.id, run.workspace_id
    from public.runs as run
    where run.status in ('queued', 'dispatching', 'running')
      and exists (
        select 1
        from public.outbox_events as event
        where event.workspace_id = run.workspace_id
          and event.aggregate_id = run.id
          and event.event_type = 'run.dispatch_requested'
          and event.status = 'dead'
      )
      and exists (
        select 1
        from public.attempts as attempt
        where attempt.workspace_id = run.workspace_id
          and attempt.run_id = run.id
          and attempt.status = 'created'
      )
    order by run.created_at
    limit p_limit
    for update of run skip locked
  loop
    v_runs_examined := v_runs_examined + 1;

    -- Cancel only what can never dispatch. created -> canceled is a legal attempt transition and
    -- carries no money: nothing was captured for an attempt that never reached a provider.
    update public.attempts
    set status = 'canceled'
    where workspace_id = v_run.workspace_id
      and run_id = v_run.id
      and status = 'created';
    get diagnostics v_canceled_now = row_count;
    v_attempts_canceled := v_attempts_canceled + v_canceled_now;

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

    select
      count(*) filter (where attempt.status not in ('succeeded', 'failed', 'canceled')),
      count(*) filter (where attempt.status = 'succeeded'),
      count(*) filter (where attempt.status = 'failed'),
      count(*) filter (where attempt.status = 'canceled')
    into v_non_terminal, v_succeeded, v_failed, v_canceled
    from public.attempts as attempt
    where attempt.workspace_id = v_run.workspace_id and attempt.run_id = v_run.id;

    -- Something is still with the provider. Leave the run alone; the webhook or reconciler will
    -- terminalize it through the proven advance path, and this run no longer matches the reaper's
    -- predicate because its 'created' attempts are gone.
    if v_non_terminal > 0 then
      continue;
    end if;

    v_run_status := case
      when v_succeeded > 0 and v_failed = 0 and v_canceled = 0 then 'succeeded'
      when v_succeeded > 0 then 'partial_succeeded'
      when v_failed > 0 then 'failed'
      else 'canceled'
    end;

    update public.runs
    set status = v_run_status
    where workspace_id = v_run.workspace_id
      and id = v_run.id
      and status <> 'cancel_requested';

    select * into v_reservation
    from public.cost_reservations
    where workspace_id = v_run.workspace_id and run_id = v_run.id;

    if found then
      v_remainder :=
        v_reservation.amount_micros - v_reservation.captured_micros - v_reservation.released_micros;
      if v_remainder < 0 then
        raise exception using errcode = '23514', message = 'RESERVATION_REMAINDER_NEGATIVE';
      end if;
      if v_remainder > 0 then
        -- Same causative key the webhook-driven terminal settlement would use, so whichever path
        -- runs second replays instead of double-releasing.
        perform public.record_ledger_movement(
          v_run.workspace_id,
          'release',
          v_remainder,
          'run:' || v_run.id::text || ':settlement:release',
          v_reservation.id,
          v_run.id,
          'reap:' || v_run.id::text,
          jsonb_build_object('reason', 'dead_dispatch_reaped')
        );
        v_released_micros := v_released_micros + v_remainder;
      end if;
    end if;

    v_runs_terminalized := v_runs_terminalized + 1;
  end loop;

  return jsonb_build_object(
    'runs_examined', v_runs_examined,
    'attempts_canceled', v_attempts_canceled,
    'runs_terminalized', v_runs_terminalized,
    'released_micros', v_released_micros
  );
end;
$fn$;

revoke all on function public.reap_dead_dispatch(integer) from public;

commit;
