begin;

create or replace function app_private.insert_unknown_assertions(
  p_draft public.brand_knowledge_drafts, p_source public.brand_sources, p_actor uuid)
returns void language plpgsql set search_path = pg_catalog as $$
declare assertion_kind text;
begin
  foreach assertion_kind in array array['offering','location','fact','offer','visual_candidate','language'] loop
    if exists (
      select 1 from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
      where a.kind = assertion_kind) then
      continue;
    end if;
    insert into public.brand_assertions (
      workspace_id, brand_id, draft_id, source_id, job_id, kind, field_key, value_text, status,
      excerpt, locator, method, captured_at, created_by)
      values (
        p_draft.workspace_id, p_draft.brand_id, p_draft.id, p_source.id, p_source.job_id,
        assertion_kind, assertion_kind, null, 'unknown',
        'No ' || replace(assertion_kind, '_', ' ') || ' was supplied.', 'manual', 'manual', p_source.captured_at, p_actor);
  end loop;
end;
$$;
revoke all on function app_private.insert_unknown_assertions(public.brand_knowledge_drafts, public.brand_sources, uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.ask_from_gaps(p_draft public.brand_knowledge_drafts, p_actor uuid)
returns void language plpgsql set search_path = pg_catalog as $$
declare
  gap_kind text;
  prompt text;
  excerpt text;
begin
  foreach gap_kind in array array['offering','location','fact','offer','visual_candidate','language','voice','audience','positioning'] loop
    if exists (
      select 1 from public.brand_knowledge_questions q
      where q.workspace_id = p_draft.workspace_id and q.brand_id = p_draft.brand_id
        and q.target_kind = gap_kind and q.status = 'open') then
      continue;
    end if;
    if gap_kind in ('offering','location','fact','offer','visual_candidate','language') then
      if exists (
        select 1 from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
        where a.kind = gap_kind and a.status <> 'unknown') then
        continue;
      end if;
      prompt := case gap_kind
        when 'offering' then 'Which services or products should this brand advertise?'
        when 'location' then 'Where does this brand operate?'
        when 'fact' then 'Which operating facts should stay on the record?'
        when 'offer' then 'Which current offer, if any, may be stated, and when does it end?'
        when 'visual_candidate' then 'Which source image is only a visual candidate, not a reusable campaign asset?'
        else 'Which language should approved copy use?' end;
      excerpt := 'Missing ' || replace(gap_kind, '_', ' ') || '.';
    else
      if exists (
        select 1 from app_private.current_proposals(p_draft.workspace_id, p_draft.brand_id) p
        where p.kind = gap_kind and p.status <> 'unknown') then
        continue;
      end if;
      prompt := case gap_kind
        when 'audience' then 'Who is this offering for, in the operator''s words?'
        when 'voice' then 'Which existing phrases should future copy sound like?'
        else 'How should this brand be positioned against alternatives?' end;
      excerpt := 'Missing ' || gap_kind || ' evidence.';
    end if;
    insert into public.brand_knowledge_questions (
      workspace_id, brand_id, draft_id, prompt, target_kind, status, excerpt, created_by)
      values (p_draft.workspace_id, p_draft.brand_id, p_draft.id, prompt, gap_kind, 'open', excerpt, p_actor);
  end loop;
end;
$$;
revoke all on function app_private.ask_from_gaps(public.brand_knowledge_drafts, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.record_brand_extraction(p_source_id uuid, p_assertions jsonb, p_request_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  source public.brand_sources%rowtype;
  draft public.brand_knowledge_drafts%rowtype;
  actor uuid;
  item jsonb;
  item_kind text;
  item_field_key text;
  current_row public.brand_assertions%rowtype;
  ends_at timestamptz;
begin
  if p_source_id is null or p_assertions is null or jsonb_typeof(p_assertions) <> 'array'
    or jsonb_array_length(p_assertions) > 40
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  select * into source from public.brand_sources where id = p_source_id;
  if source.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  actor := source.created_by;
  perform app_private.lock_platform_workspace_for(actor, source.workspace_id);
  select * into source from public.brand_sources where id = p_source_id for update;
  if not app_private.platform_can_for(actor, source.workspace_id, source.brand_id, 'brand:write') then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  select * into draft from public.brand_knowledge_drafts
    where workspace_id = source.workspace_id and brand_id = source.brand_id for update;
  if draft.id is null then
    draft := app_private.ensure_knowledge_draft(source.workspace_id, source.brand_id, actor);
  end if;
  for item in select * from jsonb_array_elements(p_assertions) loop
    item_kind := coalesce(item->>'kind','');
    item_field_key := coalesce(item->>'field_key','');
    if item_kind not in ('offering','location','fact','offer','visual_candidate','language')
      or char_length(item_field_key) not between 1 and 120
      or coalesce(item->>'status','') not in ('observed','unknown')
      or coalesce(item->>'method','') not in ('data_attribute','html_image','html_lang','markdown_section','plaintext_labeled','visible_text')
      or coalesce(item->>'excerpt','') = ''
      or coalesce(item->>'method','') = 'manual'
      or (item->>'reusable') is distinct from 'false'
      or (coalesce(item->>'status','') = 'unknown' and nullif(item->>'value_text','') is not null)
      or (coalesce(item->>'status','') <> 'unknown' and nullif(item->>'value_text','') is null) then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    if coalesce(item->>'value_text','') ~* 'ignore (previous|all) instructions|you are now|delete_all|grant .{0,80}permission|system prompt|change permission|approved knowledge|millennial|boomer|gen[- ]?z|hispanic|latinx|african[- ]american|asian[- ]american|white neighborhood|urban poor|inner city'
      or item_field_key ~* 'ignore (previous|all) instructions|you are now|delete_all|grant .{0,80}permission|system prompt|change permission|approved knowledge' then
      continue;
    end if;
    ends_at := null;
    if item ? 'ends_at' and nullif(item->>'ends_at','') is not null then
      begin
        ends_at := (item->>'ends_at')::timestamptz;
      exception when others then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end;
    end if;
    select * into current_row from app_private.current_assertions(source.workspace_id, source.brand_id) a
      where a.kind = item_kind and a.field_key = item_field_key limit 1;
    if current_row.id is null and coalesce(item->>'status','') <> 'unknown' then
      select * into current_row from app_private.current_assertions(source.workspace_id, source.brand_id) a
        where a.kind = item_kind and a.status = 'unknown' limit 1;
    end if;
    if current_row.id is not null
      and current_row.value_text is not distinct from nullif(item->>'value_text','')
      and current_row.status is not distinct from item->>'status'
      and current_row.ends_at is not distinct from ends_at then
      continue;
    end if;
    insert into public.brand_assertions (
      workspace_id, brand_id, draft_id, source_id, job_id, kind, field_key, value_text, status,
      excerpt, locator, method, captured_at, ends_at, reusable, supersedes_id, created_by)
      values (
        source.workspace_id, source.brand_id, draft.id, source.id, source.job_id, item_kind, item_field_key,
        nullif(item->>'value_text',''), item->>'status', item->>'excerpt', coalesce(item->>'locator',''),
        item->>'method', source.captured_at, ends_at, false, current_row.id, actor);
  end loop;
  perform app_private.insert_unknown_assertions(draft, source, actor);
  perform app_private.bump_knowledge_draft(source.workspace_id, source.brand_id, actor);
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (source.workspace_id, 'system', null, 'platform.record_brand_extraction', 'platform_resource', source.id, p_request_id, '{}');
  return app_private.knowledge_review_view(source.workspace_id, source.brand_id, false);
end;
$$;
revoke all on function public.record_brand_extraction(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_brand_extraction(uuid, jsonb, text) to service_role;

commit;
