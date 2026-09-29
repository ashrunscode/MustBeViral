begin;

-- Buyer packshots attach before a run exists. register_artifact cannot do that: it requires
-- p_run_id. artifacts.run_id is already nullable. This pair creates a pending input on a project
-- (caller-scoped) and marks it available after the Worker has written the exact bytes (machine).

create or replace function public.create_pending_input_artifact(
  p_project_id uuid,
  p_mime_type text,
  p_byte_size bigint,
  p_content_hash text,
  p_purpose text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_actor_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_existing public.artifacts%rowtype;
  v_artifact_id uuid;
  v_object_key text;
begin
  if v_actor_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_project_id is null
    or p_mime_type is null
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size is null
    or p_byte_size < 1
    or p_byte_size > 12582912
    or p_content_hash is null
    or p_content_hash !~ '^[0-9a-f]{64}$'
    or p_purpose is null
    or p_purpose <> 'packshot'
    or p_request_id is null
    or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for share;

  if not found or not app_private.is_workspace_owner(v_project.workspace_id) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_existing
  from public.artifacts
  where workspace_id = v_project.workspace_id
    and project_id = v_project.id
    and artifact_kind = 'input'
    and content_hash = p_content_hash
  order by created_at asc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'artifact_id', v_existing.id,
      'workspace_id', v_existing.workspace_id,
      'project_id', v_existing.project_id,
      'object_key', v_existing.object_key,
      'status', v_existing.status,
      'mime_type', v_existing.mime_type,
      'byte_size', v_existing.byte_size,
      'content_hash', v_existing.content_hash,
      'replayed', true
    );
  end if;

  v_artifact_id := gen_random_uuid();
  v_object_key :=
    'workspaces/'
    || v_project.workspace_id::text
    || '/projects/'
    || v_project.id::text
    || '/inputs/'
    || v_artifact_id::text;

  insert into public.artifacts (
    id,
    workspace_id,
    project_id,
    artifact_kind,
    status,
    object_key,
    content_hash,
    mime_type,
    byte_size,
    rights_attestation
  ) values (
    v_artifact_id,
    v_project.workspace_id,
    v_project.id,
    'input',
    'pending',
    v_object_key,
    p_content_hash,
    p_mime_type,
    p_byte_size,
    jsonb_build_object('purpose', p_purpose, 'request_id', p_request_id)
  );

  return jsonb_build_object(
    'artifact_id', v_artifact_id,
    'workspace_id', v_project.workspace_id,
    'project_id', v_project.id,
    'object_key', v_object_key,
    'status', 'pending',
    'mime_type', p_mime_type,
    'byte_size', p_byte_size,
    'content_hash', p_content_hash,
    'replayed', false
  );
end;
$fn$;

create or replace function public.finalize_input_artifact(
  p_artifact_id uuid,
  p_content_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_artifact public.artifacts%rowtype;
begin
  if p_artifact_id is null
    or p_content_hash is null
    or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  select * into v_artifact
  from public.artifacts
  where id = p_artifact_id
  for update;

  if not found
    or v_artifact.artifact_kind <> 'input'
    or v_artifact.content_hash is distinct from p_content_hash then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_artifact.status = 'available' then
    return jsonb_build_object(
      'artifact_id', v_artifact.id,
      'status', v_artifact.status,
      'replayed', true
    );
  end if;

  if v_artifact.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;

  update public.artifacts
  set status = 'available',
      updated_at = statement_timestamp()
  where id = v_artifact.id;

  return jsonb_build_object(
    'artifact_id', v_artifact.id,
    'status', 'available',
    'replayed', false
  );
end;
$fn$;

revoke all on function public.create_pending_input_artifact(uuid, text, bigint, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_pending_input_artifact(uuid, text, bigint, text, text, text)
  to authenticated;

revoke all on function public.finalize_input_artifact(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_input_artifact(uuid, text)
  to service_role;

comment on function public.create_pending_input_artifact(uuid, text, bigint, text, text, text) is
  'Caller-scoped insert of a pending input artifact on a project the actor owns. Same hash replays.';

comment on function public.finalize_input_artifact(uuid, text) is
  'Machine-only mark of a pending input artifact available after the Worker wrote the pinned bytes.';

commit;
