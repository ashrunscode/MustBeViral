begin;
create function app_private.platform_team_label(p_member_id uuid) returns text
language sql stable security definer set search_path=pg_catalog as $$
  select left(coalesce(nullif(u.email,''),'Studio member'),254)
    from public.studio_memberships m
    join auth.users u on u.id=m.user_id
    where m.id=p_member_id and app_private.platform_studio_role(m.studio_id)='owner';
$$;
revoke all on function app_private.platform_team_label(uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.platform_team_label(uuid) to authenticated;

create or replace function public.platform_presentation_query(p_operation text,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare
  st uuid; ws uuid; br uuid; row_data jsonb; member_role text; required text[]; optional text[]:='{}';
  scope jsonb; cursor_data jsonb; next_cursor text; after_at timestamptz; after_id uuid; page_limit integer;
  query_sql text; items jsonb:='[]'; last_row jsonb; n integer:=0; label text;
begin
  if auth.uid() is null then raise exception using errcode='28000',message='UNAUTHENTICATED'; end if;
  case p_operation
    when 'get_studio_access' then required:=array['studio_id'];
    when 'list_studio_team' then required:=array['studio_id']; optional:=array['limit','cursor'];
    when 'list_brand_studios' then required:=array['workspace_id','brand_id']; optional:=array['limit','cursor'];
    else raise exception using errcode='22023',message='VALIDATION_FAILED';
  end case;
  perform app_private.platform_setup_validate(p_input,required,optional);
  st:=(p_input->>'studio_id')::uuid; ws:=(p_input->>'workspace_id')::uuid; br:=(p_input->>'brand_id')::uuid;
  if st is not null then
    select to_jsonb(s) into row_data from public.studios s where id=st;
    member_role:=app_private.platform_studio_role(st);
    if row_data is null or member_role is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if p_operation='get_studio_access' then return jsonb_build_object('studio',row_data,'role',member_role); end if;
    if member_role<>'owner' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  elsif not exists(select 1 from public.brands where workspace_id=ws and id=br) then
    raise exception using errcode='P0002',message='NOT_FOUND';
  end if;
  scope:=jsonb_build_object('operation',p_operation,'actor',auth.uid(),'input',p_input-array['limit','cursor']);
  page_limit:=coalesce((p_input->>'limit')::integer,20);
  if p_input ? 'cursor' then
    begin
      if p_input->>'cursor' !~ '^[A-Za-z0-9_-]+$' then raise exception 'invalid cursor'; end if;
      next_cursor:=translate(p_input->>'cursor','-_','+/');
      cursor_data:=convert_from(decode(next_cursor||repeat('=',(4-length(next_cursor)%4)%4),'base64'),'UTF8')::jsonb;
      if jsonb_typeof(cursor_data)<>'object' or not cursor_data ?& array['scope','at','id']
        or cursor_data-array['scope','at','id']<>'{}'::jsonb
        or cursor_data->'scope' is distinct from scope
        or jsonb_typeof(cursor_data->'at')<>'string'
        or jsonb_typeof(cursor_data->'id')<>'string' then raise exception 'invalid cursor'; end if;
      after_at:=(cursor_data->>'at')::timestamptz; after_id:=(cursor_data->>'id')::uuid;
      if not isfinite(after_at) then raise exception 'invalid cursor'; end if;
    exception when others then raise exception using errcode='22023',message='VALIDATION_FAILED'; end;
  end if;
  next_cursor:=null;
  if p_operation='list_studio_team' then
    query_sql:='select to_jsonb(m) from public.studio_memberships m
      where m.studio_id=$1 and m.status=''active'' and ($4 is null or (m.created_at,m.id)>($4,$5))
      order by m.created_at,m.id limit $6';
  else
    -- Caller membership is required; a current grant without the caller in that studio is not a usable context.
    query_sql:='select to_jsonb(s) from public.studios s
      where s.status=''active'' and app_private.platform_studio_role(s.id) is not null
        and exists(select 1 from public.workspace_access_grants g
          where g.studio_id=s.id and g.workspace_id=$2 and (g.brand_id is null or g.brand_id=$3)
            and ''brand:read''=any(g.actions) and app_private.platform_grant_current(g.id))
        and ($4 is null or (s.created_at,s.id)>($4,$5))
      order by s.created_at,s.id limit $6';
  end if;
  for row_data in execute query_sql using st,ws,br,after_at,after_id,page_limit+1 loop
    n:=n+1;
    if n<=page_limit then
      if p_operation='list_studio_team' then
        label:=coalesce(nullif(app_private.platform_team_label((row_data->>'id')::uuid),''),'Studio member');
        row_data:=row_data||jsonb_build_object('display_label',left(label,254));
      end if;
      items:=items||jsonb_build_array(row_data);
      last_row:=row_data;
    end if;
  end loop;
  if n>page_limit then
    next_cursor:=rtrim(translate(replace(encode(convert_to(
      jsonb_build_object('scope',scope,'at',last_row->>'created_at','id',last_row->>'id')::text,'UTF8'),'base64'),E'\n',''),'+/','-_'),'=');
  end if;
  return jsonb_build_object('items',items,'next_cursor',next_cursor);
end;
$$;
revoke all on function public.platform_presentation_query(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.platform_presentation_query(text,jsonb) to authenticated;
commit;
