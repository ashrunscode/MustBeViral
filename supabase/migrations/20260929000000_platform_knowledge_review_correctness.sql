begin;

-- W2 review corrections. Existing assertions, proposals and approved snapshots stay immutable.
-- Match JavaScript/Zod string limits, including supplementary Unicode characters.
create function app_private.knowledge_utf16_length(p_value text)
returns integer language sql immutable strict set search_path = pg_catalog as $$
  select coalesce(sum(case when c = '' then 0 when ascii(c) > 65535 then 2 else 1 end), 0)::integer
  from regexp_split_to_table(p_value, '') c;
$$;
revoke all on function app_private.knowledge_utf16_length(text) from public, anon, authenticated, service_role;

create function app_private.knowledge_answer_excerpt(p_value text)
returns text language sql immutable strict set search_path = pg_catalog as $$
  select case when app_private.knowledge_utf16_length(p_value) <= 2000 then p_value
    else left(p_value, 960) || '… [Excerpt; full answer is retained.]' end;
$$;
revoke all on function app_private.knowledge_answer_excerpt(text) from public, anon, authenticated, service_role;

create or replace function app_private.supersede_kind_proposal(
  p_draft public.brand_knowledge_drafts, p_actor uuid, p_kind text, p_status text,
  p_value text, p_confidence text, p_evidence jsonb, p_excerpt text)
returns void language plpgsql set search_path = pg_catalog as $$
declare current_row public.brand_proposals%rowtype;
begin
  select * into current_row from app_private.current_proposals(p_draft.workspace_id, p_draft.brand_id) p
    where p.kind = p_kind limit 1;
  if current_row.id is not null
    and current_row.status is not distinct from p_status
    and current_row.value_text is not distinct from p_value
    and current_row.confidence is not distinct from p_confidence
    and current_row.evidence_field_keys is not distinct from coalesce(p_evidence, '[]'::jsonb)
    and current_row.excerpt is not distinct from p_excerpt then
    return;
  end if;
  insert into public.brand_proposals (
    workspace_id, brand_id, draft_id, kind, status, value_text, confidence, evidence_field_keys,
    excerpt, supersedes_id, created_by)
    values (
      p_draft.workspace_id, p_draft.brand_id, p_draft.id, p_kind, p_status, p_value, p_confidence,
      coalesce(p_evidence, '[]'::jsonb), p_excerpt, current_row.id, p_actor);
end;
$$;

create or replace function app_private.propose_from_assertions(p_draft public.brand_knowledge_drafts, p_actor uuid)
returns void language plpgsql set search_path = pg_catalog as $$
declare
  language_row public.brand_assertions%rowtype;
  audience_row public.brand_assertions%rowtype;
  offering_keys jsonb;
  offering_excerpt text;
  offering_value text;
begin
  select * into language_row from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
    where a.kind = 'language' and a.status <> 'unknown' limit 1;
  if language_row.id is not null then
    perform app_private.supersede_kind_proposal(
      p_draft, p_actor, 'voice', 'observed', language_row.value_text, 'medium',
      jsonb_build_array(language_row.field_key), language_row.excerpt);
  else
    perform app_private.supersede_kind_proposal(
      p_draft, p_actor, 'voice', 'unknown', null, null, '[]'::jsonb, 'No voice evidence was supplied.');
  end if;
  select * into audience_row from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
    where a.kind = 'fact' and a.field_key = 'audience' and a.status <> 'unknown' limit 1;
  if audience_row.id is not null then
    perform app_private.supersede_kind_proposal(
      p_draft, p_actor, 'audience', 'inferred', audience_row.value_text, 'low',
      jsonb_build_array(audience_row.field_key), audience_row.excerpt);
  else
    perform app_private.supersede_kind_proposal(
      p_draft, p_actor, 'audience', 'unknown', null, null, '[]'::jsonb,
      'Audience remains unknown. No demographic was assumed.');
  end if;
  select jsonb_agg(distinct a.field_key order by a.field_key),
         string_agg(a.value_text, '; ' order by a.created_at, a.id),
         min(a.excerpt)
    into offering_keys, offering_value, offering_excerpt
    from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
    where a.kind = 'offering' and a.status <> 'unknown';
  if app_private.knowledge_utf16_length(offering_value) > 8000 then
    perform app_private.supersede_kind_proposal(
      p_draft, p_actor, 'positioning', 'unknown', null, null, coalesce(offering_keys, '[]'::jsonb),
      'Offerings exceed the summary limit. Review the linked evidence and supply a shorter positioning summary.');
  elsif offering_value is not null then
    perform app_private.supersede_kind_proposal(
      p_draft, p_actor, 'positioning', 'inferred', offering_value, 'low',
      coalesce(offering_keys, '[]'::jsonb), offering_excerpt);
  else
    perform app_private.supersede_kind_proposal(
      p_draft, p_actor, 'positioning', 'unknown', null, null, '[]'::jsonb,
      'Positioning remains unknown until offerings are observed.');
  end if;
