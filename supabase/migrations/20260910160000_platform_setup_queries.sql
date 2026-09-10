begin;
create function public.platform_setup_query(p_operation text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare
  required text[]; optional text[]:='{}'; st uuid; ws uuid; br uuid; proj uuid;
  row_data jsonb; items jsonb:='[]'; result jsonb; last_row jsonb; next_cursor text; scope jsonb; cursor_data jsonb;
  after_at timestamptz; after_id uuid; page_limit integer; n integer:=0; query_sql text; permitted text[];
begin
  if auth.uid() is null then raise exception using errcode='28000',message='UNAUTHENTICATED'; end if;
  case p_operation
    when 'get_brand_draft' then required:=array['workspace_id','brand_id'];
    when 'get_brand_access' then required:=array['studio_id','workspace_id','brand_id'];
    when 'get_workspace_settings' then required:=array['workspace_id'];
    when 'resolve_project_brand' then required:=array['workspace_id','project_id'];
    when 'list_studio_brands' then required:=array['studio_id']; optional:=array['limit','cursor','include_archived','search'];
    when 'list_studio_invitations' then required:=array['studio_id']; optional:=array['limit','cursor'];
    when 'list_my_invitations' then required:='{}'; optional:=array['limit','cursor'];
    else raise exception using errcode='22023',message='VALIDATION_FAILED';
  end case;
  perform app_private.platform_setup_validate(p_input,required,optional);
  st:=(p_input->>'studio_id')::uuid; ws:=(p_input->>'workspace_id')::uuid; br:=(p_input->>'brand_id')::uuid; proj:=(p_input->>'project_id')::uuid;
  if st is not null then
    if not exists(select 1 from public.studios where id=st) then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if p_operation='list_studio_invitations' and app_private.platform_studio_role(st)<>'owner' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  end if;
  if p_operation in ('get_brand_draft','get_brand_access') then
    select to_jsonb(b) into row_data from public.brands b where workspace_id=ws and id=br;
    if row_data is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if p_operation='get_brand_draft' then
      select to_jsonb(d) into row_data from public.brand_onboarding_drafts d where workspace_id=ws and brand_id=br;
      return jsonb_build_object('record',row_data);
    end if;
    -- Scope this presentation to the selected studio's explicit grants, even if another studio grants access.
    select array_agg(distinct a order by a) into permitted from public.workspace_access_grants g cross join lateral unnest(g.actions) a
      where g.workspace_id=ws and g.studio_id=st and (g.brand_id is null or g.brand_id=br) and app_private.platform_grant_current(g.id)
        and (a like '%:read' or app_private.platform_studio_role(st) in ('owner','editor'));
    if permitted is null or not 'brand:read'=any(permitted) then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    return jsonb_build_object('brand',row_data,'actions',case when row_data->>'status'='active' then to_jsonb(permitted)
      else to_jsonb(array(select a from unnest(permitted) a where a like '%:read')) end,'workspace_owner',app_private.is_workspace_owner(ws));
  elsif p_operation='get_workspace_settings' then
    if not app_private.is_workspace_owner(ws) then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    select jsonb_build_object('id',id,'name',name,'slug',slug,'status',status,'updated_at',updated_at) into row_data from public.workspaces where id=ws;
    if row_data is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    return jsonb_build_object('record',row_data);
  elsif p_operation='resolve_project_brand' then
    -- Legacy project RLS remains authoritative; a studio grant alone does not unlock historical execution.
    if not exists(select 1 from public.projects where workspace_id=ws and id=proj) then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    select brand_id into br from public.project_brand_mappings where workspace_id=ws and project_id=proj;
    return jsonb_build_object('workspace_id',ws,'project_id',proj,'brand_id',br,'state',case when br is null then 'mapping_required' else 'mapped' end);
  end if;
  page_limit:=coalesce((p_input->>'limit')::integer,20);
  scope:=jsonb_build_object('operation',p_operation,'actor',auth.uid(),'input',p_input-array['limit','cursor']);
  if p_input ? 'cursor' then
    begin
      if p_input->>'cursor' !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid cursor'; end if;
      next_cursor:=translate(p_input->>'cursor','-_','+/');
      cursor_data:=convert_from(decode(next_cursor||repeat('=',(4-length(next_cursor)%4)%4),'base64'),'UTF8')::jsonb;
      if jsonb_typeof(cursor_data)<>'object' or not cursor_data ?& array['scope','at','id'] or cursor_data-array['scope','at','id']<>'{}'::jsonb
        or cursor_data->'scope' is distinct from scope or jsonb_typeof(cursor_data->'at')<>'string' or jsonb_typeof(cursor_data->'id')<>'string' then raise exception 'invalid cursor'; end if;
      after_at:=(cursor_data->>'at')::timestamptz; after_id:=(cursor_data->>'id')::uuid;
      if not isfinite(after_at) then raise exception 'invalid cursor'; end if;
    exception when others then raise exception using errcode='22023',message='VALIDATION_FAILED'; end;
  end if;
  next_cursor:=null;
  if p_operation='list_studio_brands' then
    query_sql:='select to_jsonb(b) from public.brands b where exists(select 1 from public.workspace_access_grants g
      where g.studio_id=$1 and g.workspace_id=b.workspace_id and (g.brand_id is null or g.brand_id=b.id) and app_private.platform_grant_current(g.id))
      and ($2 or b.status=''active'') and strpos(lower(b.name),lower($3))>0
      and ($4 is null or (b.created_at,b.id)>($4,$5)) order by b.created_at,b.id limit $6';
  else
    query_sql:='select to_jsonb(i) from public.studio_invitations i where '||case when p_operation='list_my_invitations'
      then 'app_private.platform_invitation_current(i.id)' else 'i.studio_id=$1' end||'
      and ($4 is null or (i.created_at,i.id)>($4,$5)) order by i.created_at,i.id limit $6';
  end if;
  -- SQL choices are fixed above; all caller values remain bound parameters and every row uses RLS.
  for row_data in execute query_sql using st,coalesce((p_input->>'include_archived')::boolean,false),coalesce(p_input->>'search',''),after_at,after_id,page_limit+1 loop
    n:=n+1;
    if n<=page_limit then
      last_row:=row_data;
      result:=case when p_operation='list_my_invitations' then jsonb_build_object('invitation',row_data,'studio_name',app_private.platform_invited_studio_name((row_data->>'id')::uuid)) else row_data end;
      items:=items||jsonb_build_array(result);
    end if;
  end loop;
  if n>page_limit then
    next_cursor:=rtrim(translate(replace(encode(convert_to(jsonb_build_object('scope',scope,'at',last_row->>'created_at','id',last_row->>'id')::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  end if;
  return jsonb_build_object('items',items,'next_cursor',next_cursor);
end;
$$;
revoke all on function public.platform_setup_query(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.platform_setup_query(text,jsonb) to authenticated;
commit;
