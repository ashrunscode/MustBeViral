begin;

create table public.brand_source_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  kind text not null check (kind in ('website','document','manual')),
  status text not null check (status in ('queued','capturing','awaiting_bytes','captured','duplicate','rejected','failed')),
  request_url text not null default '' check (char_length(request_url) <= 2048),
  normalized_url text not null default '' check (char_length(normalized_url) <= 2048),
  filename text not null default '' check (char_length(filename) <= 200),
  media_type text not null default '' check (char_length(media_type) <= 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_owner text check (lease_owner is null or char_length(lease_owner) between 1 and 200),
  lease_expires_at timestamptz,
  failure_code text check (failure_code is null or failure_code in (
    'SOURCE_UNSAFE','SOURCE_UNSUPPORTED','SOURCE_MALFORMED','SOURCE_TOO_LARGE',
    'SOURCE_TIMEOUT','SOURCE_UNREACHABLE','SOURCE_INTERRUPTED','SOURCE_EGRESS_UNAVAILABLE')),
  source_id uuid,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  check (
    (status = 'capturing' and lease_owner is not null and lease_expires_at is not null)
    or (status <> 'capturing' and lease_owner is null and lease_expires_at is null)
  )
);
comment on table public.brand_source_jobs is
  'Durable website/document/manual capture jobs. HTTPS provenance is written only by the machine complete RPC.';
create index brand_source_jobs_page on public.brand_source_jobs (workspace_id, brand_id, created_at, id);
create index brand_source_jobs_lease on public.brand_source_jobs (status, lease_expires_at, id)
  where status in ('queued','capturing','awaiting_bytes');

create table public.brand_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  job_id uuid,
  kind text not null check (kind in ('website','document','manual')),
  method text not null check (method in ('https_get','document_upload','manual')),
  origin_url text not null default '' check (char_length(origin_url) <= 2048),
  final_url text not null default '' check (char_length(final_url) <= 2048),
  media_type text not null default '' check (char_length(media_type) <= 100),
  byte_size integer not null default 0 check (byte_size >= 0),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'),
  r2_key text check (r2_key is null or char_length(r2_key) between 1 and 500),
  http_status integer check (http_status is null or http_status between 0 and 599),
  redirect_hops jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, brand_id, job_id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, job_id) references public.brand_source_jobs(workspace_id, id) on delete restrict,
  check ((method = 'https_get' and kind = 'website' and origin_url <> '')
    or (method = 'document_upload' and kind = 'document')
    or (method = 'manual' and kind = 'manual' and r2_key is null and content_sha256 is null))
);
comment on table public.brand_sources is
  'Immutable captured evidence. HTTPS and R2 keys are machine-attested; manual rows are explicit operator provenance.';
create unique index brand_sources_digest on public.brand_sources (workspace_id, brand_id, content_sha256)
  where content_sha256 is not null;
create index brand_sources_page on public.brand_sources (workspace_id, brand_id, created_at, id);

alter table public.brand_source_jobs
  add constraint brand_source_jobs_source_fk
  foreign key (workspace_id, source_id) references public.brand_sources(workspace_id, id) on delete restrict;

create table public.brand_knowledge_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, brand_id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict
);
comment on table public.brand_knowledge_drafts is
  'Unapproved brand knowledge drafts. Distinct from operator onboarding input and from approved brand versions.';
create index brand_knowledge_drafts_updated on public.brand_knowledge_drafts (workspace_id, brand_id, updated_at);

create table public.brand_knowledge_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  draft_id uuid not null,
  source_id uuid not null,
  job_id uuid,
  field_key text not null check (field_key in (
    'page_title','meta_description','canonical_url','heading','visible_excerpt','jsonld_text','document_filename','unknown_gap')),
  value_text text check (value_text is null or char_length(value_text) <= 8000),
  status text not null check (status in ('observed','unknown','corrected','disputed')),
  excerpt text not null check (char_length(excerpt) <= 2000),
  locator text not null default '' check (char_length(locator) <= 500),
  method text not null check (method in (
    'html_title','meta_description','canonical_link','heading','visible_text','jsonld_text','document_text','manual')),
  captured_at timestamptz not null,
  supersedes_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id) references public.brand_knowledge_drafts(workspace_id, brand_id) on delete restrict,
  foreign key (workspace_id, source_id) references public.brand_sources(workspace_id, id) on delete restrict,
  foreign key (workspace_id, job_id) references public.brand_source_jobs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, supersedes_id) references public.brand_knowledge_candidates(workspace_id, id) on delete restrict,
  check ((status = 'unknown' and value_text is null) or (status <> 'unknown' and value_text is not null))
);
comment on table public.brand_knowledge_candidates is
  'Append-only factual candidates with mandatory source, capture time, excerpt and method. Current items are rows with no successor.';
create index brand_knowledge_candidates_page on public.brand_knowledge_candidates (workspace_id, brand_id, created_at, id);
create index brand_knowledge_candidates_supersedes on public.brand_knowledge_candidates (workspace_id, supersedes_id);

