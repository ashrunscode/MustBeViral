begin;

create table public.brand_knowledge_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  review_kind text not null check (review_kind in ('expiry','contradiction')),
  field_key text not null check (char_length(field_key) between 1 and 120),
  draft_version_before integer not null check (draft_version_before>0),
  draft_hash_before text not null check (draft_hash_before ~ '^[0-9a-f]{64}$'),
  before_assertion_ids uuid[] not null check (cardinality(before_assertion_ids) between 1 and 50),
  after_assertion_ids uuid[] not null check (cardinality(after_assertion_ids) between 1 and 50),
  reason text not null check (char_length(reason) between 1 and 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(workspace_id,brand_id) references public.brands(workspace_id,id) on delete restrict
);
create index brand_knowledge_reviews_scope on public.brand_knowledge_reviews(workspace_id,brand_id,created_at,id);
create index brand_knowledge_reviews_actor on public.brand_knowledge_reviews(created_by);
alter table public.brand_knowledge_reviews enable row level security;
alter table public.brand_knowledge_reviews force row level security;
revoke all on public.brand_knowledge_reviews from public,anon,authenticated,service_role;
grant select on public.brand_knowledge_reviews to authenticated;
create policy knowledge_review_read on public.brand_knowledge_reviews for select to authenticated
  using(app_private.platform_can(workspace_id,brand_id,'brand:read'));
create trigger immutable_brand_knowledge_reviews before update or delete on public.brand_knowledge_reviews
  for each row execute function app_private.reject_immutable_mutation();

create function app_private.brand_snapshot_expired(p_snapshot jsonb,p_now timestamptz)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare item jsonb; ends timestamptz;
begin
  for item in select a from jsonb_array_elements(p_snapshot->'assertions') a
    where a->>'kind'='offer' and a->>'status'<>'unknown' and a->>'ends_at' is not null loop
    begin ends:=(item->>'ends_at')::timestamptz;
    exception when others then return true; end;
    if not isfinite(ends) or ends<=p_now then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function app_private.brand_snapshot_expired(jsonb,timestamptz) from public,anon,authenticated,service_role;

-- Check the clock after waiting for command locks. A historical read or replay
-- is unchanged; only a new approval or new campaign binding passes this guard.
create function app_private.guard_fresh_brand_snapshot()
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
  return new;
end;
$$;
revoke all on function app_private.guard_fresh_brand_snapshot() from public,anon,authenticated,service_role;
create trigger guard_new_brand_version_expiry before insert on public.brand_versions
  for each row execute function app_private.guard_fresh_brand_snapshot();
create trigger guard_new_brand_pin_expiry before insert on public.brand_version_pins
  for each row execute function app_private.guard_fresh_brand_snapshot();

create function public.platform_knowledge_lifecycle_command(p_operation text,p_input jsonb,p_idempotency_key text,p_request_id text)
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
revoke all on function public.platform_knowledge_lifecycle_command(text,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_knowledge_lifecycle_command(text,jsonb,text,text) to authenticated;

commit;
