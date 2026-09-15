begin;

create table public.brand_assertions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  draft_id uuid not null,
  source_id uuid not null,
  job_id uuid,
  kind text not null check (kind in ('offering','location','fact','offer','visual_candidate','language')),
  field_key text not null check (char_length(field_key) between 1 and 120),
  value_text text check (value_text is null or char_length(value_text) <= 8000),
  status text not null check (status in ('observed','unknown','corrected','disputed')),
  excerpt text not null check (char_length(excerpt) <= 2000),
  locator text not null default '' check (char_length(locator) <= 500),
  method text not null check (method in (
    'data_attribute','html_image','html_lang','markdown_section','plaintext_labeled','visible_text','manual')),
  captured_at timestamptz not null,
  ends_at timestamptz,
  reusable boolean not null default false check (reusable = false),
  supersedes_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id) references public.brand_knowledge_drafts(workspace_id, brand_id) on delete restrict,
  foreign key (workspace_id, source_id) references public.brand_sources(workspace_id, id) on delete restrict,
  foreign key (workspace_id, job_id) references public.brand_source_jobs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, supersedes_id) references public.brand_assertions(workspace_id, id) on delete restrict,
  check ((status = 'unknown' and value_text is null) or (status <> 'unknown' and value_text is not null)),
  check (kind <> 'visual_candidate' or reusable = false)
);
comment on table public.brand_assertions is
  'Typed W2.2 assertions. Visual candidates cannot be marked reusable. Current rows have no successor.';
create index brand_assertions_page on public.brand_assertions (workspace_id, brand_id, created_at, id);
create index brand_assertions_created_by_fk on public.brand_assertions (created_by);
create index brand_assertions_workspace_source_fk on public.brand_assertions (workspace_id, source_id);
create index brand_assertions_workspace_job_fk on public.brand_assertions (workspace_id, job_id);
create index brand_assertions_supersedes on public.brand_assertions (workspace_id, supersedes_id);

create table public.brand_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  draft_id uuid not null,
  kind text not null check (kind in ('voice','audience','positioning')),
  status text not null check (status in ('observed','inferred','unknown','corrected')),
  value_text text check (value_text is null or char_length(value_text) <= 8000),
  confidence text check (confidence is null or confidence in ('low','medium','high')),
  evidence_field_keys jsonb not null default '[]'::jsonb,
  excerpt text not null check (char_length(excerpt) <= 2000),
  supersedes_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id) references public.brand_knowledge_drafts(workspace_id, brand_id) on delete restrict,
  foreign key (workspace_id, supersedes_id) references public.brand_proposals(workspace_id, id) on delete restrict,
  check ((status = 'unknown' and value_text is null and confidence is null)
    or (status <> 'unknown' and value_text is not null)),
  check (jsonb_typeof(evidence_field_keys) = 'array')
);
comment on table public.brand_proposals is
  'Voice, audience and positioning proposals. Inferred rows stay labeled until an approved brand version.';
create index brand_proposals_page on public.brand_proposals (workspace_id, brand_id, created_at, id);
create index brand_proposals_created_by_fk on public.brand_proposals (created_by);
create index brand_proposals_supersedes on public.brand_proposals (workspace_id, supersedes_id);

create table public.brand_knowledge_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  draft_id uuid not null,
  prompt text not null check (char_length(prompt) between 1 and 500),
  target_kind text not null check (target_kind in (
    'offering','location','fact','offer','visual_candidate','language','voice','audience','positioning')),
  status text not null check (status in ('open','answered')),
  answer_text text check (answer_text is null or char_length(answer_text) <= 4000),
  excerpt text not null check (char_length(excerpt) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id) references public.brand_knowledge_drafts(workspace_id, brand_id) on delete restrict,
  check ((status = 'open' and answer_text is null) or (status = 'answered' and answer_text is not null))
);
comment on table public.brand_knowledge_questions is
  'Targeted operator questions for missing evidence. They do not auto-approve knowledge.';
create index brand_knowledge_questions_page on public.brand_knowledge_questions (workspace_id, brand_id, created_at, id);
create index brand_knowledge_questions_created_by_fk on public.brand_knowledge_questions (created_by);

