begin;

-- Track D: give the OpenRouter copy route a terminal path.
--
-- advance_fal_provider_attempt filters provider_jobs to provider_key = 'fal', so an OpenRouter
-- attempt could never advance: the generated ad copy was discarded, the node was never captured, and
-- the run's reservation could never settle. Copy is the cheapest thing in the launch pack and gates
-- every image node, so this is also what makes a full pack reachable.
--
-- Rather than widening the one proven money-path function to accept two providers - which would mean
-- re-proving it - the provider-agnostic tail is moved verbatim into
-- app_private.settle_attempt_transition and both entry points call it. Generated mechanically by
-- .scratch/build-track-d-migration.mjs, which asserts that the capture proof, the release proof, the
-- readiness advance and the run aggregation all survive the move.


create or replace function public.get_provider_artifact_context(
  p_provider_request_id text,
  p_provider_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_result jsonb;
begin
  if p_provider_request_id is null
    or char_length(p_provider_request_id) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select jsonb_build_object(
    'workspace_id', run.workspace_id,
    'project_id', run.project_id,
    'run_id', run.id,
    'canvas_revision_id', run.canvas_revision_id,
    'run_node_id', run_node.id,
    'attempt_id', attempt.id,
    'attempt_status', attempt.status,
    'provider_job_status', job.status,
    'asset_role', node.item -> 'parameters' ->> 'asset_role',
    'price_unit', plan.item -> 'price_components' -> 0 ->> 'unit',
    'unit_price_micros', plan.item -> 'price_components' -> 0 ->> 'unit_price_micros',
    'quoted_total_micros', plan.item ->> 'total_micros',
    'reservation', jsonb_build_object(
      'id', reservation.id,
      'amount_micros', reservation.amount_micros::text,
      'captured_micros', reservation.captured_micros::text,
      'released_micros', reservation.released_micros::text
    )
  )
  into v_result
  from public.provider_jobs as job
  join public.provider_registrations as registration
    on registration.id = job.provider_registration_id
   and registration.provider_key = p_provider_key
  join public.attempts as attempt
    on attempt.workspace_id = job.workspace_id
   and attempt.id = job.attempt_id
  join public.run_nodes as run_node
    on run_node.workspace_id = attempt.workspace_id
   and run_node.id = attempt.run_node_id
  join public.runs as run
    on run.workspace_id = run_node.workspace_id
   and run.id = run_node.run_id
  join public.quotes as quote
    on quote.workspace_id = run.workspace_id
   and quote.id = run.quote_id
  join public.canvas_revisions as revision
    on revision.workspace_id = run.workspace_id
   and revision.id = run.canvas_revision_id
  join public.cost_reservations as reservation
    on reservation.workspace_id = run.workspace_id
   and reservation.run_id = run.id
  cross join lateral jsonb_array_elements(revision.graph_snapshot -> 'nodes') as node(item)
  cross join lateral jsonb_array_elements(quote.execution_plan) as plan(item)
  where job.provider_request_id = p_provider_request_id
    and node.item ->> 'id' = run_node.node_key
    and plan.item ->> 'node_id' = run_node.node_key
    and jsonb_array_length(plan.item -> 'price_components') = 1
    and plan.item -> 'price_components' -> 0 ->> 'unit' in ('image', 'video_second', 'request')
    and plan.item -> 'price_components' -> 0 ->> 'unit_price_micros' ~ '^[0-9]+$'
    and plan.item ->> 'total_micros' ~ '^[0-9]+$';

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  return v_result;
end;
$$;

-- Unchanged signature and behaviour for every existing caller.
create or replace function public.get_fal_artifact_context(p_provider_request_id text)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $fn$
  select public.get_provider_artifact_context(p_provider_request_id, 'fal');
$fn$;

revoke all on function public.get_provider_artifact_context(text, text) from public;


-- The provider-agnostic settlement tail, moved out of advance_fal_provider_attempt WITHOUT edits.
-- It owns the capture/release proof, the idempotent terminal short-circuit, the readiness advance,
-- the run-status aggregation and the outcomes envelope. Both provider-specific entry points call it,
-- so the copy route settles through exactly the code the fal route already proved rather than through
-- a parallel implementation that would have to be proven separately.
--
-- The caller is responsible for validating arguments and for locking the provider_jobs row; the row
-- is passed in so it is not looked up twice under different predicates.
create or replace function app_private.settle_attempt_transition(
  p_job public.provider_jobs,
  p_status text,
  p_event_id text,
  p_artifact_id uuid,
  p_capture_micros bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
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
  select * into v_attempt
  from public.attempts
  where workspace_id = p_job.workspace_id and id = p_job.attempt_id
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
    where id = p_job.id;

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
$fn$;

-- Unchanged behaviour: same preconditions, same provider filter, same arguments. Only the shared
-- tail moved.
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
as $fn$
declare
  v_job public.provider_jobs%rowtype;
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

  return app_private.settle_attempt_transition(
    v_job, p_status, p_event_id, p_artifact_id, p_capture_micros
  );
end;
$fn$;


-- The OpenRouter copy route had NO terminal advance at all. advance_fal_provider_attempt joins
-- provider_registrations on provider_key = 'fal', so a copy attempt raised NOT_FOUND: its output was
-- discarded, its node never captured, and the run could never terminalize. This is the sibling.
create or replace function public.advance_copy_provider_attempt(
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
as $fn$
declare
  v_job public.provider_jobs%rowtype;
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
   and registration.provider_key = 'openrouter'
  where job.provider_request_id = p_provider_request_id
  for update of job;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  return app_private.settle_attempt_transition(
    v_job, p_status, p_event_id, p_artifact_id, p_capture_micros
  );
end;
$fn$;


revoke all on function app_private.settle_attempt_transition(
  public.provider_jobs, text, text, uuid, bigint
) from public;
revoke all on function public.advance_copy_provider_attempt(text, text, text, uuid, bigint)
  from public;

commit;
