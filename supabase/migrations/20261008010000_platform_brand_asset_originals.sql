begin;

-- W3-002 asset originals and rights. Extend the existing artifact store (DATA_AUTH_AND_TENANCY):
-- a brand original is an artifact without a project. Brand-scoped metadata and rights are new,
-- forced-RLS tables. Clients never write them directly; user commands check platform_can and the
-- Core machine path verifies bytes before an original can be used.

alter table public.artifacts drop constraint artifacts_artifact_kind_check;
alter table public.artifacts add constraint artifacts_artifact_kind_check check (
  artifact_kind in ('input', 'provider_output', 'approved_output', 'export', 'brand_original'));
alter table public.artifacts alter column project_id drop not null;
alter table public.artifacts add constraint artifacts_brand_original_has_no_project check (
  (artifact_kind = 'brand_original') = (project_id is null)) not valid;
alter table public.artifacts validate constraint artifacts_brand_original_has_no_project;

-- The existing member read path signs previews for any visible artifact without a rights check.
-- Brand originals are reachable only through the platform_asset_* functions below.
drop policy artifacts_select_member on public.artifacts;
create policy artifacts_select_member on public.artifacts for select to authenticated
  using ((select app_private.is_workspace_member(workspace_id)) and artifact_kind <> 'brand_original');

create table public.asset_rights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  basis text not null check (basis in ('owner_created', 'commissioned', 'client_supplied', 'licensed')),
  permitted_uses text[] not null check (
    cardinality(permitted_uses) between 1 and 5
    and permitted_uses <@ array['organic_social', 'paid_ads', 'website', 'print', 'internal_review']),
  identifiable_people text not null check (identifiable_people in ('none', 'released', 'unreleased')),
  release_reference text check (release_reference is null or char_length(release_reference) between 1 and 500),
  expires_at timestamptz,
  note text not null default '' check (char_length(note) <= 1000),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) between 1 and 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, brand_id, id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  check ((identifiable_people = 'released') = (release_reference is not null)),
  check ((revoked_at is null) = (revoked_by is null) and (revoked_at is null) = (revocation_reason is null))
);
comment on table public.asset_rights is
  'Immutable usage-rights basis for brand originals. Only revocation may be recorded later.';
create index asset_rights_page on public.asset_rights (workspace_id, brand_id, created_at, id);
create index asset_rights_created_by_fk on public.asset_rights (created_by);
create index asset_rights_revoked_by_fk on public.asset_rights (revoked_by);

create table public.asset_metadata (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  artifact_id uuid not null,
  rights_id uuid not null,
  purpose text not null check (purpose in ('photo', 'logo', 'document', 'video')),
  filename text not null check (char_length(filename) between 1 and 200),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  width_px integer check (width_px is null or width_px between 1 and 20000),
  height_px integer check (height_px is null or height_px between 1 and 20000),
  duration_ms integer check (duration_ms is null or duration_ms between 1 and 3600000),
  verified_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (artifact_id),
  unique (workspace_id, brand_id, content_sha256),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, artifact_id) references public.artifacts(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id, rights_id)
    references public.asset_rights(workspace_id, brand_id, id) on delete restrict,
  check ((width_px is null) = (height_px is null)),
  check (verified_at is not null or (width_px is null and duration_ms is null)),
  check (purpose <> 'video' or verified_at is null or duration_ms is not null),
  check (purpose <> 'photo' or verified_at is null or width_px is not null)
);
comment on table public.asset_metadata is
  'Brand-scoped metadata for brand_original artifacts. Bytes and verification status live on artifacts.';
create index asset_metadata_page on public.asset_metadata (workspace_id, brand_id, created_at, id);
create index asset_metadata_rights on public.asset_metadata (workspace_id, brand_id, rights_id);
create index asset_metadata_artifact_fk on public.asset_metadata (workspace_id, artifact_id);
create index asset_metadata_created_by_fk on public.asset_metadata (created_by);

