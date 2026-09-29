begin;

-- Logical order survives wall-clock corrections. Existing rows keep their
-- historical timestamps; new evidence receives a database-only sequence.
create sequence app_private.knowledge_event_sequence;
revoke all on sequence app_private.knowledge_event_sequence from public,anon,authenticated,service_role;
alter table public.brand_source_jobs add column completion_sequence bigint;
alter table public.audit_events add column knowledge_sequence bigint;
alter table public.brand_versions add column knowledge_sequence bigint;

create or replace function app_private.protect_source_job()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if (to_jsonb(new) - array['status','lease_owner','lease_expires_at','failure_code','source_id','attempt_count','version','updated_at'])
     is distinct from (to_jsonb(old) - array['status','lease_owner','lease_expires_at','failure_code','source_id','attempt_count','version','updated_at']) then
    raise exception using errcode='55000',message='SOURCE_JOB_IDENTITY_IMMUTABLE';
  end if;
  if new.kind in ('website','document') and new.status in ('captured','duplicate') and new.source_id is not null
    and (old.status not in ('captured','duplicate') or old.source_id is null) then
    new.completion_sequence:=nextval('app_private.knowledge_event_sequence');
  end if;
  return new;
end;
$$;

create function app_private.assign_knowledge_sequence()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.knowledge_sequence is not null then raise exception using errcode='55000',message='KNOWLEDGE_SEQUENCE_MACHINE_ONLY'; end if;
  if tg_table_name='brand_versions' then
    new.knowledge_sequence:=nextval('app_private.knowledge_event_sequence');
  elsif new.action='platform.record_brand_extraction' then
    new.knowledge_sequence:=nextval('app_private.knowledge_event_sequence');
  end if;
  return new;
end;
$$;
revoke all on function app_private.assign_knowledge_sequence() from public,anon,authenticated,service_role;
create trigger assign_knowledge_sequence before insert on public.audit_events
  for each row execute function app_private.assign_knowledge_sequence();
create trigger assign_knowledge_sequence before insert on public.brand_versions
  for each row execute function app_private.assign_knowledge_sequence();

-- Byte deduplication must not erase when/where those bytes were recaptured.
-- Terminal capture jobs retain their completion time on replay. Extraction
-- replay is deliberately excluded from the occurrence ordering.
create index brand_source_jobs_completed_source on public.brand_source_jobs
  (workspace_id,brand_id,source_id,updated_at desc,id)
  where status in ('captured','duplicate');
create index brand_extraction_first_evidence on public.audit_events
  (workspace_id,entity_id,created_at)
  where action='platform.record_brand_extraction';

create function app_private.latest_knowledge_source_captures(p_source public.brand_sources)
returns table(source_id uuid,kind text,completed_at timestamptz,available_at timestamptz,capture_job_id uuid,available_sequence bigint,completion_sequence bigint)
language sql stable set search_path=pg_catalog as $$
 with occurrences as (
  select j.source_id,j.kind,
    case j.kind when 'website' then j.normalized_url else j.filename end identity_key,
    j.updated_at completed_at,j.id capture_job_id,j.id ordering_id,coalesce(j.completion_sequence,0) completion_sequence
  from public.brand_source_jobs j
  join public.brand_sources s on s.id=j.source_id and s.workspace_id=j.workspace_id and s.brand_id=j.brand_id
  where j.workspace_id=p_source.workspace_id and j.brand_id=p_source.brand_id
    and j.status in ('captured','duplicate') and j.kind in ('website','document')
    and case j.kind when 'website' then j.normalized_url else j.filename end<>''
  union all
  -- Preserve imported historical website evidence that predates capture jobs.
  select s.id,s.kind,s.origin_url,s.created_at,null::uuid,s.id,0::bigint
  from public.brand_sources s
  where s.workspace_id=p_source.workspace_id and s.brand_id=p_source.brand_id
    and s.job_id is null and s.kind='website' and s.origin_url<>''
 ), extracted as (
  select ev.entity_id,min(ev.created_at) first_extracted_at,
    case when bool_or(ev.knowledge_sequence is null) then 0 else min(ev.knowledge_sequence) end first_extracted_sequence
  from public.audit_events ev
  where ev.workspace_id=p_source.workspace_id and ev.action='platform.record_brand_extraction'
  group by ev.entity_id
 ), identities as (
  select distinct o.kind,o.identity_key from occurrences o where o.source_id=p_source.id
 ), latest as (
  select distinct on (o.kind,o.identity_key)
    o.source_id,o.kind,o.completed_at,greatest(o.completed_at,e.first_extracted_at) available_at,o.capture_job_id,
    greatest(o.completion_sequence,e.first_extracted_sequence) available_sequence,o.completion_sequence
  from occurrences o join identities i on i.kind=o.kind and i.identity_key=o.identity_key
  join extracted e on e.entity_id=o.source_id
  order by o.kind,o.identity_key,o.completion_sequence desc,o.completed_at desc,o.ordering_id desc
 ) select * from latest;
