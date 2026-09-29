begin;

-- This helper only validates JSON, never reads or mutates privileged records.
grant execute on function app_private.platform_validate_input(jsonb,text[],text[]) to authenticated;

create function public.platform_query(p_operation text, p_input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_required text[]; v_optional text[] := '{}'; v_table text; v_where text; v_single boolean := false;
  v_workspace uuid; v_studio uuid; v_brand uuid; v_id uuid; v_limit integer; v_archived boolean;
  v_cursor jsonb; v_scope jsonb; v_at timestamptz; v_after uuid; v_record jsonb;
  v_rows jsonb := '[]'; v_next text; v_count integer := 0; v_last jsonb;
begin
  if auth.uid() is null then raise exception using errcode='28000', message='UNAUTHENTICATED'; end if;
  case p_operation
    when 'list_studios' then v_required:='{}'; v_table:='studios'; v_where:='true';
    when 'get_studio' then v_required:=array['studio_id']; v_table:='studios'; v_where:='t.id=$3'; v_single:=true;
    when 'list_studio_members' then v_required:=array['studio_id']; v_table:='studio_memberships'; v_where:='t.studio_id=$3';
    when 'list_workspace_access_grants' then v_required:=array['studio_id']; v_optional:=array['workspace_id']; v_table:='workspace_access_grants'; v_where:='t.studio_id=$3 and ($1 is null or t.workspace_id=$1)';
    when 'list_brands' then v_required:=array['workspace_id']; v_table:='brands'; v_where:='t.workspace_id=$1';
    when 'get_brand' then v_required:=array['workspace_id','brand_id']; v_table:='brands'; v_where:='t.workspace_id=$1 and t.id=$2'; v_single:=true;
    when 'list_brand_locations' then v_required:=array['workspace_id','brand_id']; v_table:='brand_locations'; v_where:='t.workspace_id=$1 and t.brand_id=$2';
    when 'get_brand_location' then v_required:=array['workspace_id','brand_id','location_id']; v_table:='brand_locations'; v_where:='t.workspace_id=$1 and t.brand_id=$2 and t.id=$4'; v_single:=true;
    else raise exception using errcode='22023', message='VALIDATION_FAILED';
  end case;
  if not v_single then v_optional:=v_optional || array['limit','cursor','include_archived']; end if;
  perform app_private.platform_validate_input(p_input,v_required,v_optional);
  v_workspace:=(p_input->>'workspace_id')::uuid; v_studio:=(p_input->>'studio_id')::uuid;
  v_brand:=(p_input->>'brand_id')::uuid; v_id:=(p_input->>'location_id')::uuid;
  v_limit:=coalesce((p_input->>'limit')::integer,20); v_archived:=coalesce((p_input->>'include_archived')::boolean,false);
  if p_operation='list_studio_members' then
    if not exists(select 1 from public.studios where id=v_studio) then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
    if app_private.platform_studio_role(v_studio) <> 'owner' then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  elsif p_operation='list_workspace_access_grants' then
    if not exists(select 1 from public.studios where id=v_studio) and not exists(select 1 from public.workspace_access_grants where studio_id=v_studio) then
      raise exception using errcode='P0002', message='NOT_FOUND';
    end if;
  elsif p_operation='list_brands' then
    if not app_private.platform_can(v_workspace,null,'brand:read') and not exists(select 1 from public.brands where workspace_id=v_workspace) then
      raise exception using errcode='P0002', message='NOT_FOUND';
    end if;
  elsif v_table='brand_locations' then
    if not exists(select 1 from public.brands where workspace_id=v_workspace and id=v_brand) then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
    if not app_private.platform_can(v_workspace,v_brand,'location:read') then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  end if;
  v_scope:=jsonb_build_object('operation',p_operation,'actor',auth.uid(),'input',p_input-array['limit','cursor']);
  if p_input ? 'cursor' then
    begin
      if (p_input->>'cursor') !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid cursor'; end if;
      v_next:=translate(p_input->>'cursor','-_','+/');
      v_cursor:=convert_from(decode(v_next || repeat('=',(4-length(v_next)%4)%4),'base64'),'UTF8')::jsonb;
      if jsonb_typeof(v_cursor) <> 'object' or not v_cursor ?& array['scope','at','id']
        or v_cursor-array['scope','at','id'] <> '{}'::jsonb or v_cursor->'scope' is distinct from v_scope
        or jsonb_typeof(v_cursor->'at') <> 'string' or jsonb_typeof(v_cursor->'id') <> 'string' then raise exception 'invalid cursor'; end if;
      v_at:=(v_cursor->>'at')::timestamptz; v_after:=(v_cursor->>'id')::uuid;
      if not isfinite(v_at) then raise exception 'invalid cursor'; end if;
    exception when others then raise exception using errcode='22023', message='VALIDATION_FAILED'; end;
  end if;
  v_next:=null;
  -- Table and predicate are selected above, never interpolated from caller input. Native RLS filters every row.
  for v_record in execute format('select to_jsonb(t) from public.%I t where (%s)
    and ($5 or t.status=''active'') and ($6 is null or (t.created_at,t.id)>($6,$7))
    order by t.created_at,t.id limit $8',v_table,v_where)
    using v_workspace,v_brand,v_studio,v_id,(v_archived or v_single),v_at,v_after,(case when v_single then 1 else v_limit+1 end) loop
    v_count:=v_count+1;
    if v_count <= v_limit then v_rows:=v_rows || jsonb_build_array(v_record); v_last:=v_record; end if;
  end loop;
  if v_single then
    if v_count=0 then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
    return jsonb_build_object('record',v_rows->0);
  end if;
  if v_count > v_limit then
    v_next:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('scope',v_scope,'at',v_last->>'created_at','id',v_last->>'id')::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  end if;
  return jsonb_build_object('items',v_rows,'next_cursor',v_next);
end;
$$;
revoke all on function public.platform_query(text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.platform_query(text,jsonb) to authenticated;
commit;
