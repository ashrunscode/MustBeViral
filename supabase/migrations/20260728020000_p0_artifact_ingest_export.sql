begin;

alter table public.artifacts
  add column run_node_id uuid,
  add constraint artifacts_workspace_id_run_node_id_fkey
    foreign key (workspace_id, run_node_id)
    references public.run_nodes(workspace_id, id) on delete restrict;

create index artifacts_workspace_run_node_created_idx
  on public.artifacts (workspace_id, run_node_id, created_at, id)
  where run_node_id is not null;

create or replace function public.get_fal_artifact_context(p_provider_request_id text)
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
   and registration.provider_key = 'fal'
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
    and plan.item -> 'price_components' -> 0 ->> 'unit' in ('image', 'video_second')
    and plan.item -> 'price_components' -> 0 ->> 'unit_price_micros' ~ '^[0-9]+$'
    and plan.item ->> 'total_micros' ~ '^[0-9]+$';

  if v_result is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  return v_result;
end;
$$;

create or replace function public.register_artifact(
  p_run_id uuid,
  p_run_node_id uuid,
  p_artifact_kind text,
  p_status text,
  p_object_key text,
  p_content_hash text,
  p_mime_type text,
  p_byte_size bigint,
  p_parent_artifact_ids uuid[] default '{}'::uuid[],
  p_relationship text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.runs%rowtype;
  v_artifact_id uuid;
  v_inserted boolean;
  v_asset_role text;
  v_parent_count integer;
  v_result jsonb;
begin
  if p_run_id is null
    or p_artifact_kind not in ('input', 'provider_output', 'approved_output', 'export')
    or p_status not in ('available', 'quarantined')
    or p_object_key is null or char_length(p_object_key) not between 1 and 1024
    or position('://' in p_object_key) > 0
    or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$'
    or p_mime_type is null or char_length(p_mime_type) not between 1 and 160
    or p_byte_size is null or p_byte_size <= 0
    or p_parent_artifact_ids is null
    or (p_relationship is not null and p_relationship not in (
      'input_to_output', 'adaptation', 'motion_source', 'export_member', 'revision_source'
    )) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  if (p_artifact_kind = 'provider_output' and p_run_node_id is null)
    or (p_artifact_kind = 'export' and p_run_node_id is not null)
    or (p_artifact_kind = 'export' and p_relationship <> 'export_member')
    or (p_artifact_kind <> 'export' and p_relationship = 'export_member') then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_run
  from public.runs
  where id = p_run_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if p_object_key not like
    'workspaces/' || v_run.workspace_id::text || '/runs/' || v_run.id::text || '/%' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  if p_run_node_id is not null then
    select node.item -> 'parameters' ->> 'asset_role'
    into v_asset_role
    from public.run_nodes as run_node
    join public.canvas_revisions as revision
      on revision.workspace_id = run_node.workspace_id
     and revision.id = v_run.canvas_revision_id
    cross join lateral jsonb_array_elements(revision.graph_snapshot -> 'nodes') as node(item)
    where run_node.workspace_id = v_run.workspace_id
      and run_node.run_id = v_run.id
      and run_node.id = p_run_node_id
      and node.item ->> 'id' = run_node.node_key;

    if not found then
      raise exception using errcode = 'P0002', message = 'NOT_FOUND';
    end if;
  end if;

  select count(distinct artifact.id)::integer
  into v_parent_count
  from unnest(p_parent_artifact_ids) as requested(id)
  join public.artifacts as artifact
    on artifact.workspace_id = v_run.workspace_id
   and artifact.run_id = v_run.id
   and artifact.id = requested.id
   and artifact.status = 'available';

  if v_parent_count <> coalesce(array_length(p_parent_artifact_ids, 1), 0) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  insert into public.artifacts (
    workspace_id,
    project_id,
    run_id,
    run_node_id,
    canvas_revision_id,
    artifact_kind,
    status,
    object_key,
    content_hash,
    mime_type,
    byte_size,
    rights_attestation
  ) values (
    v_run.workspace_id,
    v_run.project_id,
    v_run.id,
    p_run_node_id,
    v_run.canvas_revision_id,
    p_artifact_kind,
    p_status,
    p_object_key,
    p_content_hash,
    p_mime_type,
    p_byte_size,
    jsonb_build_object(
      'visibility', 'private',
      'canonical_storage', 'r2'
    )
  )
  on conflict (object_key) do update
  set object_key = excluded.object_key
  where public.artifacts.workspace_id = excluded.workspace_id
    and public.artifacts.project_id = excluded.project_id
    and public.artifacts.run_id = excluded.run_id
    and public.artifacts.run_node_id is not distinct from excluded.run_node_id
    and public.artifacts.canvas_revision_id = excluded.canvas_revision_id
    and public.artifacts.artifact_kind = excluded.artifact_kind
    and public.artifacts.status = excluded.status
    and public.artifacts.content_hash = excluded.content_hash
    and public.artifacts.mime_type = excluded.mime_type
    and public.artifacts.byte_size = excluded.byte_size
  returning id, (xmax = 0) into v_artifact_id, v_inserted;

  if v_artifact_id is null then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
  end if;

  if p_status = 'available' and p_relationship is not null then
    insert into public.artifact_lineage (
      workspace_id,
      parent_artifact_id,
      child_artifact_id,
      relationship
    )
    select
      v_run.workspace_id,
      requested.id,
      v_artifact_id,
      p_relationship
    from unnest(p_parent_artifact_ids) as requested(id)
    on conflict (workspace_id, parent_artifact_id, child_artifact_id, relationship) do nothing;
  end if;

  if p_status = 'available' and p_run_node_id is not null then
    insert into public.artifact_lineage (
      workspace_id,
      parent_artifact_id,
      child_artifact_id,
      relationship
    )
    select
      v_run.workspace_id,
      parent_artifact.id,
      v_artifact_id,
      case
        when v_asset_role = 'adaptation' then 'adaptation'
        when v_asset_role = 'motion_branch' then 'motion_source'
        else 'input_to_output'
      end
    from public.canvas_revisions as revision
    cross join lateral jsonb_array_elements(revision.graph_snapshot -> 'edges') as edge(item)
    join public.run_nodes as child_node
      on child_node.workspace_id = v_run.workspace_id
     and child_node.run_id = v_run.id
     and child_node.id = p_run_node_id
     and child_node.node_key = edge.item ->> 'target_node_id'
    join public.run_nodes as parent_node
      on parent_node.workspace_id = child_node.workspace_id
     and parent_node.run_id = child_node.run_id
     and parent_node.node_key = edge.item ->> 'source_node_id'
    join public.artifacts as parent_artifact
      on parent_artifact.workspace_id = parent_node.workspace_id
     and parent_artifact.run_id = parent_node.run_id
     and parent_artifact.run_node_id = parent_node.id
     and parent_artifact.status = 'available'
    where revision.workspace_id = v_run.workspace_id
      and revision.id = v_run.canvas_revision_id
    on conflict (workspace_id, parent_artifact_id, child_artifact_id, relationship) do nothing;

    insert into public.artifact_lineage (
      workspace_id,
      parent_artifact_id,
      child_artifact_id,
      relationship
    )
    select
      v_run.workspace_id,
      v_artifact_id,
      child_artifact.id,
      case
        when child_node_json.item -> 'parameters' ->> 'asset_role' = 'adaptation'
          then 'adaptation'
        when child_node_json.item -> 'parameters' ->> 'asset_role' = 'motion_branch'
          then 'motion_source'
        else 'input_to_output'
      end
    from public.canvas_revisions as revision
    cross join lateral jsonb_array_elements(revision.graph_snapshot -> 'edges') as edge(item)
    cross join lateral jsonb_array_elements(revision.graph_snapshot -> 'nodes')
      as child_node_json(item)
    join public.run_nodes as parent_node
      on parent_node.workspace_id = v_run.workspace_id
     and parent_node.run_id = v_run.id
     and parent_node.id = p_run_node_id
     and parent_node.node_key = edge.item ->> 'source_node_id'
    join public.run_nodes as child_node
      on child_node.workspace_id = parent_node.workspace_id
     and child_node.run_id = parent_node.run_id
     and child_node.node_key = edge.item ->> 'target_node_id'
     and child_node.node_key = child_node_json.item ->> 'id'
    join public.artifacts as child_artifact
      on child_artifact.workspace_id = child_node.workspace_id
     and child_artifact.run_id = child_node.run_id
     and child_artifact.run_node_id = child_node.id
     and child_artifact.status = 'available'
    where revision.workspace_id = v_run.workspace_id
      and revision.id = v_run.canvas_revision_id
    on conflict (workspace_id, parent_artifact_id, child_artifact_id, relationship) do nothing;
  end if;

  select jsonb_build_object(
    'replayed', not v_inserted,
    'artifact', jsonb_build_object(
      'id', artifact.id,
      'workspace_id', artifact.workspace_id,
      'project_id', artifact.project_id,
      'run_id', artifact.run_id,
      'run_node_id', artifact.run_node_id,
      'canvas_revision_id', artifact.canvas_revision_id,
      'artifact_kind', artifact.artifact_kind,
      'status', artifact.status,
      'object_key', artifact.object_key,
      'content_hash', artifact.content_hash,
      'mime_type', artifact.mime_type,
      'byte_size', artifact.byte_size
    )
  )
  into v_result
  from public.artifacts as artifact
  where artifact.id = v_artifact_id;

  return v_result;
end;
$$;

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
as $$
declare
  v_job public.provider_jobs%rowtype;
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

  select * into v_attempt
  from public.attempts
  where workspace_id = v_job.workspace_id and id = v_job.attempt_id
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
    where id = v_job.id;

    update public.attempts
    set status = p_status
    where workspace_id = v_attempt.workspace_id and id = v_attempt.id;

    update public.run_nodes
    set status = p_status
    where workspace_id = v_run_node.workspace_id and id = v_run_node.id;
  end if;

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
$$;

create or replace function public.get_export_context(
  p_run_id uuid,
  p_artifact_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run public.runs%rowtype;
  v_reservation public.cost_reservations%rowtype;
  v_requested_count integer;
  v_artifacts jsonb;
  v_lineage jsonb;
  v_provider_jobs jsonb;
begin
  if p_run_id is null
    or p_artifact_ids is null
    or coalesce(array_length(p_artifact_ids, 1), 0) not between 1 and 100
    or array_position(p_artifact_ids, null) is not null then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select count(distinct requested.id)::integer
  into v_requested_count
  from unnest(p_artifact_ids) as requested(id);

  if v_requested_count <> array_length(p_artifact_ids, 1) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_run
  from public.runs
  where id = p_run_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_reservation
  from public.cost_reservations
  where workspace_id = v_run.workspace_id and run_id = v_run.id;

  if v_run.status not in ('succeeded', 'partial_succeeded')
    or v_reservation.amount_micros
      - v_reservation.captured_micros
      - v_reservation.released_micros <> 0 then
    raise exception using errcode = '23514', message = 'RUN_NOT_EXPORTABLE';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', artifact.id,
    'artifact_kind', artifact.artifact_kind,
    'object_key', artifact.object_key,
    'content_hash', artifact.content_hash,
    'mime_type', artifact.mime_type,
    'byte_size', artifact.byte_size
  ) order by artifact.id)
  into v_artifacts
  from unnest(p_artifact_ids) as requested(id)
  join public.artifacts as artifact
    on artifact.workspace_id = v_run.workspace_id
   and artifact.run_id = v_run.id
   and artifact.id = requested.id
   and artifact.artifact_kind = 'approved_output'
   and artifact.status = 'available'
   and artifact.content_hash is not null;

  if jsonb_array_length(coalesce(v_artifacts, '[]'::jsonb)) <> v_requested_count then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'parent_artifact_id', lineage.parent_artifact_id,
    'child_artifact_id', lineage.child_artifact_id,
    'relationship', lineage.relationship
  ) order by lineage.child_artifact_id, lineage.parent_artifact_id, lineage.relationship), '[]'::jsonb)
  into v_lineage
  from public.artifact_lineage as lineage
  where lineage.workspace_id = v_run.workspace_id
    and lineage.child_artifact_id = any(p_artifact_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id', attempt.id,
    'provider', registration.provider_key,
    'provider_model_id', route.provider_model_id,
    'route_id', route.route_key,
    'status', job.status,
    'capture_micros', coalesce((
      select max(ledger.amount_micros)
      from public.ledger_transactions as ledger
      where ledger.workspace_id = attempt.workspace_id
        and ledger.run_id = attempt.run_id
        and ledger.entry_type = 'capture'
        and ledger.causative_key =
          'run:' || attempt.run_id::text || ':attempt:' || attempt.id::text || ':capture'
    ), 0)
  ) order by attempt.id), '[]'::jsonb)
  into v_provider_jobs
  from public.provider_jobs as job
  join public.attempts as attempt
    on attempt.workspace_id = job.workspace_id and attempt.id = job.attempt_id
  join public.run_nodes as run_node
    on run_node.workspace_id = attempt.workspace_id and run_node.id = attempt.run_node_id
  join public.model_routes as route
    on route.id = run_node.model_route_id
  join public.provider_registrations as registration
    on registration.id = job.provider_registration_id
  where job.workspace_id = v_run.workspace_id and job.run_id = v_run.id;

  return jsonb_build_object(
    'workspace_id', v_run.workspace_id,
    'project_id', v_run.project_id,
    'run_id', v_run.id,
    'canvas_revision_id', v_run.canvas_revision_id,
    'canvas_revision_hash', v_run.canvas_revision_hash,
    'quote_id', v_run.quote_id,
    'run_status', v_run.status,
    'reservation', jsonb_build_object(
      'amount_micros', v_reservation.amount_micros,
      'captured_micros', v_reservation.captured_micros,
      'released_micros', v_reservation.released_micros
    ),
    'artifacts', v_artifacts,
    'lineage', v_lineage,
    'provider_jobs', v_provider_jobs
  );
