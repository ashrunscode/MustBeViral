begin;

create or replace function public.claim_outbox_events(
  p_limit integer,
  p_lease_owner text,
  p_lease_seconds integer
)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_limit is null or p_limit not between 1 and 100
    or p_lease_owner is null or char_length(p_lease_owner) not between 1 and 200
    or p_lease_seconds is null or p_lease_seconds not between 1 and 600 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  return query
  with claimable as (
    select event.id
    from public.outbox_events as event
    where (
      event.status = 'pending'
      and event.available_at <= statement_timestamp()
    ) or (
      event.status = 'leased'
      and event.lease_expires_at <= statement_timestamp()
    )
    order by event.available_at, event.created_at, event.id
    for update skip locked
    limit p_limit
  )
  update public.outbox_events as event
  set
    status = 'leased',
    lease_owner = p_lease_owner,
    lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds)
  from claimable
  where event.id = claimable.id
  returning event.*;
end;
$$;

create or replace function public.publish_outbox_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_status text;
begin
  if p_event_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  update public.outbox_events
  set
    status = 'published',
    published_at = coalesce(published_at, statement_timestamp()),
    lease_owner = null,
    lease_expires_at = null
  where id = p_event_id
    and status = 'leased'
  returning status into v_status;

  if found then
    return jsonb_build_object('published', true, 'status', v_status);
  end if;

  select status into v_status
  from public.outbox_events
  where id = p_event_id;

  return jsonb_build_object(
    'published',
    coalesce(v_status = 'published', false),
    'status',
    coalesce(v_status, 'not_found')
  );
end;
$$;