create table public.brand_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  version integer not null check (version > 0),
  draft_id uuid not null,
  draft_hash text not null check (draft_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status = 'approved'),
  snapshot jsonb not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, brand_id, version),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id) references public.brand_knowledge_drafts(workspace_id, brand_id) on delete restrict
);
comment on table public.brand_versions is
  'Immutable owner-approved brand snapshots. Corrections create a new version.';
create index brand_versions_page on public.brand_versions (workspace_id, brand_id, created_at, id);
create index brand_versions_approved_by_fk on public.brand_versions (approved_by);

create table public.brand_version_pins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  pin_key text not null check (char_length(pin_key) between 1 and 120 and pin_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'),
  brand_version_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, brand_id, pin_key),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_version_id) references public.brand_versions(workspace_id, id) on delete restrict
);
comment on table public.brand_version_pins is
  'Campaign pins to an approved brand version. Reads return the pinned snapshot after later drafts change.';
create index brand_version_pins_created_by_fk on public.brand_version_pins (created_by);
create index brand_version_pins_version_fk on public.brand_version_pins (workspace_id, brand_version_id);

do $$ declare t text; begin
  foreach t in array array['brand_assertions','brand_proposals','brand_knowledge_questions','brand_versions','brand_version_pins'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
create trigger immutable_brand_assertions before update or delete on public.brand_assertions
  for each row execute function app_private.reject_immutable_mutation();
create trigger immutable_brand_proposals before update or delete on public.brand_proposals
  for each row execute function app_private.reject_immutable_mutation();
create function app_private.protect_knowledge_question()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'KNOWLEDGE_QUESTION_IMMUTABLE';
  end if;
  if old.status <> 'open' or new.status <> 'answered'
    or (to_jsonb(new) - array['status','answer_text']) is distinct from (to_jsonb(old) - array['status','answer_text']) then
    raise exception using errcode = '55000', message = 'KNOWLEDGE_QUESTION_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_knowledge_question()
  from public, anon, authenticated, service_role;
create trigger protect_knowledge_question before update or delete on public.brand_knowledge_questions
  for each row execute function app_private.protect_knowledge_question();
create trigger immutable_brand_versions before update or delete on public.brand_versions
  for each row execute function app_private.reject_immutable_mutation();
create trigger immutable_brand_version_pins before update or delete on public.brand_version_pins
  for each row execute function app_private.reject_immutable_mutation();
create policy assertion_read on public.brand_assertions for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy proposal_read on public.brand_proposals for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy question_read on public.brand_knowledge_questions for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy brand_version_read on public.brand_versions for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy brand_version_pin_read on public.brand_version_pins for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'brand:read'));

create function app_private.brand_assertion_json(p_row public.brand_assertions)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_row.id, 'workspace_id', p_row.workspace_id, 'brand_id', p_row.brand_id,
    'draft_id', p_row.draft_id, 'source_id', p_row.source_id, 'job_id', p_row.job_id,
    'kind', p_row.kind, 'field_key', p_row.field_key, 'value_text', p_row.value_text,
    'status', p_row.status, 'excerpt', p_row.excerpt, 'locator', p_row.locator,
    'method', p_row.method, 'captured_at', p_row.captured_at, 'ends_at', p_row.ends_at,
    'reusable', false, 'supersedes_id', p_row.supersedes_id,
    'created_by', p_row.created_by, 'created_at', p_row.created_at);
$$;
create function app_private.brand_proposal_json(p_row public.brand_proposals)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_row.id, 'workspace_id', p_row.workspace_id, 'brand_id', p_row.brand_id,
    'draft_id', p_row.draft_id, 'kind', p_row.kind, 'status', p_row.status,
    'value_text', p_row.value_text, 'confidence', p_row.confidence,
    'evidence_field_keys', p_row.evidence_field_keys, 'excerpt', p_row.excerpt,
    'supersedes_id', p_row.supersedes_id, 'created_by', p_row.created_by, 'created_at', p_row.created_at);
$$;
create function app_private.brand_question_json(p_row public.brand_knowledge_questions)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_row.id, 'workspace_id', p_row.workspace_id, 'brand_id', p_row.brand_id,
    'draft_id', p_row.draft_id, 'prompt', p_row.prompt, 'target_kind', p_row.target_kind,
    'status', p_row.status, 'answer_text', p_row.answer_text, 'excerpt', p_row.excerpt,
    'created_by', p_row.created_by, 'created_at', p_row.created_at);