create function app_private.protect_asset_rights()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if old.revoked_at is not null
    or (to_jsonb(new) - array['revoked_at', 'revoked_by', 'revocation_reason'])
      is distinct from (to_jsonb(old) - array['revoked_at', 'revoked_by', 'revocation_reason']) then
    raise exception using errcode = '55000', message = 'ASSET_RIGHTS_IMMUTABLE';
  end if;
  return new;
end;
$$;

create function app_private.protect_asset_metadata()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if (to_jsonb(new) - array['rights_id', 'width_px', 'height_px', 'duration_ms', 'verified_at', 'version', 'updated_at'])
     is distinct from (to_jsonb(old) - array['rights_id', 'width_px', 'height_px', 'duration_ms', 'verified_at', 'version', 'updated_at'])
    or (old.verified_at is not null and (
      new.verified_at is distinct from old.verified_at
      or new.width_px is distinct from old.width_px
      or new.height_px is distinct from old.height_px
      or new.duration_ms is distinct from old.duration_ms)) then
    raise exception using errcode = '55000', message = 'ASSET_METADATA_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_asset_rights(), app_private.protect_asset_metadata()
  from public, anon, authenticated, service_role;

create trigger protect_asset_rights before update on public.asset_rights
  for each row execute function app_private.protect_asset_rights();
create trigger immutable_asset_rights_delete before delete on public.asset_rights
  for each row execute function app_private.reject_immutable_mutation();
create trigger protect_asset_metadata before update on public.asset_metadata
  for each row execute function app_private.protect_asset_metadata();
create trigger immutable_asset_metadata_delete before delete on public.asset_metadata
  for each row execute function app_private.reject_immutable_mutation();

do $$ declare t text; begin
  foreach t in array array['asset_rights', 'asset_metadata'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
create policy asset_rights_read on public.asset_rights for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy asset_metadata_read on public.asset_metadata for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));

create function app_private.asset_rights_current(p_rights public.asset_rights)
returns boolean language sql stable set search_path = pg_catalog as $$
  select p_rights.id is not null and p_rights.revoked_at is null
    and (p_rights.expires_at is null or p_rights.expires_at > statement_timestamp());
$$;

create function app_private.asset_rights_json(p_rights public.asset_rights)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_rights.id, 'workspace_id', p_rights.workspace_id, 'brand_id', p_rights.brand_id,
    'basis', p_rights.basis, 'permitted_uses', to_jsonb(p_rights.permitted_uses),
    'identifiable_people', p_rights.identifiable_people, 'release_reference', p_rights.release_reference,
    'expires_at', p_rights.expires_at, 'note', p_rights.note, 'revoked_at', p_rights.revoked_at,
    'revocation_reason', p_rights.revocation_reason, 'current', app_private.asset_rights_current(p_rights),
    'created_at', p_rights.created_at);
$$;

create function app_private.brand_asset_json(p_meta public.asset_metadata)
returns jsonb language plpgsql stable set search_path = pg_catalog as $$
declare art public.artifacts%rowtype; rights public.asset_rights%rowtype; usable_reason text;
begin
  select * into art from public.artifacts where workspace_id = p_meta.workspace_id and id = p_meta.artifact_id;
  select * into rights from public.asset_rights
    where workspace_id = p_meta.workspace_id and brand_id = p_meta.brand_id and id = p_meta.rights_id;
  usable_reason := case
    when art.status <> 'available' then 'BYTES_NOT_VERIFIED'
    when rights.revoked_at is not null then 'RIGHTS_REVOKED'
    when rights.expires_at is not null and rights.expires_at <= statement_timestamp() then 'RIGHTS_EXPIRED'
    when not exists(select 1 from public.brands b
      where b.workspace_id = p_meta.workspace_id and b.id = p_meta.brand_id and b.status = 'active') then 'BRAND_ARCHIVED'
    else null end;
  return jsonb_build_object(
    'id', p_meta.id, 'workspace_id', p_meta.workspace_id, 'brand_id', p_meta.brand_id,
    'artifact_id', p_meta.artifact_id, 'purpose', p_meta.purpose, 'filename', p_meta.filename,
    'mime_type', art.mime_type, 'byte_size', art.byte_size, 'content_sha256', p_meta.content_sha256,
    'width_px', p_meta.width_px, 'height_px', p_meta.height_px, 'duration_ms', p_meta.duration_ms,
    'upload_status', art.status, 'verified_at', p_meta.verified_at, 'rights_id', p_meta.rights_id,
    'usable', usable_reason is null, 'unusable_reason', usable_reason, 'version', p_meta.version,
    'created_at', p_meta.created_at);
