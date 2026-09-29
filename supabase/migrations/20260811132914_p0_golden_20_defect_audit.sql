begin;

-- Read-only, service-role-only reconstruction surface for the bounded T5 RCA. It exposes stable
-- identifiers, state transitions, idempotency keys, and integer-money rows, but never provider
-- payloads, artifact object keys, signed URLs, credentials, or customer media.
create or replace function public.get_run_execution_audit(p_run_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run_count integer;
  v_runs jsonb;
  v_attempts jsonb;
  v_provider_jobs jsonb;
  v_outbox_events jsonb;
  v_idempotency_records jsonb;
  v_reservations jsonb;
  v_ledger jsonb;
begin
  if p_run_ids is null
    or coalesce(array_length(p_run_ids, 1), 0) not between 1 and 10
    or array_position(p_run_ids, null) is not null then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select count(distinct requested.id)::integer
  into v_run_count
  from unnest(p_run_ids) as requested(id);

  if v_run_count <> array_length(p_run_ids, 1) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', run.id,
    'workspace_id', run.workspace_id,
    'project_id', run.project_id,
    'quote_id', run.quote_id,
    'canvas_revision_id', run.canvas_revision_id,
    'canvas_revision_hash', run.canvas_revision_hash,
    'status', run.status,
    'dispatch_wave', run.dispatch_wave,
    'dispatch_epoch', run.dispatch_epoch,
    'confirmed_by', run.confirmed_by,
    'confirmed_at', run.confirmed_at,
    'created_at', run.created_at,
    'updated_at', run.updated_at
  ) order by run.confirmed_at, run.id), '[]'::jsonb)
  into v_runs
  from public.runs as run
  where run.id = any(p_run_ids);

  if jsonb_array_length(v_runs) <> v_run_count then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', attempt.id,
    'run_id', attempt.run_id,
    'run_node_id', attempt.run_node_id,
    'node_key', run_node.node_key,
    'dispatch_wave', run_node.dispatch_wave,
    'attempt_number', attempt.attempt_number,
    'request_id', attempt.request_id,
    'status', attempt.status,
    'provider_registration_id', attempt.provider_registration_id,
    'provider', registration.provider_key,
    'route_id', route.route_key,
    'provider_model_id', route.provider_model_id,
    'created_at', attempt.created_at,
    'updated_at', attempt.updated_at
  ) order by attempt.run_id, run_node.dispatch_wave, run_node.node_key, attempt.attempt_number), '[]'::jsonb)
  into v_attempts
  from public.attempts as attempt
  join public.run_nodes as run_node
    on run_node.workspace_id = attempt.workspace_id
   and run_node.id = attempt.run_node_id
  join public.model_routes as route on route.id = run_node.model_route_id
  join public.provider_registrations as registration
    on registration.id = attempt.provider_registration_id
  where attempt.run_id = any(p_run_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', job.id,
    'run_id', job.run_id,
    'attempt_id', job.attempt_id,
    'provider_registration_id', job.provider_registration_id,
    'provider_request_id', job.provider_request_id,
    'request_hash', job.request_hash,
    'status', job.status,
    'evidence', jsonb_strip_nulls(jsonb_build_object(
      'billing_idempotency_key', job.normalized_evidence ->> 'billing_idempotency_key',
      'outbox_event_id', job.normalized_evidence ->> 'outbox_event_id',
      'route_id', job.normalized_evidence ->> 'route_id',
      'reconciled_state', job.normalized_evidence ->> 'reconciled_state',
      'provider_error_code', job.normalized_evidence ->> 'provider_error_code',
      'reconciliation_error_code', job.normalized_evidence ->> 'reconciliation_error_code'
    )),
    'evidence_keys', (
      select coalesce(jsonb_agg(evidence_key order by evidence_key), '[]'::jsonb)
      from jsonb_object_keys(job.normalized_evidence) as evidence_key
    ),
    'created_at', job.created_at,
    'updated_at', job.updated_at
  ) order by job.run_id, job.created_at, job.id), '[]'::jsonb)
  into v_provider_jobs
  from public.provider_jobs as job
  where job.run_id = any(p_run_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event.id,
    'run_id', event.aggregate_id,
    'aggregate_type', event.aggregate_type,
    'event_type', event.event_type,
    'dedupe_key', event.dedupe_key,
    'dispatch_wave', event.payload ->> 'dispatch_wave',
    'dispatch_epoch', event.payload ->> 'dispatch_epoch',
    'status', event.status,
    'publish_attempts', event.publish_attempts,
    'available_at', event.available_at,
    'published_at', event.published_at,
    'created_at', event.created_at,
    'updated_at', event.updated_at
  ) order by event.aggregate_id, event.created_at, event.id), '[]'::jsonb)
  into v_outbox_events
  from public.outbox_events as event
  where event.aggregate_type = 'run'
    and event.aggregate_id = any(p_run_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', idem.id,
    'workspace_id', idem.workspace_id,
    'actor_id', idem.actor_id,
    'operation', idem.operation,
    'idempotency_key', idem.idempotency_key,
    'request_hash', idem.request_hash,
    'response_run_id', coalesce(
      idem.response_payload ->> 'run_id',
      idem.response_payload #>> '{result,run_id}'
    ),
    'response_reservation_id', coalesce(
      idem.response_payload ->> 'reservation_id',
      idem.response_payload #>> '{result,reservation_id}'
    ),
    'created_at', idem.created_at,
    'expires_at', idem.expires_at
  ) order by idem.workspace_id, idem.created_at, idem.id), '[]'::jsonb)
  into v_idempotency_records
  from public.idempotency_records as idem
  where idem.workspace_id in (
    select run.workspace_id from public.runs as run where run.id = any(p_run_ids)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', reservation.id,
    'workspace_id', reservation.workspace_id,
    'quote_id', reservation.quote_id,
    'run_id', reservation.run_id,
    'amount_micros', reservation.amount_micros,
    'captured_micros', reservation.captured_micros,
    'released_micros', reservation.released_micros,
    'refunded_micros', reservation.refunded_micros,
    'status', reservation.status,
    'created_at', reservation.created_at,
    'updated_at', reservation.updated_at
  ) order by reservation.created_at, reservation.id), '[]'::jsonb)
  into v_reservations
  from public.cost_reservations as reservation
  where reservation.run_id = any(p_run_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ledger.id,
    'workspace_id', ledger.workspace_id,
    'transaction_id', ledger.transaction_id,
    'entry_type', ledger.entry_type,
    'account_code', ledger.account_code,
    'direction', ledger.direction,
    'amount_micros', ledger.amount_micros,
    'causative_key', ledger.causative_key,
    'reservation_id', ledger.reservation_id,
    'run_id', ledger.run_id,
    'artifact_id', ledger.metadata ->> 'artifact_id',
    'created_at', ledger.created_at
  ) order by ledger.run_id, ledger.created_at, ledger.id), '[]'::jsonb)
  into v_ledger
  from public.ledger_transactions as ledger
  where ledger.run_id = any(p_run_ids)
     or ledger.reservation_id in (
       select reservation.id
       from public.cost_reservations as reservation
       where reservation.run_id = any(p_run_ids)
     );

  return jsonb_build_object(
    'observed_at', statement_timestamp(),
    'runs', v_runs,
    'attempts', v_attempts,
    'provider_jobs', v_provider_jobs,
    'outbox_events', v_outbox_events,
    'idempotency_records', v_idempotency_records,
    'reservations', v_reservations,
    'ledger', v_ledger
  );
end;
$$;

revoke all on function public.get_run_execution_audit(uuid[])
from public, anon, authenticated, service_role;
grant execute on function public.get_run_execution_audit(uuid[]) to service_role;

comment on function public.get_run_execution_audit(uuid[]) is
  'Service-role-only bounded, read-only execution and money reconstruction without provider payloads, artifact keys, signed URLs, credentials, or customer media.';

commit;