$$;
create function app_private.current_assertions(p_workspace_id uuid, p_brand_id uuid)
returns setof public.brand_assertions language sql stable set search_path = pg_catalog as $$
  select a.* from public.brand_assertions a
  where a.workspace_id = p_workspace_id and a.brand_id = p_brand_id
    and not exists (
      select 1 from public.brand_assertions later
      where later.workspace_id = a.workspace_id and later.supersedes_id = a.id)
  order by a.created_at, a.id;
$$;
create function app_private.current_proposals(p_workspace_id uuid, p_brand_id uuid)
returns setof public.brand_proposals language sql stable set search_path = pg_catalog as $$
  select p.* from public.brand_proposals p
  where p.workspace_id = p_workspace_id and p.brand_id = p_brand_id
    and not exists (
      select 1 from public.brand_proposals later
      where later.workspace_id = p.workspace_id and later.supersedes_id = p.id)
  order by p.created_at, p.id;
$$;
create function app_private.brand_version_json(p_row public.brand_versions)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_row.id, 'workspace_id', p_row.workspace_id, 'brand_id', p_row.brand_id,
    'version', p_row.version, 'draft_id', p_row.draft_id, 'draft_hash', p_row.draft_hash,
    'status', p_row.status, 'snapshot', p_row.snapshot, 'approved_by', p_row.approved_by,
    'approved_at', p_row.approved_at, 'created_at', p_row.created_at);
$$;
create function app_private.brand_version_pin_json(p_row public.brand_version_pins)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p_row.id, 'workspace_id', p_row.workspace_id, 'brand_id', p_row.brand_id,
    'pin_key', p_row.pin_key, 'brand_version_id', p_row.brand_version_id,
    'created_by', p_row.created_by, 'created_at', p_row.created_at);
$$;
revoke all on function app_private.brand_assertion_json(public.brand_assertions),
  app_private.brand_proposal_json(public.brand_proposals),
  app_private.brand_question_json(public.brand_knowledge_questions),
  app_private.current_assertions(uuid, uuid),
  app_private.current_proposals(uuid, uuid),
  app_private.brand_version_json(public.brand_versions),
  app_private.brand_version_pin_json(public.brand_version_pins)
  from public, anon, authenticated, service_role;

create function app_private.knowledge_draft_hash(p_workspace_id uuid, p_brand_id uuid)
returns text language sql stable set search_path = pg_catalog as $$
  select app_private.hash_canonical_json(jsonb_build_object(
    'draft', (
      select jsonb_build_object('id', d.id, 'version', d.version)
      from public.brand_knowledge_drafts d
      where d.workspace_id = p_workspace_id and d.brand_id = p_brand_id),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'field_key', c.field_key, 'value_text', c.value_text, 'status', c.status)
        order by c.created_at, c.id)
      from public.brand_knowledge_candidates c
      where c.workspace_id = p_workspace_id and c.brand_id = p_brand_id
        and not exists (
          select 1 from public.brand_knowledge_candidates later
          where later.workspace_id = c.workspace_id and later.supersedes_id = c.id)
    ), '[]'::jsonb),
    'assertions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'field_key', a.field_key, 'value_text', a.value_text,
        'status', a.status, 'ends_at', a.ends_at)
        order by a.created_at, a.id)
      from app_private.current_assertions(p_workspace_id, p_brand_id) a
    ), '[]'::jsonb),
    'proposals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'value_text', p.value_text, 'status', p.status)
        order by p.created_at, p.id)
      from app_private.current_proposals(p_workspace_id, p_brand_id) p
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'prompt', q.prompt, 'status', q.status, 'answer_text', q.answer_text)
        order by q.created_at, q.id)
      from public.brand_knowledge_questions q
      where q.workspace_id = p_workspace_id and q.brand_id = p_brand_id
    ), '[]'::jsonb)));
$$;
revoke all on function app_private.knowledge_draft_hash(uuid, uuid)
  from public, anon, authenticated, service_role;

create function app_private.knowledge_review_view(
  p_workspace_id uuid, p_brand_id uuid, p_extract_pending boolean default false)