end;
$$;

-- The command/extraction transaction already owns the workspace lock. The draft lock also
-- serializes privileged inserts so overflow rolls back the assertion and its invalidations.
create function app_private.check_assertion_review()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare draft public.brand_knowledge_drafts%rowtype; proposal public.brand_proposals%rowtype;
begin
  select * into draft from public.brand_knowledge_drafts
    where workspace_id = new.workspace_id and brand_id = new.brand_id for update;
  if app_private.knowledge_utf16_length(new.field_key) > 120
    or app_private.knowledge_utf16_length(new.value_text) > 8000
    or app_private.knowledge_utf16_length(new.excerpt) > 2000
    or app_private.knowledge_utf16_length(new.locator) > 500
    or (select count(*) from app_private.current_assertions(new.workspace_id, new.brand_id)) > 50 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  for proposal in select * from app_private.current_proposals(new.workspace_id, new.brand_id) p
    where (new.kind = 'offering' and p.kind = 'positioning')
      or (new.kind = 'language' and p.kind = 'voice')
      or (new.kind = 'fact' and new.field_key = 'audience' and p.kind = 'audience')
      or p.evidence_field_keys ? new.field_key loop
    perform app_private.supersede_kind_proposal(draft, new.created_by, proposal.kind,
      'unknown', null, null, proposal.evidence_field_keys,
      'Source evidence changed. Generate and review this proposal again before using it.');
  end loop;
  return new;
end;
$$;
revoke all on function app_private.check_assertion_review() from public, anon, authenticated, service_role;
create trigger brand_assertion_review after insert on public.brand_assertions
  for each row execute function app_private.check_assertion_review();

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
    item_ends_at := null;
    if item ? 'ends_at' and nullif(item->>'ends_at','') is not null then
      begin
        item_ends_at := (item->>'ends_at')::timestamptz;
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
      if exists(select 1 from app_private.current_assertions(source.workspace_id, source.brand_id) a
        where a.kind = item_kind) then continue; end if;
    else
      -- Only an initial missing-kind placeholder can be superseded automatically.
      -- Known claims and explicit operator-cleared revisions remain independently current.
      select * into current_row from app_private.current_assertions(source.workspace_id, source.brand_id) a
        where a.kind = item_kind and a.status = 'unknown' and a.supersedes_id is null
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