end;
$$;
revoke all on function app_private.asset_rights_current(public.asset_rights),
  app_private.asset_rights_json(public.asset_rights), app_private.brand_asset_json(public.asset_metadata)
  from public, anon, authenticated, service_role;

create function app_private.platform_asset_validate(p_input jsonb, p_required text[], p_optional text[] default '{}')
returns void language plpgsql set search_path = pg_catalog as $$
declare k text; v jsonb; allowed text[] := p_required || p_optional;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' or octet_length(p_input::text) > 16384
    or not p_input ?& p_required then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  for k, v in select * from jsonb_each(p_input) loop
    if not k = any(allowed) or v = 'null'::jsonb then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    if k like '%\_id' escape '\' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('expected_version', 'limit', 'byte_size') then
      if jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if (k = 'expected_version' and (v::text)::numeric not between 1 and 2147483647)
        or (k = 'limit' and (v::text)::numeric not between 1 and 100)
        or (k = 'byte_size' and (v::text)::numeric not between 1 and 524288000) then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'permitted_uses' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) not between 1 and 5
        or exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string')
        or (select count(distinct e) from jsonb_array_elements_text(v) e) <> jsonb_array_length(v) then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'expires_at' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      begin
        perform (p_input->>k)::timestamptz;
      exception when others then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end;
    elsif k in ('filename', 'note', 'reason', 'release_reference') then
      -- Filenames reach Content-Disposition later: no control characters or bidi overrides.
      if jsonb_typeof(v) <> 'string'
        or (k <> 'note' and (p_input->>k) ~ '[[:cntrl:]]')
        or (k = 'note' and translate(p_input->>k, E'\n\t', '') ~ '[[:cntrl:]]')
        or (p_input->>k) ~ ('[' || chr(8234) || '-' || chr(8238) || chr(8294) || '-' || chr(8297) || ']')
        or (k = 'filename' and char_length(p_input->>k) not between 1 and 200) then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'purpose' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) not in ('photo', 'logo', 'document', 'video') then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'content_sha256' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'cursor' then
      if jsonb_typeof(v) <> 'string' or char_length(p_input->>k) not between 1 and 2048
        or (p_input->>k) !~ '^[A-Za-z0-9_-]+$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif jsonb_typeof(v) <> 'string' then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
  end loop;
end;
$$;
revoke all on function app_private.platform_asset_validate(jsonb, text[], text[])
  from public, anon, authenticated, service_role;

create function app_private.brand_original_media_allowed(p_purpose text, p_mime text, p_bytes bigint)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select case p_purpose
    when 'photo' then p_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif') and p_bytes <= 52428800
    when 'logo' then p_mime in ('image/png', 'image/svg+xml', 'image/webp', 'image/jpeg') and p_bytes <= 10485760
    when 'document' then p_mime in ('application/pdf') and p_bytes <= 26214400
    when 'video' then p_mime in ('video/mp4', 'video/quicktime') and p_bytes <= 524288000
    else false end;
$$;
revoke all on function app_private.brand_original_media_allowed(text, text, bigint)
  from public, anon, authenticated, service_role;

