begin;
-- Completed, extracted capture occurrences are review evidence, even when their
-- bytes/assertions were already cached. The private watermark advances on every
-- newly available occurrence and excludes extraction replay and approval events.
create or replace function app_private.knowledge_draft_hash(p_workspace_id uuid, p_brand_id uuid)
returns text language sql stable set search_path = pg_catalog as $$
  select app_private.hash_canonical_json(jsonb_build_object(
    'draft', (
      select jsonb_build_object('id', d.id, 'version', d.version)
      from public.brand_knowledge_drafts d
      where d.workspace_id = p_workspace_id and d.brand_id = p_brand_id),
    'source_evidence_sequence', coalesce((
      select max(greatest(coalesce(j.completion_sequence,0),extracted.first_sequence))
      from public.brand_source_jobs j
      join public.brand_sources s on s.id=j.source_id and s.workspace_id=j.workspace_id and s.brand_id=j.brand_id
      cross join lateral (
        select case when bool_or(ev.knowledge_sequence is null) then 0 else min(ev.knowledge_sequence) end first_sequence
        from public.audit_events ev where ev.workspace_id=j.workspace_id and ev.entity_id=j.source_id
          and ev.action='platform.record_brand_extraction' having count(*)>0
      ) extracted
      where j.workspace_id=p_workspace_id and j.brand_id=p_brand_id
        and j.status in ('captured','duplicate') and j.kind in ('website','document')
    ),0),
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

commit;