create or replace function public.fail_outbox_event(
  p_event_id uuid,
  p_retry_after_seconds integer,
  p_max_attempts integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_status text;
  v_attempts integer;
begin
  if p_event_id is null
    or p_retry_after_seconds is null or p_retry_after_seconds not between 0 and 86400
    or p_max_attempts is null or p_max_attempts not between 1 and 100 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  update public.outbox_events
  set
    publish_attempts = publish_attempts + 1,
    status = case when publish_attempts + 1 >= p_max_attempts then 'dead' else 'pending' end,
    available_at = case
      when publish_attempts + 1 >= p_max_attempts then available_at
      else statement_timestamp() + make_interval(secs => p_retry_after_seconds)
    end,
    lease_owner = null,
    lease_expires_at = null
  where id = p_event_id
    and status in ('pending', 'leased')
  returning status, publish_attempts into v_status, v_attempts;

  if found then
    return jsonb_build_object('status', v_status, 'publish_attempts', v_attempts);
  end if;

  select status, publish_attempts into v_status, v_attempts
  from public.outbox_events
  where id = p_event_id;

  return jsonb_build_object(
    'status',
    coalesce(v_status, 'not_found'),
    'publish_attempts',
    coalesce(v_attempts, 0)
  );
end;
$$;

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
as $$
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
    and node.item ->> 'id' = run_node.node_key
    and plan.item ->> 'node_id' = run_node.node_key
    and plan.item ->> 'model_route_id' = route.id::text
  order by attempt.created_at, attempt.id;
end;
$$;

create unique index provider_jobs_billing_idempotency_key_idx
  on public.provider_jobs ((normalized_evidence ->> 'billing_idempotency_key'))
  where normalized_evidence ? 'billing_idempotency_key';

create or replace function public.find_provider_submission_by_billing_key(
  p_billing_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_result jsonb;
begin
  if p_billing_idempotency_key is null
    or char_length(p_billing_idempotency_key) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select jsonb_build_object(
    'provider', registration.provider_key,
    'route_id', route.route_key,
    'provider_job_id', job.provider_request_id,
    'state', case when job.status = 'succeeded' then 'succeeded' else 'queued' end
  )
  into v_result
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
  where job.normalized_evidence ->> 'billing_idempotency_key' = p_billing_idempotency_key;

  return v_result;
end;
$$;

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
as $$
declare
  v_attempt public.attempts%rowtype;
  v_route public.model_routes%rowtype;
  v_job_id uuid;
  v_job_status text;
begin
  if p_event_id is null or p_attempt_id is null
    or p_route_id is null or char_length(p_route_id) not between 1 and 240
    or p_billing_idempotency_key is null
      or char_length(p_billing_idempotency_key) not between 1 and 200
    or p_provider_request_id is null or char_length(p_provider_request_id) not between 1 and 300
    or p_status not in ('queued', 'succeeded') then
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

  v_job_status := case when p_status = 'succeeded' then 'succeeded' else 'submitted' end;

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
    v_job_status,
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
  set status = case when p_status = 'succeeded' then 'succeeded' else 'submitted' end
  where id = v_attempt.id;

  update public.run_nodes
  set status = case when p_status = 'succeeded' then 'succeeded' else 'queued' end
  where workspace_id = v_attempt.workspace_id and id = v_attempt.run_node_id;

  update public.runs
  set status = case when p_status = 'succeeded' then 'running' else 'dispatching' end
  where workspace_id = v_attempt.workspace_id
    and id = v_attempt.run_id
    and status in ('queued', 'dispatching', 'running');

  return jsonb_build_object('provider_job_id', v_job_id, 'status', v_job_status);
end;
$$;

create or replace function public.record_provider_ambiguity(
  p_event_id uuid,
  p_attempt_id uuid,
  p_route_id text,
  p_billing_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_attempt public.attempts%rowtype;
  v_job_id uuid;
begin
  if p_event_id is null or p_attempt_id is null
    or p_route_id is null or char_length(p_route_id) not between 1 and 240
    or p_billing_idempotency_key is null
      or char_length(p_billing_idempotency_key) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select attempt.* into v_attempt
  from public.attempts as attempt
  join public.outbox_events as event
    on event.workspace_id = attempt.workspace_id
   and event.aggregate_id = attempt.run_id
  join public.run_nodes as run_node
    on run_node.workspace_id = attempt.workspace_id
   and run_node.id = attempt.run_node_id
  join public.model_routes as route
    on route.id = run_node.model_route_id
   and route.provider_registration_id = attempt.provider_registration_id
  where attempt.id = p_attempt_id
    and event.id = p_event_id
    and route.route_key = p_route_id
  for update of attempt;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
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
    'ambiguous:' || v_attempt.id::text,
    app_private.hash_canonical_json(jsonb_build_object(
      'billing_idempotency_key', p_billing_idempotency_key,
      'route_id', p_route_id
    )),
    'unknown',
    jsonb_build_object(
      'billing_idempotency_key', p_billing_idempotency_key,
      'outbox_event_id', p_event_id,
      'route_id', p_route_id,
      'ambiguity', 'submit_acceptance_unknown'
    )
  )
  on conflict (workspace_id, attempt_id) do update
  set
    status = 'unknown',
    normalized_evidence =
      public.provider_jobs.normalized_evidence || excluded.normalized_evidence
  returning id into v_job_id;

  update public.attempts
  set status = 'ambiguous'
  where id = v_attempt.id;

  update public.run_nodes
  set status = 'reconciliation_required'
  where workspace_id = v_attempt.workspace_id and id = v_attempt.run_node_id;

  update public.runs
  set status = 'reconciliation_required'
  where workspace_id = v_attempt.workspace_id
    and id = v_attempt.run_id
    and status in ('queued', 'dispatching', 'running');

  return jsonb_build_object('provider_job_id', v_job_id, 'status', 'unknown');
end;
$$;

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
as $$
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
  order by job.updated_at, job.id
  limit p_limit;
end;
$$;

create or replace function public.record_provider_job_reconciliation(
  p_provider_job_id uuid,
  p_status text,
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_job public.provider_jobs%rowtype;
  v_database_status text;
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

  return jsonb_build_object('status', v_database_status, 'terminal', false);
end;
$$;

revoke select on table public.outbox_events from authenticated;
revoke all on table public.outbox_events from public, anon, service_role;

revoke all on function public.claim_outbox_events(integer, text, integer)
from public, anon, authenticated, service_role;
revoke all on function public.publish_outbox_event(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.fail_outbox_event(uuid, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function public.get_outbox_dispatch_attempts(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.find_provider_submission_by_billing_key(text)
from public, anon, authenticated, service_role;
revoke all on function public.record_provider_submission(uuid, uuid, text, text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.record_provider_ambiguity(uuid, uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.list_provider_jobs_for_reconciliation(integer)
from public, anon, authenticated, service_role;
revoke all on function public.record_provider_job_reconciliation(uuid, text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.claim_outbox_events(integer, text, integer)
to service_role;
grant execute on function public.publish_outbox_event(uuid)
to service_role;
grant execute on function public.fail_outbox_event(uuid, integer, integer)
to service_role;
grant execute on function public.get_outbox_dispatch_attempts(uuid, text)
to service_role;
grant execute on function public.find_provider_submission_by_billing_key(text)
to service_role;
grant execute on function public.record_provider_submission(uuid, uuid, text, text, text, text)
to service_role;
grant execute on function public.record_provider_ambiguity(uuid, uuid, text, text)
to service_role;
grant execute on function public.list_provider_jobs_for_reconciliation(integer)
to service_role;
grant execute on function public.record_provider_job_reconciliation(uuid, text, jsonb)
to service_role;

comment on function public.claim_outbox_events(integer, text, integer) is
  'Machine-only atomic pending or expired-lease claim using row locks and skip locked.';
comment on function public.publish_outbox_event(uuid) is
  'Machine-only terminal publication transition for one leased outbox event.';
comment on function public.fail_outbox_event(uuid, integer, integer) is
  'Machine-only bounded retry transition with backoff and poison-event dead lettering.';
comment on function public.get_outbox_dispatch_attempts(uuid, text) is
  'Machine-only expansion of one leased run dispatch event into stable per-attempt inputs.';
comment on function public.find_provider_submission_by_billing_key(text) is
  'Machine-only duplicate-submission guard backed by provider_jobs.';
comment on function public.record_provider_ambiguity(uuid, uuid, text, text) is
  'Machine-only durable unknown provider job record for ambiguous submission reconciliation.';

commit;
