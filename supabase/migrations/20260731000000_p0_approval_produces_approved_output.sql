begin;

-- Track E: approval produces approved_output, so create_export can finally succeed.
--
-- get_export_context requires artifact_kind = 'approved_output' and NOTHING in the system ever
-- produced one - the last of the six original execution-engine defects. Approval promotes the
-- provider_output row IN PLACE rather than copying bytes: content_hash is preserved (it is the
-- artifact's identity and the export manifest's integrity basis), provenance already lives in
-- provider_jobs and artifact_lineage, and a byte copy would double R2 storage for nothing.
--
-- The WCAG gate requires user-editable descriptive text before approval/export, and there was no
-- column for it; accessibility_description lands here for that reason and is REQUIRED at approval
-- time per artifact.

alter table public.artifacts
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists accessibility_description text
    check (accessibility_description is null
      or char_length(accessibility_description) between 1 and 2000);

-- An approved_output must carry its approval provenance; every other kind must not.
alter table public.artifacts
  add constraint artifacts_approval_provenance check (
    (artifact_kind = 'approved_output') = (approved_by is not null and approved_at is not null)
  ) not valid;
alter table public.artifacts validate constraint artifacts_approval_provenance;


-- Caller-scoped: runs as the authenticated user through PostgREST, so RLS-equivalent checks are
-- done inline (auth.uid() + workspace ownership) exactly like create_quote and start_run_barrier.
-- NOT a machine function; the machine never approves on a customer's behalf.
create or replace function public.approve_run_artifacts(
  p_run_id uuid,
  p_approvals jsonb,
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
  v_reservation public.cost_reservations%rowtype;
  v_entry jsonb;
  v_artifact_id uuid;
  v_description text;
  v_approved integer := 0;
  v_replayed integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_artifact public.artifacts%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_run_id is null
    or p_approvals is null or jsonb_typeof(p_approvals) <> 'array'
    or jsonb_array_length(p_approvals) not between 1 and 100
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_run
  from public.runs
  where id = p_run_id
  for update;

  if not found or not app_private.is_workspace_owner(v_run.workspace_id) then
    -- Same shape for missing and forbidden: do not reveal which.
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- Approval is a judgment about produced work; it needs the run to be settled, not merely started.
  -- Same precondition family as get_export_context, checked here too so an approval cannot exist
  -- for a run whose money is still moving.
  select * into v_reservation
  from public.cost_reservations
  where workspace_id = v_run.workspace_id and run_id = v_run.id;

  if v_run.status not in ('succeeded', 'partial_succeeded')
    or v_reservation.amount_micros
      - v_reservation.captured_micros
      - v_reservation.released_micros <> 0 then
    raise exception using errcode = '23514', message = 'RUN_NOT_APPROVABLE';
  end if;

  for v_entry in select value from jsonb_array_elements(p_approvals)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or not (v_entry ? 'artifact_id')
      or not (v_entry ? 'accessibility_description') then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    v_artifact_id := (v_entry ->> 'artifact_id')::uuid;
    v_description := v_entry ->> 'accessibility_description';
    if v_description is null or char_length(v_description) not between 1 and 2000 then
      -- The WCAG gate: descriptive text is required, not optional, at the approval boundary.
      raise exception using errcode = '22023', message = 'ACCESSIBILITY_DESCRIPTION_REQUIRED';
    end if;

    select * into v_artifact
    from public.artifacts
    where workspace_id = v_run.workspace_id
      and run_id = v_run.id
      and id = v_artifact_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'NOT_FOUND';
    end if;

    if v_artifact.artifact_kind = 'approved_output' then
      -- Idempotent replay of an approval that already happened. The description is NOT updated on
      -- replay: the recorded approval is the record.
      v_replayed := v_replayed + 1;
    elsif v_artifact.artifact_kind = 'provider_output'
      and v_artifact.status = 'available'
      and v_artifact.content_hash is not null then
      update public.artifacts
      set artifact_kind = 'approved_output',
          approved_by = v_actor_id,
          approved_at = statement_timestamp(),
          accessibility_description = v_description,
          updated_at = statement_timestamp()
      where id = v_artifact.id;
      v_approved := v_approved + 1;
    else
      raise exception using errcode = '23514', message = 'ARTIFACT_NOT_APPROVABLE';
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'artifact_id', v_artifact_id,
      'artifact_kind', 'approved_output'
    ));
  end loop;

  insert into public.audit_events (
    workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details
  ) values (
    v_run.workspace_id, 'user', v_actor_id, 'artifacts.approved', 'run', v_run.id, p_request_id,
    jsonb_build_object('approved', v_approved, 'replayed', v_replayed)
  );

  return jsonb_build_object(
    'run_id', v_run.id,
    'approved', v_approved,
    'replayed', v_replayed,
    'artifacts', v_results
  );
end;
$fn$;

-- Caller-scoped like create_quote: authenticated executes it, machine roles do not need it.
revoke all on function public.approve_run_artifacts(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_run_artifacts(uuid, jsonb, text) to authenticated;


-- register_artifact is create-or-replace over the SAME signature, so its existing service_role
-- grant survives - no drop, no grant loss (the 00021 regression suite asserts it regardless).

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
    -- 'approved_output' is deliberately absent: approval (approve_run_artifacts) is the only
    -- path to it, and it promotes the existing row in place rather than registering a new one.
    or p_artifact_kind not in ('input', 'provider_output', 'export')
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
    and (public.artifacts.artifact_kind = excluded.artifact_kind
      or (public.artifacts.artifact_kind = 'approved_output'
        and excluded.artifact_kind = 'provider_output'))
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
        -- 'approved_output' is admitted alongside 'provider_output' because approval promotes
        -- the SAME ROW in place (approve_run_artifacts). A fal webhook redelivered after the
        -- customer approved would otherwise fail this proof forever: the artifact still exists,
        -- the capture still exists, but the kind moved - and the 503 the failure produces makes
        -- the provider redeliver again, indefinitely, against money that was already settled.
        and artifact_kind in ('provider_output', 'approved_output')
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

commit;
