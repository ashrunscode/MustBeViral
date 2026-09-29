begin;

-- Poll-provider reconciliation could move a provider job, attempt, and run node out of ambiguity,
-- but it never reconsidered a run already parked at reconciliation_required. Once every attempt
-- later reached a terminal state through polling, the run still held the exception state forever.
--
-- Keep the repair inside the existing machine RPC so the provider poll and run aggregation remain
-- one transaction. The exit is deliberately WHERE-guarded: only reconciliation_required runs with
-- at least one attempt and no unresolved attempts can move, and the same terminal aggregation used
-- by the settlement and stranded-dispatch paths determines the result.
create or replace function public.record_provider_job_reconciliation(
  p_provider_job_id uuid,
  p_status text,
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_job public.provider_jobs%rowtype;
  v_database_status text;
  v_run_status text;
begin
  if p_provider_job_id is null
    or p_status not in ('queued', 'running', 'succeeded', 'failed', 'unknown')
    or p_evidence is null or jsonb_typeof(p_evidence) <> 'object' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_job
  from public.provider_jobs
  where id = p_provider_job_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_job.status in ('succeeded', 'failed', 'canceled') then
    return jsonb_build_object('status', v_job.status, 'terminal', true);
  end if;

  v_database_status := case when p_status = 'queued' then 'submitted' else p_status end;

  update public.provider_jobs
  set
    status = v_database_status,
    normalized_evidence = normalized_evidence || p_evidence
  where id = p_provider_job_id;

  update public.attempts
  set status = case
    when p_status = 'queued' then 'submitted'
    when p_status = 'unknown' then 'ambiguous'
    else p_status
  end
  where workspace_id = v_job.workspace_id and id = v_job.attempt_id;

  update public.run_nodes as run_node
  set status = case
    when p_status = 'queued' then 'queued'
    when p_status = 'unknown' then 'reconciliation_required'
    else p_status
  end
  from public.attempts as attempt
  where attempt.workspace_id = v_job.workspace_id
    and attempt.id = v_job.attempt_id
    and run_node.workspace_id = attempt.workspace_id
    and run_node.id = attempt.run_node_id;

  if p_status = 'unknown' then
    update public.runs
    set status = 'reconciliation_required'
    where workspace_id = v_job.workspace_id
      and id = v_job.run_id
      and status in ('queued', 'dispatching', 'running');
  end if;

  -- The missing exit. A run remains parked while even one attempt is unresolved. Once all attempts
  -- are terminal, move only a reconciliation_required run and preserve the established outcome
  -- precedence: all-success, partial, failed, then canceled.
  with attempt_summary as (
    select
      count(*)::integer as total,
      count(*) filter (
        where attempt.status not in ('succeeded', 'failed', 'canceled')
      )::integer as non_terminal,
      count(*) filter (where attempt.status = 'succeeded')::integer as succeeded,
      count(*) filter (where attempt.status = 'failed')::integer as failed,
      count(*) filter (where attempt.status = 'canceled')::integer as canceled
    from public.attempts as attempt
    where attempt.workspace_id = v_job.workspace_id
      and attempt.run_id = v_job.run_id
  )
  update public.runs as run
  set status = case
    when summary.succeeded > 0 and summary.failed = 0 and summary.canceled = 0 then 'succeeded'
    when summary.succeeded > 0 then 'partial_succeeded'
    when summary.failed > 0 then 'failed'
    else 'canceled'
  end
  from attempt_summary as summary
  where run.workspace_id = v_job.workspace_id
    and run.id = v_job.run_id
    and run.status = 'reconciliation_required'
    and summary.total > 0
    and summary.non_terminal = 0;

  select run.status into v_run_status
  from public.runs as run
  where run.workspace_id = v_job.workspace_id and run.id = v_job.run_id;

  return jsonb_build_object(
    'status', v_database_status,
    'terminal', false,
    'run_status', v_run_status
  );
end;
$fn$;

revoke all on function public.record_provider_job_reconciliation(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_provider_job_reconciliation(uuid, text, jsonb)
  to service_role;

comment on function public.record_provider_job_reconciliation(uuid, text, jsonb) is
  'Machine-only provider poll transition; terminal attempt aggregation exits reconciliation_required only when no unresolved attempt remains.';

commit;