create function public.platform_asset_command(p_operation text, p_input jsonb, p_idempotency_key text, p_request_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid(); ws uuid; br uuid; required text[]; optional text[] := '{}';
  payload_hash text; replay public.idempotency_records%rowtype; brand_status text;
  rights public.asset_rights%rowtype; meta public.asset_metadata%rowtype; art public.artifacts%rowtype;
  new_artifact uuid; result jsonb; entity uuid;
begin
  if actor is null then raise exception using errcode = '28000', message = 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  case p_operation
    when 'create_asset_rights' then
      required := array['workspace_id', 'brand_id', 'basis', 'permitted_uses', 'identifiable_people'];
      optional := array['release_reference', 'expires_at', 'note'];
    when 'revoke_asset_rights' then required := array['workspace_id', 'brand_id', 'rights_id', 'reason'];
    when 'begin_asset_upload' then
      required := array['workspace_id', 'brand_id', 'purpose', 'filename', 'mime_type', 'byte_size', 'content_sha256', 'rights_id'];
    when 'reassign_asset_rights' then
      required := array['workspace_id', 'brand_id', 'asset_id', 'rights_id', 'expected_version'];
    else raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end case;
  perform app_private.platform_asset_validate(p_input, required, optional);
  ws := (p_input->>'workspace_id')::uuid; br := (p_input->>'brand_id')::uuid;
  payload_hash := app_private.hash_canonical_json(p_input);
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || ws::text || ':' || p_operation || ':' || p_idempotency_key, 0));
  perform app_private.lock_platform_workspace(ws);
  select b.status into brand_status from public.brands b where b.workspace_id = ws and b.id = br;
  if brand_status is null or not app_private.platform_can(ws, br, 'brand:read') then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if brand_status <> 'active' then raise exception using errcode = 'P0001', message = 'RESOURCE_ARCHIVED'; end if;
  if not app_private.platform_can(ws, br, 'brand:write') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into replay from public.idempotency_records
    where actor_id = actor and workspace_id is not distinct from ws and operation = p_operation
      and idempotency_key = p_idempotency_key;
  if found then
    if replay.request_hash <> payload_hash then raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT'; end if;
    if p_operation <> 'begin_asset_upload' then return replay.response_payload; end if;
    -- An upload intent replays its current state so a verified original never asks for bytes again.
    select * into meta from public.asset_metadata
      where workspace_id = ws and brand_id = br and id = (replay.response_payload->'record'->>'id')::uuid;
    select * into art from public.artifacts where workspace_id = ws and id = meta.artifact_id;
    if meta.id is null or art.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
    return jsonb_build_object('record', app_private.brand_asset_json(meta),
      'object_key', art.object_key, 'upload_required', art.status = 'pending', 'replayed', true);
  end if;

  case p_operation
    when 'create_asset_rights' then
      if (p_input->>'identifiable_people') not in ('none', 'released', 'unreleased')
        or (p_input->>'basis') not in ('owner_created', 'commissioned', 'client_supplied', 'licensed')
        or ((p_input->>'identifiable_people') = 'released') <> (p_input ? 'release_reference')
        or (p_input ? 'expires_at' and (p_input->>'expires_at')::timestamptz <= statement_timestamp())
        or char_length(coalesce(p_input->>'release_reference', 'x')) not between 1 and 500
        or char_length(coalesce(p_input->>'note', '')) > 1000
        or exists(select 1 from jsonb_array_elements_text(p_input->'permitted_uses') u
          where u not in ('organic_social', 'paid_ads', 'website', 'print', 'internal_review')) then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      insert into public.asset_rights (workspace_id, brand_id, basis, permitted_uses, identifiable_people,
        release_reference, expires_at, note, created_by)
        values (ws, br, p_input->>'basis',
          array(select jsonb_array_elements_text(p_input->'permitted_uses')),
          p_input->>'identifiable_people', p_input->>'release_reference',
          (p_input->>'expires_at')::timestamptz, coalesce(p_input->>'note', ''), actor)
        returning * into rights;
      entity := rights.id;
      result := jsonb_build_object('record', app_private.asset_rights_json(rights));
    when 'revoke_asset_rights' then
      if char_length(p_input->>'reason') not between 1 and 500 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      select * into rights from public.asset_rights
        where workspace_id = ws and brand_id = br and id = (p_input->>'rights_id')::uuid for update;
      if rights.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if rights.revoked_at is not null then raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT'; end if;
      update public.asset_rights
        set revoked_at = statement_timestamp(), revoked_by = actor, revocation_reason = p_input->>'reason'
        where id = rights.id returning * into rights;
      entity := rights.id;
      result := jsonb_build_object('record', app_private.asset_rights_json(rights));
    when 'begin_asset_upload' then
      if not app_private.brand_original_media_allowed(p_input->>'purpose', p_input->>'mime_type', (p_input->>'byte_size')::bigint) then
        raise exception using errcode = '22023', message = 'MEDIA_UNSUPPORTED';
      end if;
      select * into rights from public.asset_rights
        where workspace_id = ws and brand_id = br and id = (p_input->>'rights_id')::uuid for share;
      if rights.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if not app_private.asset_rights_current(rights) then
        raise exception using errcode = 'P0001', message = 'RIGHTS_UNAVAILABLE';
      end if;
      select * into meta from public.asset_metadata
        where workspace_id = ws and brand_id = br and content_sha256 = p_input->>'content_sha256' for update;
      if meta.id is not null then
        select * into art from public.artifacts where workspace_id = ws and id = meta.artifact_id;
        if art.mime_type <> p_input->>'mime_type' or art.byte_size <> (p_input->>'byte_size')::bigint then
          raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
        end if;
        -- The same bytes keep one asset. Different rights or purpose are never applied silently;
        -- rights change only through reassign_asset_rights.
        if meta.rights_id <> rights.id or meta.purpose <> p_input->>'purpose' then
          raise exception using errcode = 'P0001', message = 'ASSET_EXISTS', detail = meta.id::text;
        end if;
        entity := meta.id;
        result := jsonb_build_object('record', app_private.brand_asset_json(meta),
          'object_key', art.object_key, 'upload_required', art.status = 'pending', 'replayed', true);
      else
        new_artifact := gen_random_uuid();
        insert into public.artifacts (id, workspace_id, project_id, artifact_kind, status, object_key, content_hash,
          mime_type, byte_size, rights_attestation)
          values (new_artifact, ws, null, 'brand_original', 'pending',
            'workspaces/' || ws::text || '/brands/' || br::text || '/originals/' || new_artifact::text,
            p_input->>'content_sha256', p_input->>'mime_type', (p_input->>'byte_size')::bigint,
            jsonb_build_object('initial_rights_id', rights.id, 'request_id', p_request_id))
          returning * into art;
        insert into public.asset_metadata (workspace_id, brand_id, artifact_id, rights_id, purpose, filename,
          content_sha256, created_by)
          values (ws, br, art.id, rights.id, p_input->>'purpose', p_input->>'filename', p_input->>'content_sha256', actor)
          returning * into meta;
        entity := meta.id;
        result := jsonb_build_object('record', app_private.brand_asset_json(meta),
          'object_key', art.object_key, 'upload_required', true, 'replayed', false);
      end if;
    when 'reassign_asset_rights' then
      select * into meta from public.asset_metadata
        where workspace_id = ws and brand_id = br and id = (p_input->>'asset_id')::uuid for update;
      if meta.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if meta.version <> (p_input->>'expected_version')::integer then
        raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
      end if;
      select * into rights from public.asset_rights
        where workspace_id = ws and brand_id = br and id = (p_input->>'rights_id')::uuid for share;
      if rights.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if not app_private.asset_rights_current(rights) then
        raise exception using errcode = 'P0001', message = 'RIGHTS_UNAVAILABLE';
      end if;
      update public.asset_metadata set rights_id = rights.id, version = version + 1, updated_at = clock_timestamp()
        where id = meta.id returning * into meta;
      entity := meta.id;
      result := jsonb_build_object('record', app_private.brand_asset_json(meta));
  end case;
  insert into public.idempotency_records (workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload)
    values (ws, actor, p_operation, p_idempotency_key, payload_hash, result);
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (ws, 'user', actor, 'platform.' || p_operation, 'platform_asset', entity, p_request_id, '{}');
  return result;
