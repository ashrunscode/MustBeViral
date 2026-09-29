begin;

-- Compare a permitted immutable approval to the current evidence. This projection
-- never rewrites either side or treats a fresh source as operator approval.
create function app_private.knowledge_assertion_values(p_rows jsonb)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
  from (select distinct jsonb_build_array(a->'value_text', a->'status', a->'ends_at') v
    from jsonb_array_elements(p_rows) a) values_only;
$$;
revoke all on function app_private.knowledge_assertion_values(jsonb) from public, anon, authenticated, service_role;

create function app_private.knowledge_changes_view(p_workspace_id uuid, p_brand_id uuid, p_version_id uuid default null)
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
      'conflicted',exists(select 1 from jsonb_array_elements(after_values) a where a->>'status'='disputed')
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
    'groups',coalesce((select jsonb_agg(item order by kind,field_key) from groups),'[]'::jsonb),
    'expired_baseline_assertion_ids',coalesce((select jsonb_agg(a->>'id' order by a->>'id') from before_rows
      where a->>'kind'='offer' and a->>'status'<>'unknown' and a->>'ends_at' is not null
        and (a->>'ends_at')::timestamptz<=statement_timestamp()),'[]'::jsonb)
  );
$$;
revoke all on function app_private.knowledge_changes_view(uuid,uuid,uuid) from public, anon, authenticated, service_role;

create function public.platform_knowledge_lifecycle_query(p_operation text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare ws uuid; br uuid; baseline uuid;
begin
  if auth.uid() is null then raise exception using errcode='28000',message='UNAUTHENTICATED'; end if;
  if p_operation<>'get_brand_knowledge_changes' or p_operation is null then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  perform app_private.platform_knowledge_validate(p_input,array['workspace_id','brand_id'],array['brand_version_id']);
  ws:=(p_input->>'workspace_id')::uuid; br:=(p_input->>'brand_id')::uuid;
  baseline:=(p_input->>'brand_version_id')::uuid;
  if not app_private.platform_can(ws,br,'brand:read')
    or not exists(select 1 from public.brands where workspace_id=ws and id=br)
    or (baseline is not null and not exists(select 1 from public.brand_versions where workspace_id=ws and brand_id=br and id=baseline)) then
    raise exception using errcode='P0002',message='NOT_FOUND';
  end if;
  return app_private.knowledge_changes_view(ws,br,baseline);
end;
$$;
revoke all on function public.platform_knowledge_lifecycle_query(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.platform_knowledge_lifecycle_query(text,jsonb) to authenticated;

commit;