-- The old application version must fail closed: it cannot identify the initiating actor.
-- Retain its signature for schema-compatible rollback, without any application execute grant.
create or replace function public.record_brand_extraction(p_source_id uuid, p_assertions jsonb, p_request_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
begin raise exception using errcode = '42501', message = 'FORBIDDEN'; end;
$$;
revoke all on function public.record_brand_extraction(uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.record_brand_extraction(uuid, jsonb, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_brand_extraction(uuid, jsonb, text, uuid) to service_role;

-- Preserve command authorization, idempotency and snapshots; change only answer excerpts and expiry conflicts.
create or replace function public.platform_knowledge_command(p_operation text, p_input jsonb, p_idempotency_key text, p_request_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid(); ws uuid; br uuid; required text[]; optional text[] := '{}';
  payload_hash text; replay public.idempotency_records%rowtype; job public.brand_source_jobs%rowtype;
  brand_data jsonb; draft public.brand_knowledge_drafts%rowtype; source public.brand_sources%rowtype;
  candidate public.brand_knowledge_candidates%rowtype; pending boolean := false; result jsonb;
  assertion public.brand_assertions%rowtype; question_row public.brand_knowledge_questions%rowtype;
  approved public.brand_versions%rowtype; pin public.brand_version_pins%rowtype;
  extract_pending boolean := false; next_version integer; computed_hash text;
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
    when 'extract_brand_knowledge' then required := array['workspace_id','brand_id','source_id'];
    when 'propose_brand_knowledge' then required := array['workspace_id','brand_id'];
    when 'correct_brand_assertion' then required := array['workspace_id','brand_id','assertion_id','expected_version','value_text','excerpt']; optional := array['locator','ends_at'];
    when 'ask_brand_knowledge_questions' then required := array['workspace_id','brand_id'];
    when 'answer_brand_knowledge_question' then required := array['workspace_id','brand_id','question_id','expected_version','answer_text'];
    when 'approve_brand_version' then required := array['workspace_id','brand_id','expected_version','draft_hash'];
    when 'pin_brand_version' then required := array['workspace_id','brand_id','pin_key','brand_version_id'];
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
    if p_operation in (
      'correct_knowledge_candidate','start_manual_knowledge_draft','propose_brand_knowledge',
      'correct_brand_assertion','ask_brand_knowledge_questions','answer_brand_knowledge_question',
      'approve_brand_version','pin_brand_version') then
      return replay.response_payload;
    end if;
    if p_operation = 'extract_brand_knowledge' then
      select * into source from public.brand_sources
        where workspace_id = ws and brand_id = br and id = (p_input->>'source_id')::uuid;
      extract_pending := source.id is not null and source.r2_key is not null and not exists (
        select 1 from app_private.current_assertions(ws, br) a where a.source_id = source.id and a.method <> 'manual');
      return app_private.knowledge_review_view(ws, br, extract_pending);
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
    when 'extract_brand_knowledge' then
      select * into source from public.brand_sources
        where workspace_id = ws and brand_id = br and id = (p_input->>'source_id')::uuid for update;
      if source.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      select * into draft from public.brand_knowledge_drafts where workspace_id = ws and brand_id = br for update;
      if draft.id is null then
        draft := app_private.ensure_knowledge_draft(ws, br, actor);
      end if;
      if source.r2_key is null then
        perform app_private.insert_unknown_assertions(draft, source, actor);
        perform app_private.bump_knowledge_draft(ws, br, actor);
        extract_pending := false;
      else
        extract_pending := not exists (
          select 1 from app_private.current_assertions(ws, br) a
          where a.source_id = source.id and a.method <> 'manual');
      end if;
      result := app_private.knowledge_review_view(ws, br, extract_pending);
    when 'propose_brand_knowledge' then
      select * into draft from public.brand_knowledge_drafts where workspace_id = ws and brand_id = br for update;
      if draft.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      perform app_private.propose_from_assertions(draft, actor);
      perform app_private.bump_knowledge_draft(ws, br, actor);
      result := app_private.knowledge_review_view(ws, br, false);
    when 'correct_brand_assertion' then
      select * into assertion from public.brand_assertions
        where workspace_id = ws and brand_id = br and id = (p_input->>'assertion_id')::uuid for update;
      if assertion.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if exists(select 1 from public.brand_assertions later
        where later.workspace_id = ws and later.supersedes_id = assertion.id) then
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
      insert into public.brand_assertions (
        workspace_id, brand_id, draft_id, source_id, job_id, kind, field_key, value_text, status, excerpt, locator,
        method, captured_at, ends_at, reusable, supersedes_id, created_by)
        values (ws, br, draft.id, source.id, job.id, assertion.kind, assertion.field_key, p_input->>'value_text',
          case when p_input->>'value_text' is null then 'unknown' else 'corrected' end,
          p_input->>'excerpt', coalesce(p_input->>'locator', 'manual'), 'manual', source.captured_at,
          case when p_input ? 'ends_at' then (p_input->>'ends_at')::timestamptz else assertion.ends_at end,
          false, assertion.id, actor);
      perform app_private.bump_knowledge_draft(ws, br, actor);
      result := app_private.knowledge_review_view(ws, br, false);
    when 'ask_brand_knowledge_questions' then
      select * into draft from public.brand_knowledge_drafts where workspace_id = ws and brand_id = br for update;
      if draft.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      perform app_private.ask_from_gaps(draft, actor);
      perform app_private.bump_knowledge_draft(ws, br, actor);
      result := app_private.knowledge_review_view(ws, br, false);
    when 'answer_brand_knowledge_question' then
      select * into question_row from public.brand_knowledge_questions
        where workspace_id = ws and brand_id = br and id = (p_input->>'question_id')::uuid for update;
      if question_row.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if question_row.status <> 'open' then raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT'; end if;
      select * into draft from public.brand_knowledge_drafts where workspace_id = ws and brand_id = br for update;
      if draft.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if draft.version <> (p_input->>'expected_version')::integer then
        raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
      end if;
      update public.brand_knowledge_questions
        set status = 'answered', answer_text = p_input->>'answer_text'
        where id = question_row.id;
      insert into public.brand_source_jobs (workspace_id, brand_id, kind, status, created_by)
        values (ws, br, 'manual', 'captured', actor) returning * into job;
      insert into public.brand_sources (workspace_id, brand_id, job_id, kind, method, captured_at, created_by)
        values (ws, br, job.id, 'manual', 'manual', statement_timestamp(), actor) returning * into source;
      update public.brand_source_jobs set source_id = source.id, updated_at = clock_timestamp() where id = job.id;
      if question_row.target_kind in ('offering','location','fact','offer','visual_candidate','language') then
        select * into assertion from app_private.current_assertions(ws, br) a
          where a.kind = question_row.target_kind limit 1;
        insert into public.brand_assertions (
          workspace_id, brand_id, draft_id, source_id, job_id, kind, field_key, value_text, status, excerpt, locator,
          method, captured_at, reusable, supersedes_id, created_by)
          values (ws, br, draft.id, source.id, job.id, question_row.target_kind,
            coalesce(assertion.field_key, question_row.target_kind), p_input->>'answer_text', 'corrected',
            app_private.knowledge_answer_excerpt(p_input->>'answer_text'), 'question', 'manual', source.captured_at, false, assertion.id, actor);
      else
        perform app_private.supersede_kind_proposal(
          draft, actor, question_row.target_kind, 'corrected', p_input->>'answer_text', 'medium',
          '[]'::jsonb, app_private.knowledge_answer_excerpt(p_input->>'answer_text'));
      end if;
      perform app_private.bump_knowledge_draft(ws, br, actor);
      result := app_private.knowledge_review_view(ws, br, false);
    when 'approve_brand_version' then
      select * into draft from public.brand_knowledge_drafts where workspace_id = ws and brand_id = br for update;
      if draft.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      if draft.version <> (p_input->>'expected_version')::integer then
        raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
      end if;
      computed_hash := app_private.knowledge_draft_hash(ws, br);
      if computed_hash is distinct from p_input->>'draft_hash' then
        raise exception using errcode = 'P0001', message = 'REVISION_CONFLICT';
      end if;
      if exists (
        select 1 from app_private.current_assertions(ws, br) a
        where a.kind = 'offer' and a.status <> 'unknown' and a.ends_at is not null
          and a.ends_at < statement_timestamp()) then
        raise exception using errcode = 'P0001', message = 'EXPIRED_OFFER';
      end if;
      if exists (
        select 1 from app_private.current_assertions(ws, br) a
        join app_private.current_assertions(ws, br) b
          on a.kind = b.kind and a.field_key = b.field_key and a.id < b.id
        where a.value_text is distinct from b.value_text
          or (a.kind = 'offer' and a.ends_at is distinct from b.ends_at))
        or exists (
          select 1 from app_private.current_assertions(ws, br) a where a.status = 'disputed') then
        raise exception using errcode = 'P0001', message = 'CONTRADICTORY_KNOWLEDGE';
      end if;
      select coalesce(max(v.version), 0) + 1 into next_version
        from public.brand_versions v where v.workspace_id = ws and v.brand_id = br;
      insert into public.brand_versions (
        workspace_id, brand_id, version, draft_id, draft_hash, status, snapshot, approved_by)
        values (
          ws, br, next_version, draft.id, computed_hash, 'approved',
          jsonb_build_object(
            'assertions', coalesce((
              select jsonb_agg(app_private.brand_assertion_json(a) order by a.created_at, a.id)
              from app_private.current_assertions(ws, br) a), '[]'::jsonb),
            'proposals', coalesce((
              select jsonb_agg(app_private.brand_proposal_json(p) order by p.created_at, p.id)
              from app_private.current_proposals(ws, br) p), '[]'::jsonb)),
          actor)
        returning * into approved;
      result := jsonb_build_object('record', app_private.brand_version_json(approved));
    when 'pin_brand_version' then
      select * into approved from public.brand_versions
        where workspace_id = ws and brand_id = br and id = (p_input->>'brand_version_id')::uuid;
      if approved.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      begin
        insert into public.brand_version_pins (workspace_id, brand_id, pin_key, brand_version_id, created_by)
          values (ws, br, p_input->>'pin_key', approved.id, actor)
          returning * into pin;
      exception when unique_violation then
        select * into pin from public.brand_version_pins
          where workspace_id = ws and brand_id = br and pin_key = p_input->>'pin_key';
        if pin.brand_version_id is distinct from approved.id then
          raise exception using errcode = 'P0001', message = 'RESOURCE_CONFLICT';
        end if;
      end;
      result := jsonb_build_object(
        'record', app_private.brand_version_pin_json(pin),
        'brand_version', app_private.brand_version_json(approved));
  end case;
  insert into public.idempotency_records (workspace_id, actor_id, operation, idempotency_key, request_hash, response_payload)
    values (ws, actor, p_operation, p_idempotency_key, payload_hash, result);
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (ws, 'user', actor, 'platform.' || p_operation, 'platform_resource', coalesce(job.id, approved.id, draft.id), p_request_id, '{}');
  return result;
end;
$$;

commit;
