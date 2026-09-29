begin;

create function app_private.latest_extracted_knowledge_source(p_source public.brand_sources)
returns setof public.brand_sources language sql stable set search_path=pg_catalog as $$
 select newer.* from public.brand_sources newer
 left join public.brand_source_jobs nj on nj.id=newer.job_id and nj.workspace_id=newer.workspace_id and nj.brand_id=newer.brand_id
 left join public.brand_source_jobs original_job on original_job.id=p_source.job_id and original_job.workspace_id=p_source.workspace_id and original_job.brand_id=p_source.brand_id
 where newer.workspace_id=p_source.workspace_id and newer.brand_id=p_source.brand_id and newer.kind=p_source.kind
   and ((p_source.kind='website' and p_source.origin_url<>'' and newer.origin_url=p_source.origin_url)
     or (p_source.kind='document' and original_job.filename<>'' and nj.filename=original_job.filename))
   and exists(select 1 from public.audit_events ev where ev.workspace_id=newer.workspace_id and ev.entity_id=newer.id and ev.action='platform.record_brand_extraction')
 order by newer.created_at desc,newer.captured_at desc,newer.id desc limit 1;
$$;
revoke all on function app_private.latest_extracted_knowledge_source(public.brand_sources) from public,anon,authenticated,service_role;

create function app_private.knowledge_missing_source_assertions(p_workspace uuid,p_brand uuid)
returns table(assertion_id uuid,latest_source_id uuid) language sql stable set search_path=pg_catalog as $$
 select a.id,latest.id from app_private.current_assertions(p_workspace,p_brand) a
 join public.brand_sources original on original.id=a.source_id and original.workspace_id=p_workspace and original.brand_id=p_brand
 cross join lateral app_private.latest_extracted_knowledge_source(original) latest
 where a.status<>'unknown' and latest.id<>original.id
   and not exists(select 1 from public.brand_assertions observed where observed.workspace_id=p_workspace and observed.brand_id=p_brand
     and observed.source_id=latest.id and observed.kind=a.kind and observed.field_key=a.field_key and observed.status<>'unknown');
$$;
revoke all on function app_private.knowledge_missing_source_assertions(uuid,uuid) from public,anon,authenticated,service_role;

create function app_private.knowledge_source_changes(p_workspace uuid,p_brand uuid,p_version uuid)
returns jsonb language sql stable set search_path=pg_catalog as $$
 with baseline as (
  select v.snapshot from public.brand_versions v where v.workspace_id=p_workspace and v.brand_id=p_brand and (p_version is null or v.id=p_version)
  order by v.version desc limit 1
 ), identities as (select distinct (a->>'source_id')::uuid id from baseline b cross join lateral jsonb_array_elements(b.snapshot->'assertions') a)
 select coalesce(jsonb_agg(jsonb_build_object('previous_source_id',original.id,'latest_source_id',latest.id,'captured_at',latest.captured_at,'kind',latest.kind)
  order by original.id),'[]'::jsonb)
 from identities i join public.brand_sources original on original.id=i.id and original.workspace_id=p_workspace and original.brand_id=p_brand
 cross join lateral app_private.latest_extracted_knowledge_source(original) latest
 where original.id<>latest.id and original.content_sha256 is distinct from latest.content_sha256;