returns jsonb language plpgsql stable set search_path = pg_catalog as $$
declare
  draft public.brand_knowledge_drafts%rowtype;
  approved public.brand_versions%rowtype;
  assertions jsonb := '[]'::jsonb;
  proposals jsonb := '[]'::jsonb;
  questions jsonb := '[]'::jsonb;
begin
  select * into draft from public.brand_knowledge_drafts
    where workspace_id = p_workspace_id and brand_id = p_brand_id;
  select jsonb_agg(app_private.brand_assertion_json(a) order by a.created_at, a.id)
    into assertions from app_private.current_assertions(p_workspace_id, p_brand_id) a;
  select jsonb_agg(app_private.brand_proposal_json(p) order by p.created_at, p.id)
    into proposals from app_private.current_proposals(p_workspace_id, p_brand_id) p;
  select jsonb_agg(app_private.brand_question_json(q) order by q.created_at, q.id)
    into questions from public.brand_knowledge_questions q
    where q.workspace_id = p_workspace_id and q.brand_id = p_brand_id;
  select * into approved from public.brand_versions
    where workspace_id = p_workspace_id and brand_id = p_brand_id
    order by version desc limit 1;
  return jsonb_build_object(
    'record', case when draft.id is null then null else to_jsonb(draft) end,
    'draft_hash', case when draft.id is null then null else app_private.knowledge_draft_hash(p_workspace_id, p_brand_id) end,
    'current_assertions', coalesce(assertions, '[]'::jsonb),
    'current_proposals', coalesce(proposals, '[]'::jsonb),
    'current_questions', coalesce(questions, '[]'::jsonb),
    'approved_version', case when approved.id is null then null else app_private.brand_version_json(approved) end,
    'extract_pending', p_extract_pending,
    'next_cursor', null);
