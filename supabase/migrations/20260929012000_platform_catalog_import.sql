begin;

-- Expand existing private document capture; no new provider or job runner.
create or replace function app_private.platform_knowledge_validate(p_input jsonb, p_required text[], p_optional text[] default '{}')
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
    if k in ('value_text','ends_at') and v = 'null'::jsonb then continue; end if;
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
      if jsonb_typeof(v) <> 'string' or app_private.knowledge_utf16_length(p_input->>k) not between 1 and 2048
        or (p_input->>k) !~ '^[A-Za-z0-9_-]+$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'url' then
      if jsonb_typeof(v) <> 'string' or not app_private.public_https_destination(p_input->>k) then
        raise exception using errcode = '22023', message = 'SOURCE_UNSAFE';
      end if;
    elsif k = 'filename' then
      if jsonb_typeof(v) <> 'string' or app_private.knowledge_utf16_length(p_input->>k) not between 1 and 200 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'media_type' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) not in ('text/plain','text/markdown','text/html','text/csv') then
        raise exception using errcode = '22023', message = 'SOURCE_UNSUPPORTED';
      end if;
    elsif k = 'text_content' then
      if jsonb_typeof(v) <> 'string' or app_private.knowledge_utf16_length(p_input->>k) not between 1 and 32768 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('excerpt','locator','value_text','answer_text','pin_key','draft_hash') then
      if jsonb_typeof(v) <> 'string' then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
      if k = 'excerpt' and app_private.knowledge_utf16_length(p_input->>k) not between 1 and 2000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'locator' and app_private.knowledge_utf16_length(p_input->>k) > 500 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'value_text' and app_private.knowledge_utf16_length(p_input->>k) > 4000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'answer_text' and app_private.knowledge_utf16_length(p_input->>k) not between 1 and 4000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'pin_key' and (app_private.knowledge_utf16_length(p_input->>k) not between 1 and 120
        or (p_input->>k) !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$') then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'draft_hash' and (p_input->>k) !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'ends_at' then
      if jsonb_typeof(v) <> 'string' then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
      begin
        perform app_private.parse_knowledge_expiry(p_input->>'ends_at');
      exception when others then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end;
    end if;
  end loop;
end;
$$;

create or replace function public.record_brand_source_capture(
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
    or coalesce(p_payload->>'media_type','') not in ('text/plain','text/markdown','text/html','text/csv')
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

create or replace function public.platform_knowledge_lifecycle_command(p_operation text,p_input jsonb,p_idempotency_key text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); ws uuid; br uuid; needed text[]; payload_hash text;
  draft public.brand_knowledge_drafts%rowtype; replay public.idempotency_records%rowtype;
  selected public.brand_assertions%rowtype; prior public.brand_assertions%rowtype;
  source public.brand_sources%rowtype; job public.brand_source_jobs%rowtype;
  targets uuid[]; replacements uuid[]:='{}'; next_id uuid; first_row boolean:=true;
  target_kind text; target_field text; ends timestamptz; result jsonb; review_id uuid;
begin
  if actor is null then raise exception using errcode='28000',message='UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if p_operation='import_brand_catalog' then
    perform app_private.platform_knowledge_validate(p_input,array['workspace_id','brand_id','filename','media_type','text_content']);
    -- Keep import and ordinary upload idempotency identities separate. The
    -- existing capture command owns permission locks, retries and private bytes.
    return public.platform_knowledge_command('start_document_capture',p_input,
      'catalog:'||app_private.hash_canonical_json(jsonb_build_object('key',p_idempotency_key)),p_request_id);
  end if;
  if p_operation='review_expired_offer' then
    needed:=array['workspace_id','brand_id','assertion_id','expected_version','draft_hash','value_text','ends_at','excerpt'];
  elsif p_operation='resolve_brand_contradiction' then
    needed:=array['workspace_id','brand_id','kind','field_key','expected_version','draft_hash','value_text','ends_at','excerpt'];
  else raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  perform app_private.platform_knowledge_validate(p_input,needed);
  if p_input->>'value_text' is not null and (btrim(p_input->>'value_text')='' or app_private.knowledge_utf16_length(p_input->>'value_text')>4000) then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if p_operation='resolve_brand_contradiction' and (
    jsonb_typeof(p_input->'kind')<>'string' or p_input->>'kind' not in ('offering','location','fact','offer','visual_candidate','language')
    or jsonb_typeof(p_input->'field_key')<>'string' or app_private.knowledge_utf16_length(p_input->>'field_key') not between 1 and 120) then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  ws:=(p_input->>'workspace_id')::uuid; br:=(p_input->>'brand_id')::uuid;
  payload_hash:=app_private.hash_canonical_json(p_input);
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||ws::text||':'||p_operation||':'||p_idempotency_key,0));
  perform app_private.lock_platform_workspace(ws);
  if not app_private.platform_can(ws,br,'brand:write')
    or not exists(select 1 from public.brands where workspace_id=ws and id=br and status='active') then
    raise exception using errcode='P0002',message='NOT_FOUND';
  end if;
  select * into replay from public.idempotency_records where actor_id=actor and workspace_id=ws
    and operation=p_operation and idempotency_key=p_idempotency_key;
  if found then
    if replay.request_hash<>payload_hash then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return replay.response_payload;
  end if;
  select * into draft from public.brand_knowledge_drafts where workspace_id=ws and brand_id=br for update;
  if draft.id is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
  if draft.version<>(p_input->>'expected_version')::integer
    or app_private.knowledge_draft_hash(ws,br) is distinct from p_input->>'draft_hash' then
    raise exception using errcode='P0001',message='REVISION_CONFLICT';
  end if;
  if p_operation='review_expired_offer' then
    select * into selected from app_private.current_assertions(ws,br) a where a.id=(p_input->>'assertion_id')::uuid;
    if selected.id is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if selected.kind<>'offer' or selected.status='unknown' or selected.ends_at is null or selected.ends_at>clock_timestamp() then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    end if;
    target_kind:=selected.kind; target_field:=selected.field_key; targets:=array[selected.id];
  else
    target_kind:=p_input->>'kind'; target_field:=p_input->>'field_key';
    select array_agg(a.id order by a.id) into targets from app_private.current_assertions(ws,br) a
      where a.kind=target_kind and a.field_key=target_field and a.status<>'unknown';
    if targets is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if not exists(select 1 from app_private.current_assertions(ws,br) a where a.id=any(targets) and a.status='disputed')
      and (select count(distinct jsonb_build_array(a.value_text,case when target_kind='offer' then to_jsonb(a.ends_at) else 'null'::jsonb end))
        from app_private.current_assertions(ws,br) a where a.id=any(targets))<2 then
      raise exception using errcode='22023',message='VALIDATION_FAILED';
    end if;
  end if;
  ends:=app_private.parse_knowledge_expiry(p_input->>'ends_at');
  if (p_input->>'value_text' is null and ends is not null) or (target_kind<>'offer' and ends is not null) then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  if p_input->>'value_text' is not null and target_kind='offer' and (
    (ends is not null and ends<=clock_timestamp()) or (ends is null and exists(
      select 1 from app_private.current_assertions(ws,br) a where a.id=any(targets) and a.ends_at<=clock_timestamp()))) then
    raise exception using errcode='P0001',message='EXPIRED_OFFER';
  end if;
  insert into public.brand_source_jobs(workspace_id,brand_id,kind,status,created_by)
    values(ws,br,'manual','captured',actor) returning * into job;
  insert into public.brand_sources(workspace_id,brand_id,job_id,kind,method,captured_at,created_by)
    values(ws,br,job.id,'manual','manual',clock_timestamp(),actor) returning * into source;
  update public.brand_source_jobs set source_id=source.id,updated_at=clock_timestamp() where id=job.id;
  for prior in select * from app_private.current_assertions(ws,br) a where a.id=any(targets) order by a.id loop
    insert into public.brand_assertions(workspace_id,brand_id,draft_id,source_id,job_id,kind,field_key,value_text,status,excerpt,locator,method,captured_at,ends_at,reusable,supersedes_id,created_by)
      values(ws,br,draft.id,source.id,job.id,target_kind,target_field,
        case when first_row then p_input->>'value_text' else null end,
        case when first_row and p_input->>'value_text' is not null then 'corrected' else 'unknown' end,
        p_input->>'excerpt',p_operation,'manual',source.captured_at,
        case when first_row then ends else null end,false,prior.id,actor) returning id into next_id;
    replacements:=array_append(replacements,next_id); first_row:=false;
  end loop;
  insert into public.brand_knowledge_reviews(workspace_id,brand_id,review_kind,field_key,draft_version_before,draft_hash_before,before_assertion_ids,after_assertion_ids,reason,created_by)
    values(ws,br,case when p_operation='review_expired_offer' then 'expiry' else 'contradiction' end,target_field,draft.version,p_input->>'draft_hash',targets,replacements,p_input->>'excerpt',actor) returning id into review_id;
  perform app_private.bump_knowledge_draft(ws,br,actor);
  result:=app_private.knowledge_review_view(ws,br,false);
  insert into public.idempotency_records(workspace_id,actor_id,operation,idempotency_key,request_hash,response_payload)
    values(ws,actor,p_operation,p_idempotency_key,payload_hash,result);
  insert into public.audit_events(workspace_id,actor_type,actor_id,action,entity_type,entity_id,request_id,details)
    values(ws,'user',actor,'platform.'||p_operation,'platform_resource',review_id,p_request_id,'{}');
  return result;
end;
$$;

commit;