$$;
revoke all on function app_private.latest_knowledge_source_captures(public.brand_sources) from public,anon,authenticated,service_role;

create or replace function app_private.latest_extracted_knowledge_source(p_source public.brand_sources)
returns setof public.brand_sources language sql stable set search_path=pg_catalog as $$
 select distinct s.* from app_private.latest_knowledge_source_captures(p_source) occurrence
 join public.brand_sources s on s.id=occurrence.source_id and s.workspace_id=p_source.workspace_id and s.brand_id=p_source.brand_id;
$$;

create or replace function app_private.knowledge_missing_source_assertions(p_workspace uuid,p_brand uuid)
returns table(assertion_id uuid,latest_source_id uuid) language sql stable set search_path=pg_catalog as $$
 select distinct a.id,latest.source_id from app_private.current_assertions(p_workspace,p_brand) a
 join public.brand_sources original on original.id=a.source_id and original.workspace_id=p_workspace and original.brand_id=p_brand
 cross join lateral app_private.latest_knowledge_source_captures(original) latest
 where a.status<>'unknown' and latest.source_id<>original.id
   and not exists(select 1 from public.brand_assertions observed where observed.workspace_id=p_workspace and observed.brand_id=p_brand
     and observed.source_id=latest.source_id and observed.kind=a.kind and observed.field_key=a.field_key and observed.status<>'unknown');
$$;

create or replace function app_private.knowledge_source_changes(p_workspace uuid,p_brand uuid,p_version uuid)
returns jsonb language sql stable set search_path=pg_catalog as $$
 with baseline as (
  select v.snapshot,v.created_at approved_at,coalesce(v.knowledge_sequence,0) approved_sequence from public.brand_versions v where v.workspace_id=p_workspace and v.brand_id=p_brand and (p_version is null or v.id=p_version)
  order by v.version desc limit 1
 ), identities as (
  select distinct (a->>'source_id')::uuid id,b.approved_at,b.approved_sequence from baseline b cross join lateral jsonb_array_elements(b.snapshot->'assertions') a
 ), changes as (
  select original.id previous_source_id,latest.source_id latest_source_id,latest.completed_at,latest.kind,latest.capture_job_id,
    count(*) over(partition by original.id) changed_origin_count,
    row_number() over(partition by original.id order by latest.completion_sequence desc,latest.completed_at desc,latest.capture_job_id desc nulls last,latest.source_id desc) position
  from identities i join public.brand_sources original on original.id=i.id and original.workspace_id=p_workspace and original.brand_id=p_brand
  cross join lateral app_private.latest_knowledge_source_captures(original) latest
  join public.brand_sources replacement on replacement.id=latest.source_id and replacement.workspace_id=p_workspace and replacement.brand_id=p_brand
  where original.id<>replacement.id and original.content_sha256 is distinct from replacement.content_sha256
    and case when latest.available_sequence>0 or i.approved_sequence>0 then latest.available_sequence>i.approved_sequence
      else latest.available_at>i.approved_at end
 )
 -- At most one summary per approved source (at most 50). State the count when
 -- shared bytes had several changed origins; never imply the latest is all of them.
 select coalesce(jsonb_agg(jsonb_build_object('previous_source_id',previous_source_id,'latest_source_id',latest_source_id,
   'captured_at',completed_at,'kind',kind,'capture_job_id',capture_job_id,'changed_origin_count',changed_origin_count)
   order by previous_source_id),'[]'::jsonb) from changes where position=1;
$$;

commit;