$$;
revoke all on function app_private.knowledge_source_changes(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function app_private.knowledge_changes_view(p_workspace_id uuid, p_brand_id uuid, p_version_id uuid default null)
returns jsonb language sql stable set search_path = pg_catalog as $$
  with baseline as (
    select * from public.brand_versions v
    where v.workspace_id = p_workspace_id and v.brand_id = p_brand_id
      and (p_version_id is null or v.id = p_version_id)
    order by v.version desc limit 1
  ), before_rows as (
    select a from baseline b cross join lateral jsonb_array_elements(b.snapshot->'assertions') a
  ), after_rows as (
    select app_private.brand_assertion_json(a) a from app_private.current_assertions(p_workspace_id,p_brand_id) a
  ), keys as (
    select a->>'kind' kind, a->>'field_key' field_key from before_rows
    union select a->>'kind', a->>'field_key' from after_rows
  ), grouped as (
    select k.*,
      coalesce((select jsonb_agg(a order by a->>'id') from before_rows
        where a->>'kind'=k.kind and a->>'field_key'=k.field_key),'[]'::jsonb) before_values,
      coalesce((select jsonb_agg(a order by a->>'id') from after_rows
        where a->>'kind'=k.kind and a->>'field_key'=k.field_key),'[]'::jsonb) after_values
    from keys k
  ), groups as (
    select kind,field_key,jsonb_build_object(
      'kind',kind,'field_key',field_key,
      'change',case
        when before_values='[]'::jsonb then 'added'
        when after_values='[]'::jsonb then 'removed'
        when app_private.knowledge_assertion_values(before_values) is distinct from app_private.knowledge_assertion_values(after_values) then 'changed'
        when before_values is distinct from after_values then 'evidence_changed'
        else 'unchanged' end,
      'baseline_assertions',before_values,'current_assertions',after_values,
      'source_missing',exists(select 1 from app_private.knowledge_missing_source_assertions(p_workspace_id,p_brand_id) missing join app_private.current_assertions(p_workspace_id,p_brand_id) finding on finding.id=missing.assertion_id where finding.kind=grouped.kind and finding.field_key=grouped.field_key),
      'conflicted',exists(select 1 from app_private.knowledge_missing_source_assertions(p_workspace_id,p_brand_id) missing join app_private.current_assertions(p_workspace_id,p_brand_id) finding on finding.id=missing.assertion_id where finding.kind=grouped.kind and finding.field_key=grouped.field_key) or exists(select 1 from jsonb_array_elements(after_values) a where a->>'status'='disputed')
        or (select count(distinct jsonb_build_array(a->'value_text',case when kind='offer' then a->'ends_at' else 'null'::jsonb end))>1
          from jsonb_array_elements(after_values) a where a->>'status'<>'unknown'),
      'expired',exists(select 1 from jsonb_array_elements(after_values) a
        where a->>'kind'='offer' and a->>'status'<>'unknown' and a->>'ends_at' is not null
          and (a->>'ends_at')::timestamptz<=statement_timestamp())
    ) item from grouped
  )
  select jsonb_build_object(
    'baseline',(select app_private.brand_version_json(b) from baseline b),
    'draft_version',(select version from public.brand_knowledge_drafts where workspace_id=p_workspace_id and brand_id=p_brand_id),
    'draft_hash',case when exists(select 1 from public.brand_knowledge_drafts where workspace_id=p_workspace_id and brand_id=p_brand_id)
      then app_private.knowledge_draft_hash(p_workspace_id,p_brand_id) else null end,
    'evaluated_at',statement_timestamp(),
    'source_changes',app_private.knowledge_source_changes(p_workspace_id,p_brand_id,p_version_id),
    'groups',coalesce((select jsonb_agg(item order by kind,field_key) from groups),'[]'::jsonb),
    'expired_baseline_assertion_ids',coalesce((select jsonb_agg(a->>'id' order by a->>'id') from before_rows
      where a->>'kind'='offer' and a->>'status'<>'unknown' and a->>'ends_at' is not null
        and (a->>'ends_at')::timestamptz<=statement_timestamp()),'[]'::jsonb)
  );
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
      and not exists(select 1 from app_private.knowledge_missing_source_assertions(ws,br) missing where missing.assertion_id=any(targets))
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

create or replace function app_private.guard_fresh_brand_snapshot()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare snapshot jsonb;
begin
  if tg_table_name='brand_versions' then snapshot:=new.snapshot;
  else
    select v.snapshot into snapshot from public.brand_versions v
      where v.workspace_id=new.workspace_id and v.brand_id=new.brand_id and v.id=new.brand_version_id;
    if snapshot is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
  end if;
  if app_private.brand_snapshot_expired(snapshot,clock_timestamp()) then
    raise exception using errcode='P0001',message='EXPIRED_OFFER';
  end if;
  if tg_table_name='brand_versions' and exists(select 1 from app_private.knowledge_missing_source_assertions(new.workspace_id,new.brand_id)) then
    raise exception using errcode='P0001',message='CONTRADICTORY_KNOWLEDGE';
  end if;
  return new;
end;
$$;

commit;
