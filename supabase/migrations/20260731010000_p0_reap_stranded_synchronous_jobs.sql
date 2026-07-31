begin;

-- Track E, reconciler half: a recovery path for synchronous provider jobs stranded at 'submitted'.
--
-- Proven necessary by a live incident during the Track D money-path proof: three copy attempts sat
-- at 'submitted' for twenty minutes holding a $0.45 reservation. Their artifacts were registered and
-- their captures were made, but the Worker-side advance never landed - and once an attempt leaves
-- 'created', the dispatch gate never selects it again, the OpenRouter registration is deliberately
-- excluded from the polling reconciler (its driver has no status(); polling would flip the run to
-- reconciliation_required, a state with no exit), and no webhook exists. Zero automatic paths out;
-- that incident was resolved by manual SQL.
--
-- Two honest cases, split by whether the money moved:
--
--   A. Capture exists  -> the settlement was interrupted between capture and advance. Finish it:
--      settle 'succeeded' through app_private.settle_attempt_transition with the artifact and the
--      exact captured amount. No new spend, no state invention - just the missing final step,
--      through the same proven tail every other settlement uses.
--
--   B. No capture      -> the provider's output existed only in the Worker's memory and is gone.
--      The customer must not be charged for work they cannot receive: release the node's quoted
--      line total under the attempt release key (the same key the failure path uses, so a late
--      duplicate replays instead of double-releasing), then settle 'failed'. The provider's
--      ~$0.0001 real cost is eaten as waste, which is the honest outcome.
--
-- The 10-minute age gate keeps this from racing a live settlement: the dispatch path settles
-- synchronous submissions in the same invocation, so anything still 'submitted' after 10 minutes is
-- genuinely stranded, not slow.
create or replace function public.reap_stranded_synchronous_jobs(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_job record;
  v_examined integer := 0;
  v_settled integer := 0;
  v_failed integer := 0;
  v_released_micros bigint := 0;
  v_artifact public.artifacts%rowtype;
  v_capture_micros bigint;
  v_line_total bigint;
  v_job_row public.provider_jobs%rowtype;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  for v_job in
    select job.id as job_id, job.workspace_id, job.attempt_id,
           attempt.run_id, attempt.run_node_id, run_node.node_key
    from public.provider_jobs as job
    join public.provider_registrations as registration
      on registration.id = job.provider_registration_id
     and registration.reconciliation_mode = 'synchronous'
    join public.attempts as attempt
      on attempt.workspace_id = job.workspace_id
     and attempt.id = job.attempt_id
     and attempt.status = 'submitted'
    join public.run_nodes as run_node
      on run_node.workspace_id = attempt.workspace_id
     and run_node.id = attempt.run_node_id
    join public.runs as run
      on run.workspace_id = attempt.workspace_id
     and run.id = attempt.run_id
     and run.status not in ('succeeded', 'failed', 'canceled', 'partial_succeeded')
    where job.status = 'submitted'
      and job.updated_at < statement_timestamp() - interval '10 minutes'
    order by job.updated_at
    limit p_limit
    for update of job skip locked
  loop
    v_examined := v_examined + 1;

    select * into v_job_row
    from public.provider_jobs
    where id = v_job.job_id;

    -- The capture, if the interrupted settlement got that far. The causative key is the attempt's
    -- own capture key, so this cannot pick up another attempt's money.
    select max(ledger.amount_micros)
    into v_capture_micros
    from public.ledger_transactions as ledger
    where ledger.workspace_id = v_job.workspace_id
      and ledger.run_id = v_job.run_id
      and ledger.entry_type = 'capture'
      and ledger.causative_key =
        'run:' || v_job.run_id::text || ':attempt:' || v_job.attempt_id::text || ':capture';

    if v_capture_micros is not null then
      -- Case A. The artifact must exist too, or the capture proof inside the settlement tail
      -- refuses - which would be correct: a capture with no artifact is not a finishable success.
      select * into v_artifact
      from public.artifacts
      where workspace_id = v_job.workspace_id
        and run_id = v_job.run_id
        and run_node_id = v_job.run_node_id
        and artifact_kind in ('provider_output', 'approved_output')
        and status = 'available'
        and content_hash is not null
      order by created_at
      limit 1;

      if found then
        perform app_private.settle_attempt_transition(
          v_job_row, 'succeeded', 'reap-synchronous:' || v_job.job_id::text,
          v_artifact.id, v_capture_micros
        );
        v_settled := v_settled + 1;
        continue;
      end if;
      -- Captured but no artifact: fall through to the failure path below, which releases nothing
      -- extra (the capture stands as the record of what happened) - but this state should be
      -- impossible given the ingest order (bytes -> register -> capture), so surface it loudly
      -- rather than guessing.
      raise exception using errcode = '23514', message = 'CAPTURE_WITHOUT_ARTIFACT';
    end if;

    -- Case B: the output is gone. Release the node's quoted line total so the customer is not
    -- charged for work they cannot receive, then settle 'failed' through the proven tail (which
    -- requires exactly this release as its failure proof).
    select (plan.item ->> 'total_micros')::bigint
    into v_line_total
    from public.runs as run
    join public.quotes as quote
      on quote.workspace_id = run.workspace_id
     and quote.id = run.quote_id
    cross join lateral jsonb_array_elements(quote.execution_plan) as plan(item)
    where run.workspace_id = v_job.workspace_id
      and run.id = v_job.run_id
      and plan.item ->> 'node_id' = v_job.node_key;

    if v_line_total is null or v_line_total <= 0 then
      raise exception using errcode = '23514', message = 'STRANDED_JOB_LINE_TOTAL_MISSING';
    end if;

    perform public.record_ledger_movement(
      v_job.workspace_id,
      'release',
      v_line_total,
      'run:' || v_job.run_id::text || ':attempt:' || v_job.attempt_id::text || ':release',
      (select id from public.cost_reservations
        where workspace_id = v_job.workspace_id and run_id = v_job.run_id),
      v_job.run_id,
      'reap-synchronous:' || v_job.job_id::text,
      jsonb_build_object('reason', 'synchronous_output_lost')
    );
    v_released_micros := v_released_micros + v_line_total;

    perform app_private.settle_attempt_transition(
      v_job_row, 'failed', 'reap-synchronous:' || v_job.job_id::text, null, null
    );
    v_failed := v_failed + 1;
  end loop;

  return jsonb_build_object(
    'examined', v_examined,
    'settled', v_settled,
    'failed', v_failed,
    'released_micros', v_released_micros
  );
end;
$fn$;

-- The lesson of the five missing grants, applied at authoring time rather than discovered live:
-- the default-privileges bootstrap leaves every new function unexecutable by service_role, and this
-- one is called exclusively by the privileged Worker cron.
revoke all on function public.reap_stranded_synchronous_jobs(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.reap_stranded_synchronous_jobs(integer) to service_role;

commit;