end;
$$;
revoke all on function app_private.knowledge_review_view(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;

create function app_private.bump_knowledge_draft(p_workspace_id uuid, p_brand_id uuid, p_actor uuid)
returns public.brand_knowledge_drafts language plpgsql set search_path = pg_catalog as $$
declare draft public.brand_knowledge_drafts%rowtype;
begin
  update public.brand_knowledge_drafts
    set version = version + 1, updated_by = p_actor, updated_at = clock_timestamp()
    where workspace_id = p_workspace_id and brand_id = p_brand_id
    returning * into draft;
  if draft.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  return draft;
end;
$$;
revoke all on function app_private.bump_knowledge_draft(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create function app_private.insert_unknown_assertions(
  p_draft public.brand_knowledge_drafts, p_source public.brand_sources, p_actor uuid)
returns void language plpgsql set search_path = pg_catalog as $$
declare kind text;
begin
  foreach kind in array array['offering','location','fact','offer','visual_candidate','language'] loop
    if exists (
      select 1 from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
      where a.kind = kind) then
      continue;
    end if;
    insert into public.brand_assertions (
      workspace_id, brand_id, draft_id, source_id, job_id, kind, field_key, value_text, status,
      excerpt, locator, method, captured_at, created_by)
      values (
        p_draft.workspace_id, p_draft.brand_id, p_draft.id, p_source.id, p_source.job_id, kind, kind, null, 'unknown',
        'No ' || replace(kind, '_', ' ') || ' was supplied.', 'manual', 'manual', p_source.captured_at, p_actor);
  end loop;
end;
$$;
revoke all on function app_private.insert_unknown_assertions(public.brand_knowledge_drafts, public.brand_sources, uuid)
  from public, anon, authenticated, service_role;

create function app_private.supersede_kind_proposal(
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
    and current_row.confidence is not distinct from p_confidence then
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
revoke all on function app_private.supersede_kind_proposal(public.brand_knowledge_drafts, uuid, text, text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;

create function app_private.propose_from_assertions(p_draft public.brand_knowledge_drafts, p_actor uuid)
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
  select jsonb_agg(a.field_key order by a.created_at, a.id),
         string_agg(a.value_text, '; ' order by a.created_at, a.id),
         min(a.excerpt)
    into offering_keys, offering_value, offering_excerpt
    from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
    where a.kind = 'offering' and a.status <> 'unknown';
  if offering_value is not null then
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
revoke all on function app_private.propose_from_assertions(public.brand_knowledge_drafts, uuid)
  from public, anon, authenticated, service_role;

create function app_private.ask_from_gaps(p_draft public.brand_knowledge_drafts, p_actor uuid)
returns void language plpgsql set search_path = pg_catalog as $$
declare
  kind text;
  prompt text;
  excerpt text;
begin
  foreach kind in array array['offering','location','fact','offer','visual_candidate','language','voice','audience','positioning'] loop
    if exists (
      select 1 from public.brand_knowledge_questions q
      where q.workspace_id = p_draft.workspace_id and q.brand_id = p_draft.brand_id
        and q.target_kind = kind and q.status = 'open') then
      continue;
    end if;
    if kind in ('offering','location','fact','offer','visual_candidate','language') then
      if exists (
        select 1 from app_private.current_assertions(p_draft.workspace_id, p_draft.brand_id) a
        where a.kind = kind and a.status <> 'unknown') then
        continue;
      end if;
      prompt := case kind
        when 'offering' then 'Which services or products should this brand advertise?'
        when 'location' then 'Where does this brand operate?'
        when 'fact' then 'Which operating facts should stay on the record?'
        when 'offer' then 'Which current offer, if any, may be stated, and when does it end?'
        when 'visual_candidate' then 'Which source image is only a visual candidate, not a reusable campaign asset?'
        else 'Which language should approved copy use?' end;
      excerpt := 'Missing ' || replace(kind, '_', ' ') || '.';
    else
      if exists (
        select 1 from app_private.current_proposals(p_draft.workspace_id, p_draft.brand_id) p
        where p.kind = kind and p.status <> 'unknown') then
        continue;
      end if;
      prompt := case kind
        when 'audience' then 'Who is this offering for, in the operator''s words?'
        when 'voice' then 'Which existing phrases should future copy sound like?'
        else 'How should this brand be positioned against alternatives?' end;
      excerpt := 'Missing ' || kind || ' evidence.';
    end if;
    insert into public.brand_knowledge_questions (
      workspace_id, brand_id, draft_id, prompt, target_kind, status, excerpt, created_by)
      values (p_draft.workspace_id, p_draft.brand_id, p_draft.id, prompt, kind, 'open', excerpt, p_actor);
  end loop;
end;
$$;
revoke all on function app_private.ask_from_gaps(public.brand_knowledge_drafts, uuid)
  from public, anon, authenticated, service_role;

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
    elsif k in ('excerpt','locator','value_text','answer_text','pin_key','draft_hash') then
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
      if k = 'answer_text' and char_length(p_input->>k) not between 1 and 4000 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'pin_key' and (char_length(p_input->>k) not between 1 and 120
        or (p_input->>k) !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$') then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'draft_hash' and (p_input->>k) !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'ends_at' then
      if jsonb_typeof(v) <> 'string' then raise exception using errcode = '22023', message = 'VALIDATION_FAILED'; end if;
      begin
        perform (p_input->>'ends_at')::timestamptz;
      exception when others then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end;
    end if;
  end loop;
end;
$$;

create function public.record_brand_extraction(p_source_id uuid, p_assertions jsonb, p_request_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  source public.brand_sources%rowtype;
  draft public.brand_knowledge_drafts%rowtype;
  actor uuid;
  item jsonb;
  kind text;
  field_key text;
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
    kind := coalesce(item->>'kind','');
    field_key := coalesce(item->>'field_key','');
    if kind not in ('offering','location','fact','offer','visual_candidate','language')
      or char_length(field_key) not between 1 and 120
      or coalesce(item->>'status','') not in ('observed','unknown')
      or coalesce(item->>'method','') not in ('data_attribute','html_image','html_lang','markdown_section','plaintext_labeled','visible_text')
      or coalesce(item->>'excerpt','') = ''
      or coalesce(item->>'method','') = 'manual'
      or (item->>'reusable') is distinct from 'false'
      or (coalesce(item->>'status','') = 'unknown' and nullif(item->>'value_text','') is not null)
      or (coalesce(item->>'status','') <> 'unknown' and nullif(item->>'value_text','') is null) then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
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
      where a.kind = kind and a.field_key = field_key limit 1;
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
        source.workspace_id, source.brand_id, draft.id, source.id, source.job_id, kind, field_key,
        nullif(item->>'value_text',''), item->>'status', item->>'excerpt', coalesce(item->>'locator',''),
        item->>'method', source.captured_at, ends_at, false, current_row.id, actor);
  end loop;
  perform app_private.bump_knowledge_draft(source.workspace_id, source.brand_id, actor);
  insert into public.audit_events (workspace_id, actor_type, actor_id, action, entity_type, entity_id, request_id, details)
    values (source.workspace_id, 'system', null, 'platform.record_brand_extraction', 'platform_resource', source.id, p_request_id, '{}');
  return app_private.knowledge_review_view(source.workspace_id, source.brand_id, false);
end;
$$;
revoke all on function public.record_brand_extraction(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_brand_extraction(uuid, jsonb, text) to service_role;

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
            p_input->>'answer_text', 'question', 'manual', source.captured_at, false, assertion.id, actor);
      else
        perform app_private.supersede_kind_proposal(
          draft, actor, question_row.target_kind, 'corrected', p_input->>'answer_text', 'medium',
          '[]'::jsonb, p_input->>'answer_text');
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
        where a.value_text is distinct from b.value_text)
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

create or replace function public.platform_knowledge_query(p_operation text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  ws uuid; br uuid; required text[]; optional text[] := '{}'; job public.brand_source_jobs%rowtype;
  source public.brand_sources%rowtype; items jsonb := '[]'::jsonb; next_cursor text; scope jsonb;
  cursor_data jsonb; after_at timestamptz; after_id uuid; page_limit integer; n integer := 0; rec jsonb;
  approved public.brand_versions%rowtype; pin public.brand_version_pins%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'UNAUTHENTICATED'; end if;
  case p_operation
    when 'get_source_job' then required := array['workspace_id','brand_id','job_id'];
    when 'list_latest_source_job' then required := array['workspace_id','brand_id'];
    when 'get_brand_source' then required := array['workspace_id','brand_id','source_id'];
    when 'get_knowledge_draft' then required := array['workspace_id','brand_id']; optional := array['limit','cursor'];
    when 'list_brand_sources' then required := array['workspace_id','brand_id']; optional := array['limit','cursor'];
    when 'get_knowledge_review' then required := array['workspace_id','brand_id'];
    when 'list_brand_versions' then required := array['workspace_id','brand_id']; optional := array['limit','cursor'];
    when 'get_brand_version' then required := array['workspace_id','brand_id','brand_version_id'];
    when 'get_brand_version_pin' then required := array['workspace_id','brand_id','pin_key'];
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
  elsif p_operation = 'get_knowledge_review' then
    return app_private.knowledge_review_view(ws, br, false);
  elsif p_operation = 'get_brand_version' then
    select * into approved from public.brand_versions
      where workspace_id = ws and brand_id = br and id = (p_input->>'brand_version_id')::uuid;
    if approved.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
    return jsonb_build_object('record', app_private.brand_version_json(approved));
  elsif p_operation = 'get_brand_version_pin' then
    select * into pin from public.brand_version_pins
      where workspace_id = ws and brand_id = br and pin_key = p_input->>'pin_key';
    if pin.id is null then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
    select * into approved from public.brand_versions
      where workspace_id = ws and brand_id = br and id = pin.brand_version_id;
    return jsonb_build_object(
      'record', app_private.brand_version_pin_json(pin),
      'brand_version', app_private.brand_version_json(approved));
  elsif p_operation = 'list_brand_versions' then
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
    for rec in select app_private.brand_version_json(v)
      from public.brand_versions v
      where v.workspace_id = ws and v.brand_id = br
        and (after_at is null or (v.created_at, v.id) > (after_at, after_id))
      order by v.created_at, v.id
      limit page_limit + 1
    loop
      n := n + 1;
      if n <= page_limit then items := items || jsonb_build_array(rec); end if;
    end loop;
    if n > page_limit then
      rec := items -> (page_limit - 1);
      next_cursor := rtrim(translate(replace(encode(convert_to(jsonb_build_object('scope', scope, 'at', rec->>'created_at', 'id', rec->>'id')::text, 'UTF8'), 'base64'), E'\n', ''), '+/', '-_'), '=');
    end if;
    return jsonb_build_object('items', items, 'next_cursor', next_cursor);
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

commit;
