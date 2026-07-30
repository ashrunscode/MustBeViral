begin;

-- Removes the only path that could mark an attempt succeeded without artifact-and-capture proof.
--
-- record_provider_submission accepted p_status = 'succeeded' and, on that value, set the attempt,
-- run node and provider job to succeeded with no artifact registered and no ledger capture. That
-- broke an invariant advance_fal_provider_attempt already enforces for itself
-- ('SUCCEEDED_ATTEMPT_REQUIRES_ARTIFACT_CAPTURE'), so the rule held in one function and was
-- violated in another.
--
-- The consequence was not theoretical. A succeeded attempt with no capture row makes the outcomes
-- aggregation emit a null capture_micros, which jsonb_strip_nulls then deletes, which made every
-- later fal webhook in that run fail and 503-loop on top of money already captured. Commit e0b96ee
-- made that failure terminal instead of retryable; this makes it unreachable.
--
-- Submission now records intent only. Success is exclusively the business of the advance_* functions,
-- which require the artifact and the capture to exist first.

create or replace function public.record_provider_submission(
  p_event_id uuid,
  p_attempt_id uuid,
  p_route_id text,
  p_billing_idempotency_key text,
  p_provider_request_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_attempt public.attempts%rowtype;
  v_route public.model_routes%rowtype;
  v_job_id uuid;
begin
  -- 'succeeded' is no longer an accepted submission status. A caller that still sends it is a stale
  -- deploy and must fail loudly rather than silently skip the capture proof.
  if p_event_id is null or p_attempt_id is null
    or p_route_id is null or char_length(p_route_id) not between 1 and 240
    or p_billing_idempotency_key is null
      or char_length(p_billing_idempotency_key) not between 1 and 200
    or p_provider_request_id is null or char_length(p_provider_request_id) not between 1 and 300
    or p_status <> 'queued' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select attempt.* into v_attempt
  from public.attempts as attempt
  join public.outbox_events as event
    on event.workspace_id = attempt.workspace_id
   and event.aggregate_id = attempt.run_id
  where attempt.id = p_attempt_id
    and event.id = p_event_id
    and event.event_type = 'run.dispatch_requested'
  for update of attempt;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select route.* into v_route
  from public.model_routes as route
  join public.run_nodes as run_node
    on run_node.workspace_id = v_attempt.workspace_id
   and run_node.id = v_attempt.run_node_id
   and run_node.model_route_id = route.id
  where route.route_key = p_route_id
    and route.provider_registration_id = v_attempt.provider_registration_id;

  if not found then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  insert into public.provider_jobs (
    workspace_id,
    run_id,
    attempt_id,
    provider_registration_id,
    provider_request_id,
    request_hash,
    status,
    normalized_evidence
  ) values (
    v_attempt.workspace_id,
    v_attempt.run_id,
    v_attempt.id,
    v_attempt.provider_registration_id,
    p_provider_request_id,
    app_private.hash_canonical_json(jsonb_build_object(
      'billing_idempotency_key', p_billing_idempotency_key,
      'route_id', p_route_id
    )),
    'submitted',
    jsonb_build_object(
      'billing_idempotency_key', p_billing_idempotency_key,
      'outbox_event_id', p_event_id,
      'route_id', p_route_id
    )
  )
  on conflict (workspace_id, attempt_id) do update
  set
    status = excluded.status,
    normalized_evidence =
      public.provider_jobs.normalized_evidence || excluded.normalized_evidence
  returning id into v_job_id;

  update public.attempts
  set status = 'submitted'
  where id = v_attempt.id;

  update public.run_nodes
  set status = 'queued'
  where workspace_id = v_attempt.workspace_id and id = v_attempt.run_node_id;

  update public.runs
  set status = 'dispatching'
  where workspace_id = v_attempt.workspace_id
    and id = v_attempt.run_id
    and status in ('queued', 'dispatching', 'running');

  return jsonb_build_object('provider_job_id', v_job_id, 'status', 'submitted');
end;
$fn$;

revoke all on function public.record_provider_submission(uuid, uuid, text, text, text, text)
  from public;

-- Prevents the fix above from creating a NEW fund trap.
--
-- With submissions now always landing as 'submitted', a synchronous provider's job would be picked
-- up by list_provider_jobs_for_reconciliation. OpenRouterCopyDriver has no status() method because
-- the call is synchronous, so ProviderReconciler would call recordFailure, and
-- record_provider_job_reconciliation('unknown') would flip the attempt to 'ambiguous' and the run to
-- 'reconciliation_required' - a state with no exit transitions, holding the reservation forever.
--
-- Reconciliation only applies to providers we poll. Declaring that per registration keeps the
-- distinction in data rather than in a hardcoded provider_key list.
alter table public.provider_registrations
  add column if not exists reconciliation_mode text not null default 'poll'
    check (reconciliation_mode in ('poll', 'synchronous'));

comment on column public.provider_registrations.reconciliation_mode is
  'poll: the provider is asynchronous and its jobs are polled for terminal status. synchronous: the '
  'driver returns the outcome on the submit call, so there is nothing to poll and the job must not '
  'enter the reconciler.';

update public.provider_registrations
set reconciliation_mode = 'synchronous'
where provider_key = 'openrouter';

create or replace function public.list_provider_jobs_for_reconciliation(p_limit integer)
returns table (
  provider_job_id uuid,
  provider text,
  route_id text,
  provider_request_id text,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  return query
  select
    job.id,
    registration.provider_key,
    route.route_key,
    job.provider_request_id,
    job.status
  from public.provider_jobs as job
  join public.attempts as attempt
    on attempt.workspace_id = job.workspace_id
   and attempt.id = job.attempt_id
  join public.run_nodes as run_node
    on run_node.workspace_id = attempt.workspace_id
   and run_node.id = attempt.run_node_id
  join public.model_routes as route
    on route.id = run_node.model_route_id
  join public.provider_registrations as registration
    on registration.id = job.provider_registration_id
  where job.status in ('submitted', 'unknown')
    and registration.reconciliation_mode = 'poll'
  order by job.updated_at, job.id
  limit p_limit;
end;
$fn$;

revoke all on function public.list_provider_jobs_for_reconciliation(integer) from public;

commit;
