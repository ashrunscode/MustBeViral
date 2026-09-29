begin;

-- Preserve explicit catalog unknowns without changing the forty-record machine bound,
-- actor checks, locks, immutable source history or generated missing-kind behavior.
create or replace function public.record_brand_extraction(p_source_id uuid, p_assertions jsonb, p_request_id text, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  source public.brand_sources%rowtype;
  draft public.brand_knowledge_drafts%rowtype;
  actor uuid := p_actor_id;
  item jsonb;
  item_kind text;
  item_field_key text;
  current_row public.brand_assertions%rowtype;
  item_ends_at timestamptz;
begin
  if p_actor_id is null or p_source_id is null or p_assertions is null or jsonb_typeof(p_assertions) <> 'array'
    or jsonb_array_length(p_assertions) > 40
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  select * into source from public.brand_sources where id = p_source_id;
  if source.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  perform app_private.lock_platform_workspace_for(actor, source.workspace_id);
  select * into source from public.brand_sources where id = p_source_id for update;
  if not app_private.platform_can_for(actor, source.workspace_id, source.brand_id, 'brand:write')
    or not exists(select 1 from public.brands b where b.workspace_id = source.workspace_id and b.id = source.brand_id and b.status = 'active') then
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
      or coalesce(item->>'status','') not in ('observed','unknown','disputed')
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
    item_ends_at := null;
    if item ? 'ends_at' and nullif(item->>'ends_at','') is not null then
      begin
        item_ends_at := app_private.parse_knowledge_expiry(item->>'ends_at');
      exception when others then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end;
    end if;
    -- Replayed bytes must not resurrect an observation that an operator corrected.
    -- Equal observations from different sources still retain their independent provenance.
    if exists (select 1 from public.brand_assertions a
      where a.workspace_id = source.workspace_id and a.brand_id = source.brand_id and a.source_id = source.id
        and a.kind = item_kind and a.field_key = item_field_key
        and a.value_text is not distinct from nullif(item->>'value_text','')
        and a.status = item->>'status' and a.ends_at is not distinct from item_ends_at
        and a.excerpt = item->>'excerpt' and a.locator = coalesce(item->>'locator','')
        and a.method = item->>'method' and a.captured_at = source.captured_at) then
      continue;
    end if;
    current_row := null;
    if item->>'status' = 'unknown' then
      -- Explicit blank CSV records are evidence about that field, not a missing-kind placeholder.
      if not (item->>'method' = 'plaintext_labeled' and coalesce(item->>'locator','') ~ '^csv:record:[0-9]+;column:value$')
        and exists(select 1 from app_private.current_assertions(source.workspace_id, source.brand_id) a
        where a.kind = item_kind) then continue; end if;
    else
      -- Only an initial missing-kind placeholder can be superseded automatically.
      -- Known claims and explicit operator-cleared revisions remain independently current.
      select * into current_row from app_private.current_assertions(source.workspace_id, source.brand_id) a
        where a.kind = item_kind and a.status = 'unknown' and a.supersedes_id is null
          and not (a.method = 'plaintext_labeled' and a.locator ~ '^csv:record:[0-9]+;column:value$')
          and (a.method <> 'manual' or (a.field_key = a.kind and a.locator = 'manual'
            and a.excerpt = 'No ' || replace(a.kind, '_', ' ') || ' was supplied.'))
        limit 1;
    end if;
    insert into public.brand_assertions (
      workspace_id, brand_id, draft_id, source_id, job_id, kind, field_key, value_text, status,
      excerpt, locator, method, captured_at, ends_at, reusable, supersedes_id, created_by)
      values (
        source.workspace_id, source.brand_id, draft.id, source.id, source.job_id, item_kind, item_field_key,
        nullif(item->>'value_text',''), item->>'status', item->>'excerpt', coalesce(item->>'locator',''),
        item->>'method', source.captured_at, item_ends_at, false, current_row.id, actor);
  end loop;
  perform app_private.insert_unknown_assertions(draft, source, actor);
  perform app_private.bump_knowledge_draft(source.workspace_id, source.brand_id, actor);
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (source.workspace_id, 'system', null, 'platform.record_brand_extraction', 'platform_resource', source.id, p_request_id, '{}');
  return app_private.knowledge_review_view(source.workspace_id, source.brand_id, false);
end;
$$;

commit;
