begin;

-- Reuse the existing idempotency store for the five studio-only mutations.
alter table public.idempotency_records drop constraint idempotency_records_check;
alter table public.idempotency_records add constraint idempotency_records_check check (
  workspace_id is not null or operation in ('create_workspace','create_studio','update_studio','archive_studio','set_studio_member','revoke_studio_member')
);

create function app_private.platform_validate_input(p_input jsonb, p_required text[], p_optional text[] default '{}')
returns void language plpgsql set search_path = pg_catalog as $$
declare k text; v jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' or octet_length(p_input::text) > 8192
    or not p_input ?& p_required then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;
  for k, v in select * from jsonb_each(p_input) loop
    if not k = any(p_required || p_optional) or v = 'null'::jsonb then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    end if;
    if k like '%\_id' escape '\' then
      if jsonb_typeof(v) <> 'string' or (p_input->>k) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('name','slug','time_zone','role','cursor') then
      if jsonb_typeof(v) <> 'string' or char_length(p_input->>k) not between 1 and 2048 then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'name' and (p_input->>k <> btrim(p_input->>k) or char_length(p_input->>k) > 120) then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'slug' and (char_length(p_input->>k) > 120 or (p_input->>k) !~ '^[a-z0-9]+(-[a-z0-9]+)*$') then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'time_zone' and not exists(select 1 from pg_timezone_names where name=p_input->>k) then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
      if k = 'role' and p_input->>k not in ('editor','viewer') then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k in ('expected_version','limit') then
      if jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' or (v::text)::numeric not between 1 and 2147483647
        or (k = 'limit' and (v::text)::numeric > 100) then
        raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
      end if;
    elsif k = 'include_archived' and jsonb_typeof(v) <> 'boolean' then
      raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
    elsif k = 'actions' then
      if jsonb_typeof(v) <> 'array' then raise exception using errcode='22023', message='VALIDATION_FAILED'; end if;
      if jsonb_array_length(v) not between 1 and 4 or exists(select 1 from jsonb_array_elements(v) x
        where jsonb_typeof(x) <> 'string' or x #>> '{}' not in ('brand:read','brand:write','location:read','location:write'))
        or (select count(distinct x) from jsonb_array_elements_text(v) x) <> jsonb_array_length(v)
        or not v ? 'brand:read' or (v ? 'location:write' and not v ? 'location:read') then
        raise exception using errcode='22023', message='VALIDATION_FAILED';
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function app_private.platform_validate_input(jsonb, text[], text[]) from public, anon, authenticated, service_role;

create function app_private.lock_platform_workspace(p_workspace_id uuid, p_extra_studio_id uuid default null)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- Stable lock order: studios by UUID, then workspace. A member/grant revoke waits here too.
  perform s.id from public.studios s where s.id=p_extra_studio_id or exists(select 1 from public.studio_memberships m
    where m.studio_id=s.id and m.user_id=auth.uid() and m.status='active') order by s.id for share;
  perform id from public.workspaces where id=p_workspace_id for update;
end;
$$;
revoke all on function app_private.lock_platform_workspace(uuid, uuid) from public, anon, authenticated, service_role;

create function public.platform_command(p_operation text, p_input jsonb, p_idempotency_key text, p_request_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_actor uuid := auth.uid(); v_workspace uuid; v_studio uuid; v_brand uuid; v_id uuid; v_owner uuid;
  v_required text[]; v_optional text[] := '{}'; v_row jsonb; v_response jsonb; v_hash text;
  v_existing public.idempotency_records%rowtype;
begin
  if v_actor is null then raise exception using errcode='28000', message='UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode='22023', message='VALIDATION_FAILED';
  end if;
  case p_operation
    when 'create_studio' then v_required:=array['name','slug'];
    when 'update_studio' then v_required:=array['studio_id','name','slug','expected_version'];
    when 'archive_studio' then v_required:=array['studio_id','expected_version'];
    when 'set_studio_member' then v_required:=array['studio_id','user_id','role','expected_version'];
    when 'revoke_studio_member' then v_required:=array['studio_id','user_id','expected_version'];
    when 'grant_workspace_access' then v_required:=array['workspace_id','studio_id','actions']; v_optional:=array['brand_id'];
    when 'revoke_workspace_access' then v_required:=array['workspace_id','grant_id','expected_version'];
    when 'create_brand' then v_required:=array['workspace_id','name','slug'];
    when 'update_brand' then v_required:=array['workspace_id','brand_id','name','slug','expected_version'];
    when 'archive_brand' then v_required:=array['workspace_id','brand_id','expected_version'];
    when 'create_brand_location' then v_required:=array['workspace_id','brand_id','name','slug','time_zone'];
    when 'update_brand_location' then v_required:=array['workspace_id','brand_id','location_id','name','slug','time_zone','expected_version'];
    when 'archive_brand_location' then v_required:=array['workspace_id','brand_id','location_id','expected_version'];
    else raise exception using errcode='22023', message='VALIDATION_FAILED';
  end case;
  perform app_private.platform_validate_input(p_input, v_required, v_optional);
  v_workspace:=(p_input->>'workspace_id')::uuid; v_studio:=(p_input->>'studio_id')::uuid; v_brand:=(p_input->>'brand_id')::uuid;
  v_hash:=app_private.hash_canonical_json(p_input);
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || coalesce(v_workspace::text,'') || ':' || p_operation || ':' || p_idempotency_key,0));

  -- Recheck authorization before reading any replay payload, including archived resources.
  if p_operation in ('update_studio','archive_studio','set_studio_member','revoke_studio_member') then
    select to_jsonb(s) into v_row from public.studios s where id=v_studio for update;
    if v_row is null or app_private.platform_studio_role(v_studio) is null then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
    if app_private.platform_studio_role(v_studio) <> 'owner' then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  end if;

  if v_workspace is not null then
    -- The target can be external to the granting owner's studio memberships.
    perform app_private.lock_platform_workspace(v_workspace,v_studio);
    if p_operation in ('grant_workspace_access','revoke_workspace_access') then
      if not app_private.is_workspace_owner(v_workspace) then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
      if not exists(select 1 from public.workspaces where id=v_workspace and status='active') then raise exception using errcode='42501', message='FORBIDDEN'; end if;
      if p_operation='grant_workspace_access' then
        if not exists(select 1 from public.studios where id=v_studio and status='active') then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
        if v_brand is not null and not exists(select 1 from public.brands where workspace_id=v_workspace and id=v_brand and status='active') then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
      else
        select to_jsonb(g) into v_row from public.workspace_access_grants g where workspace_id=v_workspace and id=(p_input->>'grant_id')::uuid;
        if v_row is null then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
      end if;
    else
      if v_brand is not null then
        select to_jsonb(b) into v_row from public.brands b where workspace_id=v_workspace and id=v_brand;
        if v_row is null or not app_private.platform_can(v_workspace,v_brand,'brand:read') then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
      elsif not app_private.platform_can(v_workspace,null,'brand:read') then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
      if not app_private.platform_can(v_workspace,v_brand,case when p_operation like '%location' then 'location:write' else 'brand:write' end) then
        raise exception using errcode='42501', message='FORBIDDEN';
      end if;
      if p_input ? 'location_id' then
        select to_jsonb(l) into v_response from public.brand_locations l where workspace_id=v_workspace and brand_id=v_brand and id=(p_input->>'location_id')::uuid;
        if v_response is null then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
      end if;
    end if;
  end if;
  select * into v_existing from public.idempotency_records where actor_id=v_actor
    and workspace_id is not distinct from v_workspace and operation=p_operation and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then raise exception using errcode='P0001', message='IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_payload;
  end if;
  if v_row->>'status'='archived' or (p_operation='revoke_workspace_access' and v_row->>'status'='revoked')
    or v_response->>'status'='archived' then raise exception using errcode='P0001', message='RESOURCE_ARCHIVED'; end if;
  -- Membership changes use the studio version, serializing all team changes and protecting its owner.
  if p_input ? 'expected_version' and coalesce(v_response->>'version',v_row->>'version')::integer <> (p_input->>'expected_version')::integer then
    raise exception using errcode='P0001', message='REVISION_CONFLICT';
  end if;
  case p_operation
    when 'create_studio' then
      insert into public.studios(name,slug,created_by) values(p_input->>'name',p_input->>'slug',v_actor) returning to_jsonb(studios.*) into v_row;
      v_studio:=(v_row->>'id')::uuid;
      insert into public.studio_memberships(studio_id,user_id,role) values(v_studio,v_actor,'owner');
    when 'update_studio' then
      update public.studios set name=p_input->>'name',slug=p_input->>'slug',version=version+1,updated_at=statement_timestamp()
        where id=v_studio returning to_jsonb(studios.*) into v_row;
    when 'archive_studio' then
      update public.studios set status='archived',version=version+1,updated_at=statement_timestamp() where id=v_studio returning to_jsonb(studios.*) into v_row;
    when 'set_studio_member', 'revoke_studio_member' then
      if exists(select 1 from public.studio_memberships where studio_id=v_studio and user_id=(p_input->>'user_id')::uuid and role='owner') then
        raise exception using errcode='42501', message='FORBIDDEN';
      end if;
      if p_operation='set_studio_member' then
        if not exists(select 1 from auth.users where id=(p_input->>'user_id')::uuid) then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
        insert into public.studio_memberships(studio_id,user_id,role) values(v_studio,(p_input->>'user_id')::uuid,p_input->>'role')
          on conflict(studio_id,user_id) do update set role=excluded.role,status='active',revoked_at=null,version=studio_memberships.version+1;
      else
        update public.studio_memberships set status='revoked',revoked_at=statement_timestamp(),version=version+1
          where studio_id=v_studio and user_id=(p_input->>'user_id')::uuid and status='active';
        if not found then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
      end if;
      update public.studios set version=version+1,updated_at=statement_timestamp() where id=v_studio returning to_jsonb(studios.*) into v_row;
    when 'grant_workspace_access' then
      select id into v_owner from public.workspace_memberships where workspace_id=v_workspace and user_id=v_actor and role='owner' and status='active';
      insert into public.workspace_access_grants(workspace_id,studio_id,brand_id,owner_membership_id,granted_by,actions)
        values(v_workspace,v_studio,v_brand,v_owner,v_actor,array(select jsonb_array_elements_text(p_input->'actions')))
        returning to_jsonb(workspace_access_grants.*) into v_row;
    when 'revoke_workspace_access' then
      update public.workspace_access_grants set status='revoked',revoked_at=statement_timestamp(),version=version+1
        where workspace_id=v_workspace and id=(p_input->>'grant_id')::uuid returning to_jsonb(workspace_access_grants.*) into v_row;
    when 'create_brand' then
      insert into public.brands(workspace_id,name,slug,created_by) values(v_workspace,p_input->>'name',p_input->>'slug',v_actor) returning to_jsonb(brands.*) into v_row;
    when 'update_brand' then
      update public.brands set name=p_input->>'name',slug=p_input->>'slug',version=version+1,updated_at=statement_timestamp()
        where workspace_id=v_workspace and id=v_brand returning to_jsonb(brands.*) into v_row;
    when 'archive_brand' then
      update public.brands set status='archived',version=version+1,updated_at=statement_timestamp()
        where workspace_id=v_workspace and id=v_brand returning to_jsonb(brands.*) into v_row;
    when 'create_brand_location' then
      insert into public.brand_locations(workspace_id,brand_id,name,slug,time_zone,created_by)
        values(v_workspace,v_brand,p_input->>'name',p_input->>'slug',p_input->>'time_zone',v_actor) returning to_jsonb(brand_locations.*) into v_row;
    when 'update_brand_location' then
      update public.brand_locations set name=p_input->>'name',slug=p_input->>'slug',time_zone=p_input->>'time_zone',version=version+1,updated_at=statement_timestamp()
        where workspace_id=v_workspace and brand_id=v_brand and id=(p_input->>'location_id')::uuid returning to_jsonb(brand_locations.*) into v_row;
    when 'archive_brand_location' then
      update public.brand_locations set status='archived',version=version+1,updated_at=statement_timestamp()
        where workspace_id=v_workspace and brand_id=v_brand and id=(p_input->>'location_id')::uuid returning to_jsonb(brand_locations.*) into v_row;
  end case;
  v_id:=(v_row->>'id')::uuid;
  v_response:=jsonb_build_object('record',v_row);
  insert into public.idempotency_records(workspace_id,actor_id,operation,idempotency_key,request_hash,response_payload)
    values(v_workspace,v_actor,p_operation,p_idempotency_key,v_hash,v_response);
  if v_workspace is null then
    insert into public.studio_events(studio_id,actor_id,action,entity_id,request_id)
      values(v_studio,v_actor,'studio.' || p_operation,v_id,p_request_id);
  else
    insert into public.audit_events(workspace_id,actor_type,actor_id,action,entity_type,entity_id,request_id,details)
      values(v_workspace,'user',v_actor,'platform.' || p_operation,'platform_resource',v_id,p_request_id,'{}');
  end if;
  return v_response;
exception when unique_violation then raise exception using errcode='23505', message='RESOURCE_CONFLICT';
end;
$$;
revoke all on function public.platform_command(text,jsonb,text,text) from public, anon, authenticated, service_role;
grant execute on function public.platform_command(text,jsonb,text,text) to authenticated;
commit;