create function app_private.protect_source_job()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if (to_jsonb(new) - array['status','lease_owner','lease_expires_at','failure_code','source_id','attempt_count','version','updated_at'])
     is distinct from (to_jsonb(old) - array['status','lease_owner','lease_expires_at','failure_code','source_id','attempt_count','version','updated_at']) then
    raise exception using errcode = '55000', message = 'SOURCE_JOB_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;
create function app_private.protect_knowledge_draft()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if (to_jsonb(new) - array['version','updated_by','updated_at'])
     is distinct from (to_jsonb(old) - array['version','updated_by','updated_at']) then
    raise exception using errcode = '55000', message = 'KNOWLEDGE_DRAFT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_source_job(), app_private.protect_knowledge_draft()
  from public, anon, authenticated, service_role;

do $$ declare t text; begin
  foreach t in array array['brand_source_jobs','brand_sources','brand_knowledge_drafts','brand_knowledge_candidates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
create trigger protect_source_job before update on public.brand_source_jobs
  for each row execute function app_private.protect_source_job();
create trigger immutable_brand_sources before update or delete on public.brand_sources
  for each row execute function app_private.reject_immutable_mutation();
create trigger protect_knowledge_draft before update on public.brand_knowledge_drafts
  for each row execute function app_private.protect_knowledge_draft();
create trigger immutable_knowledge_candidates before update or delete on public.brand_knowledge_candidates
  for each row execute function app_private.reject_immutable_mutation();
create policy source_job_read on public.brand_source_jobs for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy source_read on public.brand_sources for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy knowledge_draft_read on public.brand_knowledge_drafts for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy knowledge_candidate_read on public.brand_knowledge_candidates for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));

create function app_private.platform_can_for(p_user_id uuid, p_workspace_id uuid, p_brand_id uuid, p_action text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select p_user_id is not null
    and p_action = any(array['brand:read','brand:write','location:read','location:write'])
    and exists(select 1 from public.workspaces w where w.id = p_workspace_id and w.status = 'active')
    and (
      p_action like '%:read'
      or exists (
        select 1 from public.brands b
        where b.workspace_id = p_workspace_id and b.id = p_brand_id and b.status = 'active')
    )
    and (
      exists(select 1 from public.workspace_memberships m
        where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.status = 'active' and m.role = 'owner')
      or exists(
        select 1 from public.workspace_access_grants g
        join public.studio_memberships sm on sm.studio_id = g.studio_id
        where g.workspace_id = p_workspace_id and (g.brand_id is null or g.brand_id = p_brand_id)
          and p_action = any(g.actions) and app_private.platform_grant_current(g.id)
          and sm.user_id = p_user_id and sm.status = 'active'
          and (p_action like '%:read' or sm.role in ('owner','editor'))));
$$;
revoke all on function app_private.platform_can_for(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

create function app_private.lock_platform_workspace_for(p_user_id uuid, p_workspace_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform s.id from public.studios s
    where exists (
      select 1 from public.studio_memberships m
      where m.studio_id = s.id and m.user_id = p_user_id and m.status = 'active')
    order by s.id for share;
  perform id from public.workspaces where id = p_workspace_id for update;
end;
$$;
revoke all on function app_private.lock_platform_workspace_for(uuid, uuid)
  from public, anon, authenticated, service_role;

create function app_private.public_https_destination(p_url text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select p_url is not null
    and char_length(p_url) between 8 and 2048
    and p_url ~* '^https://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$'
    and p_url !~* '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[::1\]|\[::ffff:7f)';
$$;
revoke all on function app_private.public_https_destination(text)
  from public, anon, authenticated, service_role;

create function app_private.platform_knowledge_validate(p_input jsonb, p_required text[], p_optional text[] default '{}')
returns void language plpgsql set search_path = pg_catalog as $$
declare k text; v jsonb;
  allowed text[] := p_required || p_optional;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' or octet_length(p_input::text) > 65536
    or not p_input ?& p_required then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  for k, v in select * from jsonb_each(p_input) loop
    if not k = any(allowed) then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
    if k = 'value_text' and v = 'null'::jsonb then continue; end if;
    if v = 'null'::jsonb then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
    if k like '%\_id' escape '\' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'expected_version' then
      if jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' or (v::text)::numeric not between 1 and 2147483647 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('limit') then
      if jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' or (v::text)::numeric not between 1 and 100 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'cursor' then
      if jsonb_typeof(v) <> 'string' or char_length(p_input->>k) not between 1 and 2048
        or (p_input->>k) !~ '^[A-Za-z0-9_-]+$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'url' then
      if jsonb_typeof(v) <> 'string' or not app_private.public_https_destination(p_input->>k) then
        raise exception using errcode = '22023', message = 'SOURCE_UNSAFE';
      end if;
    elsif k = 'filename' then
      if jsonb_typeof(v) <> 'string' or char_length(p_input->>k) not between 1 and 200 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'media_type' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) not in ('text/plain','text/markdown','text/html') then
        raise exception using errcode = '22023', message = 'SOURCE_UNSUPPORTED';
      end if;
    elsif k = 'text_content' then
      if jsonb_typeof(v) <> 'string' or char_length(p_input->>k) not between 1 and 32768 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('excerpt','locator','value_text') then
      if jsonb_typeof(v) <> 'string' then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
      if k = 'excerpt' and char_length(p_input->>k) not between 1 and 2000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'locator' and char_length(p_input->>k) > 500 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'value_text' and char_length(p_input->>k) > 4000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function app_private.platform_knowledge_validate(jsonb, text[], text[])
  from public, anon, authenticated, service_role;
grant execute on function app_private.platform_knowledge_validate(jsonb, text[], text[]) to authenticated;

create function app_private.brand_source_job_json(p_job public.brand_source_jobs)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_job.id, 'workspace_id', p_job.workspace_id, 'brand_id', p_job.brand_id,
    'kind', p_job.kind, 'status', p_job.status, 'request_url', p_job.request_url,
    'normalized_url', p_job.normalized_url, 'filename', p_job.filename, 'media_type', p_job.media_type,
    'attempt_count', p_job.attempt_count, 'lease_expires_at', p_job.lease_expires_at,
    'failure_code', p_job.failure_code, 'source_id', p_job.source_id, 'version', p_job.version,
    'created_by', p_job.created_by, 'created_at', p_job.created_at, 'updated_at', p_job.updated_at);
$$;
create function app_private.brand_source_json(p_source public.brand_sources)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_source.id, 'workspace_id', p_source.workspace_id, 'brand_id', p_source.brand_id,
    'job_id', p_source.job_id, 'kind', p_source.kind, 'method', p_source.method,
    'origin_url', p_source.origin_url, 'final_url', p_source.final_url, 'media_type', p_source.media_type,
    'byte_size', p_source.byte_size, 'content_sha256', p_source.content_sha256,
    'http_status', p_source.http_status, 'captured_at', p_source.captured_at,
    'created_by', p_source.created_by, 'created_at', p_source.created_at);
$$;
create function app_private.knowledge_candidate_json(p_row public.brand_knowledge_candidates)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_row.id, 'workspace_id', p_row.workspace_id, 'brand_id', p_row.brand_id,
    'draft_id', p_row.draft_id, 'source_id', p_row.source_id, 'job_id', p_row.job_id,
    'field_key', p_row.field_key, 'value_text', p_row.value_text, 'status', p_row.status,
    'excerpt', p_row.excerpt, 'locator', p_row.locator, 'method', p_row.method,
    'captured_at', p_row.captured_at, 'supersedes_id', p_row.supersedes_id,
    'created_by', p_row.created_by, 'created_at', p_row.created_at);