end;
$$;

revoke all on function public.get_fal_artifact_context(text)
from public, anon, authenticated, service_role;
revoke all on function public.register_artifact(
  uuid, uuid, text, text, text, text, text, bigint, uuid[], text
)
from public, anon, authenticated, service_role;
revoke all on function public.advance_fal_provider_attempt(text, text, text, uuid, bigint)
from public, anon, authenticated, service_role;
revoke all on function public.get_export_context(uuid, uuid[])
from public, anon, authenticated, service_role;

grant execute on function public.get_fal_artifact_context(text)
to service_role;
grant execute on function public.register_artifact(
  uuid, uuid, text, text, text, text, text, bigint, uuid[], text
)
to service_role;
grant execute on function public.advance_fal_provider_attempt(text, text, text, uuid, bigint)
to service_role;
grant execute on function public.get_export_context(uuid, uuid[])
to service_role;

comment on function public.register_artifact(
  uuid, uuid, text, text, text, text, text, bigint, uuid[], text
) is
  'Machine-only idempotent canonical R2 artifact registration with server-derived tenancy and lineage.';
comment on function public.advance_fal_provider_attempt(text, text, text, uuid, bigint) is
  'Machine-only monotonic fal attempt, run-node, and aggregate run transition after artifact and settlement proof.';
comment on function public.get_export_context(uuid, uuid[]) is
  'Machine-only immutable approved artifact, provider, lineage, and zero-residual settlement snapshot for export.';

commit;
