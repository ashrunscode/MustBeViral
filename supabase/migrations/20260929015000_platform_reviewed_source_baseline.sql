begin;
-- Source bytes already reviewed in a newer approval must not keep appearing new
-- solely because an explicit unknown retains its historical provenance.
create or replace function app_private.knowledge_source_changes(p_workspace uuid,p_brand uuid,p_version uuid)
returns jsonb language sql stable set search_path=pg_catalog as $$
 with baseline as (
  select v.snapshot,v.created_at approved_at from public.brand_versions v where v.workspace_id=p_workspace and v.brand_id=p_brand and (p_version is null or v.id=p_version)
  order by v.version desc limit 1
 ), identities as (select distinct (a->>'source_id')::uuid id,b.approved_at from baseline b cross join lateral jsonb_array_elements(b.snapshot->'assertions') a)
 select coalesce(jsonb_agg(jsonb_build_object('previous_source_id',original.id,'latest_source_id',latest.id,'captured_at',latest.captured_at,'kind',latest.kind)
  order by original.id),'[]'::jsonb)
 from identities i join public.brand_sources original on original.id=i.id and original.workspace_id=p_workspace and original.brand_id=p_brand
 cross join lateral app_private.latest_extracted_knowledge_source(original) latest
 where original.id<>latest.id and original.content_sha256 is distinct from latest.content_sha256
  and (select min(ev.created_at) from public.audit_events ev where ev.workspace_id=p_workspace and ev.entity_id=latest.id and ev.action='platform.record_brand_extraction')>i.approved_at;
$$;
commit;