end;
$$;

create function public.platform_asset_query(p_operation text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  ws uuid; br uuid; required text[]; optional text[] := '{}'; meta public.asset_metadata%rowtype;
  rights public.asset_rights%rowtype; items jsonb := '[]'::jsonb; next_cursor text; scope jsonb;
  cursor_data jsonb; after_at timestamptz; after_id uuid; page_limit integer; n integer := 0; rec jsonb;
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'UNAUTHENTICATED'; end if;
  case p_operation
    when 'get_brand_asset' then required := array['workspace_id', 'brand_id', 'asset_id'];
    when 'list_brand_assets' then required := array['workspace_id', 'brand_id']; optional := array['limit', 'cursor'];
    when 'list_asset_rights' then required := array['workspace_id', 'brand_id']; optional := array['limit', 'cursor'];
    else raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end case;
  perform app_private.platform_asset_validate(p_input, required, optional);
  ws := (p_input->>'workspace_id')::uuid; br := (p_input->>'brand_id')::uuid;
  if not exists(select 1 from public.brands where workspace_id = ws and id = br)
    or not app_private.platform_can(ws, br, 'brand:read') then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if p_operation = 'get_brand_asset' then
    select * into meta from public.asset_metadata
      where workspace_id = ws and brand_id = br and id = (p_input->>'asset_id')::uuid;
    if meta.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
    return jsonb_build_object('record', app_private.brand_asset_json(meta));
  end if;
  page_limit := coalesce((p_input->>'limit')::integer, 20);
  scope := jsonb_build_object('operation', p_operation, 'actor', auth.uid(), 'input', p_input - array['limit', 'cursor']);
  if p_input ? 'cursor' then
    begin
      next_cursor := translate(p_input->>'cursor', '-_', '+/');
      cursor_data := convert_from(decode(next_cursor || repeat('=', (4 - length(next_cursor) % 4) % 4), 'base64'), 'UTF8')::jsonb;
      if jsonb_typeof(cursor_data) <> 'object' or not cursor_data ?& array['scope', 'at', 'id']
        or cursor_data - array['scope', 'at', 'id'] <> '{}'::jsonb or cursor_data->'scope' is distinct from scope then
        raise exception 'invalid cursor';
      end if;
      after_at := (cursor_data->>'at')::timestamptz; after_id := (cursor_data->>'id')::uuid;
    exception when others then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end;
  end if;
  next_cursor := null;
  if p_operation = 'list_brand_assets' then
    for rec in select app_private.brand_asset_json(m) from public.asset_metadata m
      where m.workspace_id = ws and m.brand_id = br
        and (after_at is null or (m.created_at, m.id) > (after_at, after_id))
      order by m.created_at, m.id limit page_limit + 1
    loop
      n := n + 1;
      if n <= page_limit then items := items || jsonb_build_array(rec); end if;
    end loop;
  else
    for rec in select app_private.asset_rights_json(r) from public.asset_rights r
      where r.workspace_id = ws and r.brand_id = br
        and (after_at is null or (r.created_at, r.id) > (after_at, after_id))
      order by r.created_at, r.id limit page_limit + 1
    loop
      n := n + 1;
      if n <= page_limit then items := items || jsonb_build_array(rec); end if;
    end loop;
  end if;
  if n > page_limit then
    rec := items -> (page_limit - 1);
    next_cursor := rtrim(translate(replace(encode(convert_to(jsonb_build_object(
      'scope', scope, 'at', rec->>'created_at', 'id', rec->>'id')::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
  end if;
  return jsonb_build_object('items', items, 'next_cursor', next_cursor);
end;
$$;

-- Machine path: Core streamed the bytes to the pinned private key and measured them. Core names the
-- authenticated user who uploaded the bytes; that actor's current brand write authority is
-- rechecked here under the portfolio lock order before the original can become usable.
create function public.finalize_brand_asset_upload(
  p_artifact_id uuid,
  p_content_sha256 text,
  p_byte_size bigint,
  p_mime_type text,
  p_actor_id uuid,
  p_width_px integer default null,
  p_height_px integer default null,
  p_duration_ms integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare art public.artifacts%rowtype; meta public.asset_metadata%rowtype; ws uuid;
begin
  if p_artifact_id is null or p_actor_id is null or p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size is null or p_byte_size < 1
    or p_mime_type is null or char_length(p_mime_type) not between 1 and 160
    or (p_width_px is null) <> (p_height_px is null)
    or (p_width_px is not null and (p_width_px not between 1 and 20000 or p_height_px not between 1 and 20000))
    or (p_duration_ms is not null and p_duration_ms not between 1 and 3600000) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  select workspace_id into ws from public.artifacts where id = p_artifact_id;
  if ws is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  perform app_private.lock_platform_workspace_for(p_actor_id, ws);
  select * into art from public.artifacts where workspace_id = ws and id = p_artifact_id for update;
  select * into meta from public.asset_metadata where workspace_id = ws and artifact_id = p_artifact_id for update;
  if art.id is null or meta.id is null or art.artifact_kind <> 'brand_original'
    or not app_private.platform_can_for(p_actor_id, meta.workspace_id, meta.brand_id, 'brand:write') then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if art.content_hash <> p_content_sha256 or art.byte_size <> p_byte_size or art.mime_type <> p_mime_type then
    raise exception using errcode = 'P0001', message = 'BYTES_MISMATCH';
  end if;
  if art.status = 'available' then
    return jsonb_build_object('record', app_private.brand_asset_json(meta), 'replayed', true);
  end if;
  if art.status <> 'pending' then raise exception using errcode = 'P0001', message = 'CONFLICT'; end if;
  if (meta.purpose in ('photo', 'logo') and art.mime_type <> 'image/svg+xml'
      and (p_width_px is null or p_duration_ms is not null))
    or (meta.purpose = 'logo' and art.mime_type = 'image/svg+xml' and p_duration_ms is not null)
    or (meta.purpose = 'video' and (p_duration_ms is null or p_width_px is null))
    or (meta.purpose = 'document' and (p_width_px is not null or p_duration_ms is not null)) then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  update public.artifacts set status = 'available' where id = art.id;
  update public.asset_metadata
    set width_px = p_width_px, height_px = p_height_px, duration_ms = p_duration_ms,
        verified_at = statement_timestamp(), updated_at = clock_timestamp()
    where id = meta.id returning * into meta;
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (meta.workspace_id, 'system', p_actor_id, 'platform.finalize_brand_asset_upload', 'platform_asset', meta.id,
      'finalize-' || meta.id::text, '{}');
  return jsonb_build_object('record', app_private.brand_asset_json(meta), 'replayed', false);
end;
$$;

revoke all on function public.platform_asset_command(text, jsonb, text, text),
  public.platform_asset_query(text, jsonb),
  public.finalize_brand_asset_upload(uuid, text, bigint, text, uuid, integer, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.platform_asset_command(text, jsonb, text, text),
  public.platform_asset_query(text, jsonb) to authenticated;
grant execute on function public.finalize_brand_asset_upload(uuid, text, bigint, text, uuid, integer, integer, integer)
  to service_role;

comment on function public.platform_asset_command(text, jsonb, text, text) is
  'User-scoped brand asset and rights commands: platform_can brand:write, idempotent, audited.';
comment on function public.platform_asset_query(text, jsonb) is
  'User-scoped brand asset and rights reads through platform_can brand:read with scoped cursors.';
comment on function public.finalize_brand_asset_upload(uuid, text, bigint, text, uuid, integer, integer, integer) is
  'Machine-only verification of a pending brand original after Core wrote and measured the pinned bytes.';

commit;