$$;
revoke all on function app_private.brand_source_job_json(public.brand_source_jobs),
  app_private.brand_source_json(public.brand_sources),
  app_private.knowledge_candidate_json(public.brand_knowledge_candidates)
  from public, anon, authenticated, service_role;

create function app_private.knowledge_draft_view(p_workspace_id uuid, p_brand_id uuid, p_limit integer default 50, p_cursor text default null)
returns jsonb language plpgsql stable set search_path = pg_catalog as $$
declare
  draft public.brand_knowledge_drafts%rowtype;
  items jsonb := '[]'::jsonb;
  rec jsonb;
  n integer := 0;
  page_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
  next_cursor text := null;
  after_at timestamptz;
  after_id uuid;
  cursor_data jsonb;
  padded text;
begin
  select * into draft from public.brand_knowledge_drafts
    where workspace_id = p_workspace_id and brand_id = p_brand_id;
  if p_cursor is not null then
    begin
      padded := translate(p_cursor, '-_', '+/');
      cursor_data := convert_from(decode(padded || repeat('=', (4 - length(padded) % 4) % 4), 'base64'), 'UTF8')::jsonb;
      after_at := (cursor_data->>'at')::timestamptz;
      after_id := (cursor_data->>'id')::uuid;
    exception when others then raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end;
  end if;
  for rec in
    select app_private.knowledge_candidate_json(c)
    from public.brand_knowledge_candidates c
    where c.workspace_id = p_workspace_id and c.brand_id = p_brand_id
      and not exists (
        select 1 from public.brand_knowledge_candidates later
        where later.workspace_id = c.workspace_id and later.supersedes_id = c.id)
      and (after_at is null or (c.created_at, c.id) > (after_at, after_id))
    order by c.created_at, c.id
    limit page_limit + 1
  loop
    n := n + 1;
    if n <= page_limit then items := items || jsonb_build_array(rec); end if;
  end loop;
  if n > page_limit then
    rec := items -> (page_limit - 1);
    next_cursor := rtrim(translate(replace(encode(convert_to(jsonb_build_object('at', rec->>'created_at', 'id', rec->>'id')::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
  end if;
  return jsonb_build_object(
    'record', case when draft.id is null then null else to_jsonb(draft) end,
    'current_candidates', items,
    'next_cursor', next_cursor);
end;
$$;
revoke all on function app_private.knowledge_draft_view(uuid, uuid, integer, text)
  from public, anon, authenticated, service_role;

create function app_private.expire_source_job(p_job_id uuid)
returns public.brand_source_jobs language plpgsql set search_path = pg_catalog as $$
declare job public.brand_source_jobs%rowtype;
begin
  select * into job from public.brand_source_jobs where id = p_job_id for update;
  if job.id is null then return job; end if;
  if job.status = 'capturing' and job.lease_expires_at is not null
    and job.lease_expires_at <= statement_timestamp() then
    if job.attempt_count >= 3 then
      update public.brand_source_jobs
        set status = 'failed', failure_code = 'SOURCE_INTERRUPTED', lease_owner = null,
            lease_expires_at = null, version = version + 1, updated_at = clock_timestamp()
        where id = p_job_id returning * into job;
    else
      update public.brand_source_jobs
        set status = 'queued', lease_owner = null, lease_expires_at = null,
            version = version + 1, updated_at = clock_timestamp()
        where id = p_job_id returning * into job;
    end if;
  end if;
  return job;
end;
$$;
create function app_private.lease_source_job(p_job_id uuid, p_request_id text)
returns public.brand_source_jobs language plpgsql set search_path = pg_catalog as $$
declare job public.brand_source_jobs%rowtype;
begin
  job := app_private.expire_source_job(p_job_id);
  if job.status = 'failed'
    and job.attempt_count < 3
    and job.failure_code in ('SOURCE_TIMEOUT','SOURCE_UNREACHABLE','SOURCE_INTERRUPTED','SOURCE_EGRESS_UNAVAILABLE') then
    update public.brand_source_jobs
      set status = 'queued', failure_code = null, version = version + 1, updated_at = clock_timestamp()
      where id = p_job_id returning * into job;
  end if;
  if job.status <> 'queued' and job.status <> 'awaiting_bytes' then
    return job;
  end if;
  update public.brand_source_jobs
    set status = 'capturing', attempt_count = attempt_count + 1, lease_owner = p_request_id,
        lease_expires_at = statement_timestamp() + interval '20 seconds',
        version = version + 1, updated_at = clock_timestamp()
    where id = p_job_id returning * into job;
  return job;
end;
$$;
revoke all on function app_private.expire_source_job(uuid), app_private.lease_source_job(uuid, text)
  from public, anon, authenticated, service_role;

create function app_private.source_attempt_lease_matches(
  p_job public.brand_source_jobs, p_request_id text, p_expected_attempt_count integer)
returns boolean language sql stable set search_path = pg_catalog as $$
  select p_job.status = 'capturing'
    and p_job.lease_owner is not distinct from p_request_id
    and p_job.attempt_count is not distinct from p_expected_attempt_count
    and p_job.lease_expires_at is not null
    and p_job.lease_expires_at > statement_timestamp();
$$;
revoke all on function app_private.source_attempt_lease_matches(public.brand_source_jobs, text, integer)
  from public, anon, authenticated, service_role;

create function app_private.ensure_knowledge_draft(p_workspace_id uuid, p_brand_id uuid, p_actor uuid)
returns public.brand_knowledge_drafts language plpgsql set search_path = pg_catalog as $$
declare draft public.brand_knowledge_drafts%rowtype;
begin
  insert into public.brand_knowledge_drafts (workspace_id, brand_id, created_by, updated_by)
    values (p_workspace_id, p_brand_id, p_actor, p_actor)
    on conflict (workspace_id, brand_id) do update
      set version = brand_knowledge_drafts.version + 1, updated_by = p_actor, updated_at = clock_timestamp()
    returning * into draft;
  return draft;
end;
$$;
revoke all on function app_private.ensure_knowledge_draft(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create function public.platform_knowledge_command(p_operation text, p_input jsonb, p_idempotency_key text, p_request_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid(); ws uuid; br uuid; required text[]; optional text[] := '{}';
  payload_hash text; replay public.idempotency_records%rowtype; job public.brand_source_jobs%rowtype;
  brand_data jsonb; draft public.brand_knowledge_drafts%rowtype; source public.brand_sources%rowtype;
  candidate public.brand_knowledge_candidates%rowtype; pending boolean := false; result jsonb;
begin
  if actor is null then raise exception using errcode = '28000', message = 'UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  case p_operation
    when 'start_website_capture' then required := array['workspace_id','brand_id','url'];
    when 'start_document_capture' then required := array['workspace_id','brand_id','filename','media_type']; optional := array['text_content'];
    when 'claim_document_upload' then required := array['workspace_id','brand_id','job_id'];
    when 'start_manual_knowledge_draft' then required := array['workspace_id','brand_id'];
    when 'correct_knowledge_candidate' then required := array['workspace_id','brand_id','candidate_id','expected_version','value_text','excerpt']; optional := array['locator'];
    else raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end case;
  perform app_private.platform_knowledge_validate(p_input, required, optional);
  ws := (p_input->>'workspace_id')::uuid; br := (p_input->>'brand_id')::uuid;
  payload_hash := app_private.hash_canonical_json(p_input);
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || ws::text || ':' || p_operation || ':' || p_idempotency_key, 0));
  perform app_private.lock_platform_workspace(ws);
  select to_jsonb(b) into brand_data from public.brands b where workspace_id = ws and id = br;
  if brand_data is null or not app_private.platform_can(ws, br, 'brand:read') then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if brand_data->>'status' <> 'active' then
    raise exception using errcode = 'P0001', message = 'RESOURCE_ARCHIVED';
  end if;
  select * into replay from public.idempotency_records
    where actor_id = actor and workspace_id is not distinct from ws and operation = p_operation and idempotency_key = p_idempotency_key;
  if found then
    if not app_private.platform_can(ws, br, 'brand:write') then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
    if replay.request_hash <> payload_hash then raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT'; end if;
    if p_operation = 'correct_knowledge_candidate' or p_operation = 'start_manual_knowledge_draft' then
      return replay.response_payload;
    end if;
    select * into job from public.brand_source_jobs where id = (replay.response_payload->'job'->>'id')::uuid for update;
    if job.id is null or job.workspace_id <> ws or job.brand_id <> br then
      raise exception using errcode = 'P0002', message = 'NOT_FOUND';
    end if;
    job := app_private.expire_source_job(job.id);
    if job.status in ('queued','failed','awaiting_bytes') then
      job := app_private.lease_source_job(job.id, p_request_id);
      pending := job.status = 'capturing';
    end if;
    result := app_private.knowledge_draft_view(ws, br);
    return jsonb_build_object(
      'job', app_private.brand_source_job_json(job),
      'draft', result->'record',
      'current_candidates', result->'current_candidates',
      'next_cursor', result->'next_cursor',
      'capture_pending', pending);
  end if;
  if not app_private.platform_can(ws, br, 'brand:write') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  case p_operation
    when 'start_website_capture' then
      insert into public.brand_source_jobs (workspace_id, brand_id, kind, status, request_url, normalized_url, created_by)
        values (ws, br, 'website', 'queued', p_input->>'url', p_input->>'url', actor) returning * into job;
      job := app_private.lease_source_job(job.id, p_request_id);
      pending := job.status = 'capturing';
      result := jsonb_build_object(
        'job', app_private.brand_source_job_json(job), 'draft', null, 'current_candidates', '[]'::jsonb,
        'next_cursor', null, 'capture_pending', pending);
    when 'start_document_capture' then
      insert into public.brand_source_jobs (
        workspace_id, brand_id, kind, status, filename, media_type, created_by)
        values (ws, br, 'document', case when p_input ? 'text_content' then 'queued' else 'awaiting_bytes' end,
          p_input->>'filename', p_input->>'media_type', actor) returning * into job;
      if job.status = 'queued' then
        job := app_private.lease_source_job(job.id, p_request_id);
        pending := job.status = 'capturing';
      end if;
      result := jsonb_build_object(
        'job', app_private.brand_source_job_json(job), 'draft', null, 'current_candidates', '[]'::jsonb,
        'next_cursor', null, 'capture_pending', pending);
    when 'start_manual_knowledge_draft' then
      insert into public.brand_source_jobs (workspace_id, brand_id, kind, status, created_by)
        values (ws, br, 'manual', 'captured', actor) returning * into job;
      insert into public.brand_sources (workspace_id, brand_id, job_id, kind, method, captured_at, created_by)
        values (ws, br, job.id, 'manual', 'manual', statement_timestamp(), actor) returning * into source;
      update public.brand_source_jobs set source_id = source.id, updated_at = clock_timestamp() where id = job.id;
      draft := app_private.ensure_knowledge_draft(ws, br, actor);
      insert into public.brand_knowledge_candidates (
        workspace_id, brand_id, draft_id, source_id, job_id, field_key, value_text, status, excerpt, locator, method, captured_at, created_by)
        values (ws, br, draft.id, source.id, job.id, 'unknown_gap', null, 'unknown',
          'No website or document was supplied.', 'manual', 'manual', source.captured_at, actor);
      result := app_private.knowledge_draft_view(ws, br);
    when 'claim_document_upload' then
      select * into job from public.brand_source_jobs
        where workspace_id = ws and brand_id = br and id = (p_input->>'job_id')::uuid for update;
      if job.id is null or job.kind <> 'document' then
        raise exception using errcode = 'P0002', message = 'NOT_FOUND';
      end if;
      job := app_private.expire_source_job(job.id);
      if job.status in ('captured','duplicate') then
        pending := false;
      elsif job.status = 'capturing' then
        if job.lease_owner is distinct from p_request_id then
          raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
        end if;
        pending := false;
      else
        job := app_private.lease_source_job(job.id, p_request_id);
        pending := job.status = 'capturing' and job.lease_owner is not distinct from p_request_id
          and job.lease_expires_at is not null and job.lease_expires_at > statement_timestamp();
        if not pending and job.status not in ('captured','duplicate') then
          raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
        end if;
      end if;
      result := app_private.source_capture_view(job, pending);
    when 'correct_knowledge_candidate' then
      select * into candidate from public.brand_knowledge_candidates
        where workspace_id = ws and brand_id = br and id = (p_input->>'candidate_id')::uuid for update;
      if candidate.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if exists(select 1 from public.brand_knowledge_candidates later
        where later.workspace_id = ws and later.supersedes_id = candidate.id) then
        raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
      end if;
      select * into draft from public.brand_knowledge_drafts where workspace_id = ws and brand_id = br for update;
      if draft.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if draft.version <> (p_input->>'expected_version')::integer then
        raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
      end if;
      insert into public.brand_source_jobs (workspace_id, brand_id, kind, status, created_by)
        values (ws, br, 'manual', 'captured', actor) returning * into job;
      insert into public.brand_sources (workspace_id, brand_id, job_id, kind, method, captured_at, created_by)
        values (ws, br, job.id, 'manual', 'manual', statement_timestamp(), actor) returning * into source;
      update public.brand_source_jobs set source_id = source.id, updated_at = clock_timestamp() where id = job.id;
      insert into public.brand_knowledge_candidates (
        workspace_id, brand_id, draft_id, source_id, job_id, field_key, value_text, status, excerpt, locator, method,
        captured_at, supersedes_id, created_by)
        values (ws, br, draft.id, source.id, job.id, candidate.field_key, p_input->>'value_text',
          case when p_input->>'value_text' is null then 'unknown' else 'corrected' end,
          p_input->>'excerpt', coalesce(p_input->>'locator', 'manual'), 'manual', source.captured_at, candidate.id, actor);
      update public.brand_knowledge_drafts
        set version = version + 1, updated_by = actor, updated_at = clock_timestamp()
        where workspace_id = ws and brand_id = br;
      result := app_private.knowledge_draft_view(ws, br);
  end case;
  insert into public.idempotency_records (workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload)
    values (ws, actor, p_operation, p_idempotency_key, payload_hash, result);
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (ws, 'user', actor, 'platform.' || p_operation, 'platform_resource', coalesce(job.id, draft.id), p_request_id, '{}');
  return result;
end;
$$;

create function public.platform_knowledge_query(p_operation text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  ws uuid; br uuid; required text[]; optional text[] := '{}'; job public.brand_source_jobs%rowtype;
  source public.brand_sources%rowtype; items jsonb := '[]'::jsonb; next_cursor text; scope jsonb;
  cursor_data jsonb; after_at timestamptz; after_id uuid; page_limit integer; n integer := 0; rec jsonb;
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'UNAUTHENTICATED'; end if;
  case p_operation
    when 'get_source_job' then required := array['workspace_id','brand_id','job_id'];
    when 'list_latest_source_job' then required := array['workspace_id','brand_id'];
    when 'get_brand_source' then required := array['workspace_id','brand_id','source_id'];
    when 'get_knowledge_draft' then required := array['workspace_id','brand_id']; optional := array['limit','cursor'];
    when 'list_brand_sources' then required := array['workspace_id','brand_id']; optional := array['limit','cursor'];
    else raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end case;
  perform app_private.platform_knowledge_validate(p_input, required, optional);
  ws := (p_input->>'workspace_id')::uuid; br := (p_input->>'brand_id')::uuid;
  if not exists(select 1 from public.brands where workspace_id = ws and id = br)
    or not app_private.platform_can(ws, br, 'brand:read') then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if p_operation = 'get_source_job' then
    select * into job from public.brand_source_jobs
      where workspace_id = ws and brand_id = br and id = (p_input->>'job_id')::uuid;
    if job.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
    job := app_private.expire_source_job(job.id);
    return jsonb_build_object('record', app_private.brand_source_job_json(job));
  elsif p_operation = 'list_latest_source_job' then
    select * into job from public.brand_source_jobs
      where workspace_id = ws and brand_id = br
      order by updated_at desc, id desc
      limit 1;
    if job.id is not null then
      job := app_private.expire_source_job(job.id);
    end if;
    return jsonb_build_object(
      'record', case when job.id is null then null else app_private.brand_source_job_json(job) end);
  elsif p_operation = 'get_brand_source' then
    select * into source from public.brand_sources
      where workspace_id = ws and brand_id = br and id = (p_input->>'source_id')::uuid;
    if source.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
    return jsonb_build_object('record', app_private.brand_source_json(source));
  elsif p_operation = 'get_knowledge_draft' then
    return app_private.knowledge_draft_view(ws, br, coalesce((p_input->>'limit')::integer, 50), p_input->>'cursor');
  end if;
  page_limit := coalesce((p_input->>'limit')::integer, 20);
  scope := jsonb_build_object('operation', p_operation, 'actor', auth.uid(), 'input', p_input - array['limit','cursor']);
  if p_input ? 'cursor' then
    begin
      next_cursor := translate(p_input->>'cursor', '-_', '+/');
      cursor_data := convert_from(decode(next_cursor || repeat('=', (4 - length(next_cursor) % 4) % 4), 'base64'), 'UTF8')::jsonb;
      if jsonb_typeof(cursor_data) <> 'object' or not cursor_data ?& array['scope','at','id']
        or cursor_data - array['scope','at','id'] <> '{}'::jsonb or cursor_data->'scope' is distinct from scope then
        raise exception 'invalid cursor';
      end if;
      after_at := (cursor_data->>'at')::timestamptz; after_id := (cursor_data->>'id')::uuid;
    exception when others then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end;
  end if;
  next_cursor := null;
  for rec in select app_private.brand_source_json(s)
    from public.brand_sources s
    where s.workspace_id = ws and s.brand_id = br
      and (after_at is null or (s.created_at, s.id) > (after_at, after_id))
    order by s.created_at, s.id
    limit page_limit + 1
  loop
    n := n + 1;
    if n <= page_limit then items := items || jsonb_build_array(rec); source := null; end if;
  end loop;
  if n > page_limit then
    rec := items -> (page_limit - 1);
    next_cursor := rtrim(translate(replace(encode(convert_to(jsonb_build_object('scope', scope, 'at', rec->>'created_at', 'id', rec->>'id')::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
  end if;
  return jsonb_build_object('items', items, 'next_cursor', next_cursor);
end;
$$;

create function app_private.source_capture_view(p_job public.brand_source_jobs, p_pending boolean)
returns jsonb language plpgsql stable set search_path = pg_catalog as $$
declare view jsonb;
begin
  view := app_private.knowledge_draft_view(p_job.workspace_id, p_job.brand_id);
  return jsonb_build_object(
    'job', app_private.brand_source_job_json(p_job),
    'draft', view->'record',
    'current_candidates', view->'current_candidates',
    'next_cursor', view->'next_cursor',
    'capture_pending', p_pending);
end;
$$;
revoke all on function app_private.source_capture_view(public.brand_source_jobs, boolean)
  from public, anon, authenticated, service_role;

create function public.record_brand_source_capture(
  p_job_id uuid, p_payload jsonb, p_request_id text, p_expected_attempt_count integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  job public.brand_source_jobs%rowtype; source public.brand_sources%rowtype; draft public.brand_knowledge_drafts%rowtype;
  method text; candidate jsonb; source_id uuid; existing uuid;
  pre_ws uuid; pre_br uuid; pre_actor uuid;
begin
  if p_job_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 65536 or p_request_id is null
    or char_length(p_request_id) not between 1 and 200
    or p_expected_attempt_count is null or p_expected_attempt_count not between 1 and 3 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  select workspace_id, brand_id, created_by into pre_ws, pre_br, pre_actor
    from public.brand_source_jobs where id = p_job_id;
  if pre_ws is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  perform app_private.lock_platform_workspace_for(pre_actor, pre_ws);
  select * into job from public.brand_source_jobs where id = p_job_id for update;
  if job.id is null or job.workspace_id is distinct from pre_ws or job.brand_id is distinct from pre_br then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if not app_private.platform_can_for(job.created_by, job.workspace_id, job.brand_id, 'brand:write') then
    if app_private.source_attempt_lease_matches(job, p_request_id, p_expected_attempt_count) then
      update public.brand_source_jobs
        set status = 'failed', failure_code = 'SOURCE_INTERRUPTED', lease_owner = null, lease_expires_at = null,
            version = version + 1, updated_at = clock_timestamp()
        where id = job.id returning * into job;
    end if;
    return app_private.source_capture_view(job, false);
  end if;
  if job.status in ('captured','duplicate') then
    return app_private.source_capture_view(job, false);
  end if;
  if not app_private.source_attempt_lease_matches(job, p_request_id, p_expected_attempt_count) then
    if job.status = 'capturing' then
      return app_private.source_capture_view(job, false);
    end if;
  end if;
  if job.status <> 'capturing' or job.kind not in ('website','document') then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  method := case job.kind when 'website' then 'https_get' else 'document_upload' end;
  if job.kind = 'website' and (
      coalesce(p_payload->>'origin_url','') is distinct from job.normalized_url
      or coalesce(p_payload->>'method','https_get') <> 'https_get'
      or not app_private.public_https_destination(p_payload->>'origin_url')
      or not app_private.public_https_destination(coalesce(p_payload->>'final_url',''))) then
    raise exception using errcode = '22023', message = 'SOURCE_UNSAFE';
  end if;
  if job.kind = 'document' and (
      coalesce(p_payload->>'method','document_upload') <> 'document_upload'
      or coalesce(p_payload->>'origin_url','') <> ''
      or coalesce(p_payload->>'final_url','') <> '') then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  begin
    source_id := nullif(p_payload->>'source_id','')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end;
  source_id := coalesce(source_id, gen_random_uuid());
  if coalesce(p_payload->>'content_sha256','') !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload->>'r2_key','') is distinct from
      ('brand-sources/' || job.workspace_id::text || '/' || job.brand_id::text || '/' || source_id::text)
    or coalesce((p_payload->>'byte_size')::integer, -1) not between 1 and 2097152
    or coalesce(p_payload->>'media_type','') not in ('text/plain','text/markdown','text/html')
    or jsonb_typeof(p_payload->'candidates') <> 'array'
    or jsonb_array_length(p_payload->'candidates') > 40 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  select s.id into existing from public.brand_sources s
    where s.workspace_id = job.workspace_id and s.brand_id = job.brand_id
      and s.content_sha256 = p_payload->>'content_sha256';
  if existing is not null then
    update public.brand_source_jobs
      set status = 'duplicate', source_id = existing, lease_owner = null, lease_expires_at = null,
          version = version + 1, updated_at = clock_timestamp()
      where id = job.id returning * into job;
    return app_private.source_capture_view(job, false);
  end if;
  insert into public.brand_sources (
    id, workspace_id, brand_id, job_id, kind, method, origin_url, final_url, media_type, byte_size,
    content_sha256, r2_key, http_status, redirect_hops, captured_at, created_by)
    values (
      source_id, job.workspace_id, job.brand_id, job.id, job.kind, method,
      coalesce(p_payload->>'origin_url',''), coalesce(p_payload->>'final_url', coalesce(p_payload->>'origin_url','')),
      p_payload->>'media_type', (p_payload->>'byte_size')::integer, p_payload->>'content_sha256',
      p_payload->>'r2_key', nullif(p_payload->>'http_status','')::integer,
      coalesce(p_payload->'redirect_hops', '[]'::jsonb),
      coalesce((p_payload->>'captured_at')::timestamptz, statement_timestamp()), job.created_by)
    returning * into source;
  draft := app_private.ensure_knowledge_draft(job.workspace_id, job.brand_id, job.created_by);
  for candidate in select * from jsonb_array_elements(p_payload->'candidates') loop
    if coalesce(candidate->>'field_key','') not in ('page_title','meta_description','canonical_url','heading','visible_excerpt','jsonld_text','document_filename','unknown_gap')
      or coalesce(candidate->>'status','') not in ('observed','unknown')
      or coalesce(candidate->>'method','') not in ('html_title','meta_description','canonical_link','heading','visible_text','jsonld_text','document_text')
      or coalesce(candidate->>'excerpt','') = ''
      or coalesce(candidate->>'method','') = 'manual' then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    insert into public.brand_knowledge_candidates (
      workspace_id, brand_id, draft_id, source_id, job_id, field_key, value_text, status, excerpt, locator, method, captured_at, created_by)
      values (
        job.workspace_id, job.brand_id, draft.id, source.id, job.id, candidate->>'field_key',
        nullif(candidate->>'value_text',''), candidate->>'status', candidate->>'excerpt',
        coalesce(candidate->>'locator',''), candidate->>'method', source.captured_at, job.created_by);
  end loop;
  update public.brand_source_jobs
    set status = 'captured', source_id = source.id, lease_owner = null, lease_expires_at = null,
        version = version + 1, updated_at = clock_timestamp()
    where id = job.id returning * into job;
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (job.workspace_id, 'system', null, 'platform.record_brand_source_capture', 'platform_resource', source.id, p_request_id, '{}');
  return app_private.source_capture_view(job, false);
end;
$$;

create function public.fail_brand_source_job(
  p_job_id uuid, p_failure_code text, p_request_id text, p_expected_attempt_count integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  job public.brand_source_jobs%rowtype;
  pre_ws uuid; pre_br uuid; pre_actor uuid;
begin
  if p_job_id is null or p_failure_code not in (
    'SOURCE_UNSAFE','SOURCE_UNSUPPORTED','SOURCE_MALFORMED','SOURCE_TOO_LARGE',
    'SOURCE_TIMEOUT','SOURCE_UNREACHABLE','SOURCE_INTERRUPTED','SOURCE_EGRESS_UNAVAILABLE')
    or p_request_id is null or char_length(p_request_id) not between 1 and 200
    or p_expected_attempt_count is null or p_expected_attempt_count not between 1 and 3 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  select workspace_id, brand_id, created_by into pre_ws, pre_br, pre_actor
    from public.brand_source_jobs where id = p_job_id;
  if pre_ws is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  perform app_private.lock_platform_workspace_for(pre_actor, pre_ws);
  select * into job from public.brand_source_jobs where id = p_job_id for update;
  if job.id is null or job.workspace_id is distinct from pre_ws or job.brand_id is distinct from pre_br then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if job.status = 'capturing'
    and not app_private.source_attempt_lease_matches(job, p_request_id, p_expected_attempt_count) then
    return app_private.source_capture_view(job, false);
  end if;
  if not app_private.platform_can_for(job.created_by, job.workspace_id, job.brand_id, 'brand:write') then
    if app_private.source_attempt_lease_matches(job, p_request_id, p_expected_attempt_count)
      or job.status in ('awaiting_bytes','queued') then
      update public.brand_source_jobs
        set status = 'failed', failure_code = 'SOURCE_INTERRUPTED', lease_owner = null, lease_expires_at = null,
            version = version + 1, updated_at = clock_timestamp()
        where id = job.id returning * into job;
    end if;
    return app_private.source_capture_view(job, false);
  end if;
  if job.status = 'capturing' then
    update public.brand_source_jobs
      set status = case when p_failure_code in ('SOURCE_UNSAFE','SOURCE_UNSUPPORTED','SOURCE_MALFORMED','SOURCE_TOO_LARGE')
        then 'rejected' else 'failed' end,
          failure_code = p_failure_code, lease_owner = null, lease_expires_at = null,
          version = version + 1, updated_at = clock_timestamp()
      where id = job.id returning * into job;
  end if;
  return app_private.source_capture_view(job, false);
end;
$$;

revoke all on function public.platform_knowledge_command(text, jsonb, text, text),
  public.platform_knowledge_query(text, jsonb),
  public.record_brand_source_capture(uuid, jsonb, text, integer),
  public.fail_brand_source_job(uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.platform_knowledge_command(text, jsonb, text, text),
  public.platform_knowledge_query(text, jsonb) to authenticated;
grant execute on function public.record_brand_source_capture(uuid, jsonb, text, integer),
  public.fail_brand_source_job(uuid, text, text, integer) to service_role;

commit;
