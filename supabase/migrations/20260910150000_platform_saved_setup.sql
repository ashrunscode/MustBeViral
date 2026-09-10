begin;

create table public.brand_onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  brand_id uuid not null,
  origin_studio_id uuid not null references public.studios(id) on delete restrict,
  website_url text not null default '' check (char_length(website_url) <= 2048),
  description text not null default '' check (char_length(description) <= 2000),
  audience text not null default '' check (char_length(audience) <= 2000),
  goals text not null default '' check (char_length(goals) <= 2000),
  current_step text not null default 'identity' check (current_step in ('identity','details','review')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(workspace_id,brand_id),
  foreign key(workspace_id,brand_id) references public.brands(workspace_id,id) on delete restrict
);
comment on table public.brand_onboarding_drafts is 'Unapproved operator input; never extracted facts or approved brand knowledge.';
create index brand_drafts_origin_studio_idx on public.brand_onboarding_drafts(origin_studio_id);
create index brand_drafts_created_by_idx on public.brand_onboarding_drafts(created_by);
create index brand_drafts_updated_by_idx on public.brand_onboarding_drafts(updated_by);

create table public.studio_invitations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  owner_membership_id uuid not null references public.studio_memberships(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  recipient_email text not null check (recipient_email=lower(btrim(recipient_email)) and char_length(recipient_email) between 3 and 254),
  role text not null check (role in ('editor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  version integer not null default 1 check (version > 0),
  expires_at timestamptz not null default (statement_timestamp()+interval '7 days'),
  created_at timestamptz not null default statement_timestamp(),
  accepted_by uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  accepted_membership_version integer check (accepted_membership_version>0),
  revoked_at timestamptz,
  check ((status='accepted' and accepted_by is not null and accepted_at is not null and accepted_membership_version is not null and revoked_at is null)
    or (status='pending' and accepted_by is null and accepted_at is null and accepted_membership_version is null and revoked_at is null)
    or (status='revoked' and accepted_by is null and accepted_at is null and accepted_membership_version is null and revoked_at is not null)),
  check (expires_at > created_at)
);
create unique index studio_invitations_pending_recipient_idx on public.studio_invitations(studio_id,recipient_email) where status='pending';
create index studio_invitations_page_idx on public.studio_invitations(studio_id,created_at,id);
create index studio_invitations_recipient_idx on public.studio_invitations(recipient_email,created_at,id);
create index studio_invitations_owner_idx on public.studio_invitations(owner_membership_id);
create index studio_invitations_creator_idx on public.studio_invitations(created_by);
create index studio_invitations_acceptor_idx on public.studio_invitations(accepted_by);

create function app_private.platform_verified_email() returns text
language sql stable security definer set search_path=pg_catalog as $$
  select lower(email) from auth.users where id=(select auth.uid()) and email_confirmed_at is not null
    and deleted_at is null and (banned_until is null or banned_until<=statement_timestamp());
$$;
create function app_private.platform_invitation_current(p_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from public.studio_invitations i
    join public.studios s on s.id=i.studio_id and s.status='active'
    join public.studio_memberships m on m.id=i.owner_membership_id and m.studio_id=i.studio_id
      and m.user_id=i.created_by and m.role='owner' and m.status='active'
    where i.id=p_id and i.status='pending' and i.expires_at>statement_timestamp()
      and i.recipient_email=app_private.platform_verified_email());
$$;
create function app_private.platform_invited_studio_name(p_id uuid) returns text
language sql stable security definer set search_path=pg_catalog as $$
  select s.name from public.studio_invitations i join public.studios s on s.id=i.studio_id
    where i.id=p_id and app_private.platform_invitation_current(i.id);
$$;
revoke all on function app_private.platform_verified_email(), app_private.platform_invitation_current(uuid),
  app_private.platform_invited_studio_name(uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.platform_verified_email(), app_private.platform_invitation_current(uuid),
  app_private.platform_invited_studio_name(uuid) to authenticated;

alter table public.brand_onboarding_drafts enable row level security;
alter table public.brand_onboarding_drafts force row level security;
alter table public.studio_invitations enable row level security;
alter table public.studio_invitations force row level security;
revoke all on public.brand_onboarding_drafts, public.studio_invitations from public,anon,authenticated,service_role;
grant select on public.brand_onboarding_drafts, public.studio_invitations to authenticated;
create policy draft_read on public.brand_onboarding_drafts for select to authenticated
  using (app_private.platform_can(workspace_id,brand_id,'brand:read'));
create policy invitation_read on public.studio_invitations for select to authenticated
  using (app_private.platform_studio_role(studio_id)='owner' or app_private.platform_invitation_current(id));

-- Pending invitations cannot resurrect authority after an owner or intended member is revoked.
create function app_private.invalidate_studio_invitations() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if tg_op='DELETE' or (old.status='active' and (new.status<>'active' or (old.role='owner' and new.role<>'owner'))) then
    with revoked as (
      update public.studio_invitations i set status='revoked',version=version+1,revoked_at=statement_timestamp()
      where i.studio_id=old.studio_id and i.status='pending' and (i.owner_membership_id=old.id
        or i.recipient_email=(select lower(email) from auth.users where id=old.user_id)) returning id
    ) insert into public.studio_events(studio_id,actor_id,action,entity_id,request_id)
      select old.studio_id,coalesce(auth.uid(),old.user_id),'studio.invitation_authority_revoked',id,'membership-revocation' from revoked;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.invalidate_studio_invitations() from public,anon,authenticated,service_role;
create trigger invalidate_invitations after update or delete on public.studio_memberships
  for each row execute function app_private.invalidate_studio_invitations();

create function app_private.platform_setup_validate(p_input jsonb,p_required text[],p_optional text[] default '{}') returns void
language plpgsql set search_path=pg_catalog as $$
declare k text; v jsonb; extended text[]:=array['website_url','description','audience','goals','current_step','recipient_email','search','expected_updated_at'];
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>65536 or not p_input ?& p_required then
    raise exception using errcode='22023',message='VALIDATION_FAILED';
  end if;
  perform app_private.platform_validate_input(p_input-extended,
    array(select unnest(p_required) except select unnest(extended)),
    array(select unnest(p_optional) except select unnest(extended)));
  for k,v in select * from jsonb_each(p_input) loop
    if not k=any(p_required||p_optional) or v='null'::jsonb then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
    if k=any(extended) then
      if jsonb_typeof(v)<>'string' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
      if (k in ('description','audience','goals') and char_length(p_input->>k)>2000)
        or (k='search' and char_length(p_input->>k)>120)
        or (k='current_step' and p_input->>k not in ('identity','details','review'))
        or (k='recipient_email' and (char_length(p_input->>k)>254 or p_input->>k<>lower(btrim(p_input->>k))
          or p_input->>k !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')) then
        raise exception using errcode='22023',message='VALIDATION_FAILED';
      end if;
      if k='website_url' and (char_length(p_input->>k)>2048 or (p_input->>k<>'' and
        (p_input->>k !~* '^https?://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$'))) then
        raise exception using errcode='22023',message='VALIDATION_FAILED';
      end if;
      if k='expected_updated_at' then
        begin
          if not isfinite((p_input->>k)::timestamptz) then raise exception 'invalid timestamp'; end if;
        exception when others then raise exception using errcode='22023',message='VALIDATION_FAILED'; end;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function app_private.platform_setup_validate(jsonb,text[],text[]) from public,anon,authenticated,service_role;
grant execute on function app_private.platform_setup_validate(jsonb,text[],text[]) to authenticated;

alter table public.idempotency_records drop constraint idempotency_records_check;
alter table public.idempotency_records add constraint idempotency_records_check check (
  workspace_id is not null or operation in ('create_workspace','create_studio','update_studio','archive_studio','set_studio_member','revoke_studio_member',
    'create_studio_invitation','accept_studio_invitation','revoke_studio_invitation')
);

create function public.platform_setup_command(p_operation text,p_input jsonb,p_idempotency_key text,p_request_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  actor uuid:=auth.uid(); ws uuid; st uuid; br uuid; owner_id uuid; resource uuid; member_version integer;
  required text[]; optional text[]:='{}'; payload_hash text; replay public.idempotency_records%rowtype;
  row_data jsonb; result jsonb; brand_data jsonb; invite public.studio_invitations%rowtype; studio_data public.studios%rowtype;
begin
  if actor is null then raise exception using errcode='28000',message='UNAUTHENTICATED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  case p_operation
    when 'start_brand_draft' then required:=array['studio_id','name','slug']; optional:=array['workspace_id'];
    when 'save_brand_draft' then required:=array['workspace_id','brand_id','expected_version','website_url','description','audience','goals','current_step'];
    when 'create_studio_invitation' then required:=array['studio_id','recipient_email','role','expected_version'];
    when 'accept_studio_invitation' then required:=array['invitation_id','expected_version'];
    when 'revoke_studio_invitation' then required:=array['studio_id','invitation_id','expected_version'];
    when 'update_workspace_settings' then required:=array['workspace_id','name','slug','expected_updated_at'];
    else raise exception using errcode='22023',message='VALIDATION_FAILED';
  end case;
  perform app_private.platform_setup_validate(p_input,required,optional);
  ws:=(p_input->>'workspace_id')::uuid; st:=(p_input->>'studio_id')::uuid; br:=(p_input->>'brand_id')::uuid;
  payload_hash:=app_private.hash_canonical_json(p_input);
  -- Start allocates a tenant, so its key is scoped to actor+operation, before that tenant exists.
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_operation||':'||p_idempotency_key,0));
  if p_operation='accept_studio_invitation' then
    select studio_id into st from public.studio_invitations where id=(p_input->>'invitation_id')::uuid;
  end if;
  if p_operation in ('create_studio_invitation','accept_studio_invitation','revoke_studio_invitation') then
    select * into studio_data from public.studios where id=st for update;
    if studio_data.id is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if p_operation='accept_studio_invitation' then
      -- Prevent a concurrent verified-email change from changing the intended recipient mid-acceptance.
      perform id from auth.users where id=actor for share;
      select * into invite from public.studio_invitations where id=(p_input->>'invitation_id')::uuid and studio_id=st for update;
      if invite.recipient_email is distinct from app_private.platform_verified_email() then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
      if not exists(select 1 from public.studio_memberships m where m.id=invite.owner_membership_id and m.studio_id=st and m.user_id=invite.created_by and m.role='owner' and m.status='active') then
        raise exception using errcode='42501',message='FORBIDDEN'; end if;
      if invite.status='accepted' and not exists(select 1 from public.studio_memberships where studio_id=st and user_id=actor and status='active' and version=invite.accepted_membership_version) then
        raise exception using errcode='42501',message='FORBIDDEN'; end if;
      if invite.status='revoked' or (invite.status='pending' and invite.expires_at<=statement_timestamp()) then raise exception using errcode='P0001',message='RESOURCE_ARCHIVED'; end if;
    else
      if app_private.platform_studio_role(st) is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
      if app_private.platform_studio_role(st)<>'owner' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
      if p_operation='revoke_studio_invitation' then
        select * into invite from public.studio_invitations where id=(p_input->>'invitation_id')::uuid and studio_id=st for update;
        if invite.id is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
      end if;
    end if;
    if studio_data.status<>'active' then raise exception using errcode='P0001',message='RESOURCE_ARCHIVED'; end if;
  elsif p_operation='start_brand_draft' then
    perform app_private.lock_platform_workspace(ws,st);
    if not exists(select 1 from public.studios where id=st and status='active') or app_private.platform_studio_role(st) is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if app_private.platform_studio_role(st) not in ('owner','editor') then raise exception using errcode='42501',message='FORBIDDEN'; end if;
    if ws is not null and not app_private.is_workspace_owner(ws) and not exists(select 1 from public.workspace_access_grants g
      where g.workspace_id=ws and g.studio_id=st and g.brand_id is null and 'brand:write'=any(g.actions) and app_private.platform_grant_current(g.id)) then
      raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    if ws is not null and not exists(select 1 from public.workspaces where id=ws and status='active') then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  else
    perform app_private.lock_platform_workspace(ws);
    if p_operation='update_workspace_settings' then
      if not app_private.is_workspace_owner(ws) then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
      select to_jsonb(w) into row_data from public.workspaces w where id=ws;
    else
      select to_jsonb(b) into brand_data from public.brands b where workspace_id=ws and id=br;
      if brand_data is null or not app_private.platform_can(ws,br,'brand:read') then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
      if not app_private.platform_can(ws,br,'brand:write') then raise exception using errcode='42501',message='FORBIDDEN'; end if;
      select to_jsonb(d) into row_data from public.brand_onboarding_drafts d where workspace_id=ws and brand_id=br for update;
      if row_data is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    end if;
  end if;
  select * into replay from public.idempotency_records where actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key;
  if found then
    if replay.request_hash<>payload_hash then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    -- Recheck generated tenant authorization before returning a start replay.
    if p_operation='start_brand_draft' then
      perform app_private.lock_platform_workspace(replay.workspace_id,st);
      if not app_private.platform_can(replay.workspace_id,(replay.response_payload->'brand'->>'id')::uuid,'brand:write') then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
    end if;
    return replay.response_payload;
  end if;
  case p_operation
    when 'start_brand_draft' then
      if ws is null then
        ws:=gen_random_uuid();
        insert into public.workspaces(id,name,slug,created_by) values(ws,p_input->>'name','brand-'||ws::text,actor);
        insert into public.workspace_memberships(workspace_id,user_id,role) values(ws,actor,'owner');
        insert into public.audit_events(workspace_id,actor_type,actor_id,action,entity_type,entity_id,request_id,details)
          values(ws,'user',actor,'workspace.created','workspace',ws,p_request_id,'{}');
      end if;
      insert into public.brands(workspace_id,name,slug,created_by) values(ws,p_input->>'name',p_input->>'slug',actor) returning to_jsonb(brands.*) into brand_data;
      br:=(brand_data->>'id')::uuid;
      if not exists(select 1 from public.workspace_access_grants g where g.workspace_id=ws and g.studio_id=st and g.brand_id is null
        and 'brand:write'=any(g.actions) and app_private.platform_grant_current(g.id)) then
        select id into owner_id from public.workspace_memberships where workspace_id=ws and user_id=actor and role='owner' and status='active';
        if owner_id is null then raise exception using errcode='42501',message='FORBIDDEN'; end if;
        insert into public.workspace_access_grants(workspace_id,studio_id,brand_id,owner_membership_id,granted_by,actions)
          values(ws,st,br,owner_id,actor,array['brand:read','brand:write','location:read','location:write']);
      end if;
      insert into public.brand_onboarding_drafts(workspace_id,brand_id,origin_studio_id,created_by,updated_by)
        values(ws,br,st,actor,actor) returning to_jsonb(brand_onboarding_drafts.*) into row_data;
      result:=jsonb_build_object('brand',brand_data,'draft',row_data);
    when 'save_brand_draft' then
      if brand_data->>'status'<>'active' then raise exception using errcode='P0001',message='RESOURCE_ARCHIVED'; end if;
      if (row_data->>'version')::integer<>(p_input->>'expected_version')::integer then raise exception using errcode='P0001',message='REVISION_CONFLICT'; end if;
      update public.brand_onboarding_drafts set website_url=p_input->>'website_url',description=p_input->>'description',audience=p_input->>'audience',goals=p_input->>'goals',
        current_step=p_input->>'current_step',version=version+1,updated_by=actor,updated_at=clock_timestamp()
        where workspace_id=ws and brand_id=br returning to_jsonb(brand_onboarding_drafts.*) into row_data;
    when 'create_studio_invitation' then
      if studio_data.version<>(p_input->>'expected_version')::integer then raise exception using errcode='P0001',message='REVISION_CONFLICT'; end if;
      if exists(select 1 from public.studio_memberships m join auth.users u on u.id=m.user_id where m.studio_id=st and m.status='active' and lower(u.email)=p_input->>'recipient_email') then
        raise exception using errcode='23505',message='RESOURCE_CONFLICT'; end if;
      select id into owner_id from public.studio_memberships where studio_id=st and user_id=actor and role='owner' and status='active';
      with expired as (update public.studio_invitations set status='revoked',revoked_at=statement_timestamp(),version=version+1
        where studio_id=st and recipient_email=p_input->>'recipient_email' and status='pending' and expires_at<=statement_timestamp() returning id)
      insert into public.studio_events(studio_id,actor_id,action,entity_id,request_id)
        select st,actor,'studio.invitation_expired',id,p_request_id from expired;
      insert into public.studio_invitations(studio_id,owner_membership_id,created_by,recipient_email,role)
        values(st,owner_id,actor,p_input->>'recipient_email',p_input->>'role') returning to_jsonb(studio_invitations.*) into row_data;
      update public.studios set version=version+1,updated_at=clock_timestamp() where id=st;
    when 'accept_studio_invitation' then
      if invite.status<>'pending' then raise exception using errcode='P0001',message='RESOURCE_ARCHIVED'; end if;
      if invite.version<>(p_input->>'expected_version')::integer then raise exception using errcode='P0001',message='REVISION_CONFLICT'; end if;
      if exists(select 1 from public.studio_memberships where studio_id=st and user_id=actor and (role='owner' or status='active')) then raise exception using errcode='23505',message='RESOURCE_CONFLICT'; end if;
      insert into public.studio_memberships(studio_id,user_id,role) values(st,actor,invite.role)
        on conflict(studio_id,user_id) do update set role=excluded.role,status='active',revoked_at=null,version=studio_memberships.version+1
        returning version into member_version;
      update public.studio_invitations set status='accepted',accepted_by=actor,accepted_at=statement_timestamp(),version=version+1,accepted_membership_version=member_version
        where id=invite.id returning to_jsonb(studio_invitations.*) into row_data;
      update public.studios set version=version+1,updated_at=clock_timestamp() where id=st;
    when 'revoke_studio_invitation' then
      if invite.status<>'pending' then raise exception using errcode='P0001',message='RESOURCE_ARCHIVED'; end if;
      if invite.version<>(p_input->>'expected_version')::integer then raise exception using errcode='P0001',message='REVISION_CONFLICT'; end if;
      update public.studio_invitations set status='revoked',revoked_at=statement_timestamp(),version=version+1 where id=invite.id returning to_jsonb(studio_invitations.*) into row_data;
      update public.studios set version=version+1,updated_at=clock_timestamp() where id=st;
    when 'update_workspace_settings' then
      if row_data->>'status'<>'active' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
      if (row_data->>'updated_at')::timestamptz<>(p_input->>'expected_updated_at')::timestamptz then raise exception using errcode='P0001',message='REVISION_CONFLICT'; end if;
      update public.workspaces set name=p_input->>'name',slug=p_input->>'slug',updated_at=clock_timestamp() where id=ws
        returning jsonb_build_object('id',id,'name',name,'slug',slug,'status',status,'updated_at',updated_at) into row_data;
  end case;
  result:=coalesce(result,jsonb_build_object('record',row_data)); resource:=(row_data->>'id')::uuid;
  insert into public.idempotency_records(workspace_id,actor_id,operation,idempotency_key,request_hash,response_payload)
    values(ws,actor,p_operation,p_idempotency_key,payload_hash,result);
  if ws is null then
    insert into public.studio_events(studio_id,actor_id,action,entity_id,request_id) values(st,actor,'studio.'||p_operation,resource,p_request_id);
  else
    insert into public.audit_events(workspace_id,actor_type,actor_id,action,entity_type,entity_id,request_id,details)
      values(ws,'user',actor,'platform.'||p_operation,'platform_setup',resource,p_request_id,'{}');
  end if;
  return result;
exception when unique_violation then raise exception using errcode='23505',message='RESOURCE_CONFLICT';
end;
$$;
revoke all on function public.platform_setup_command(text,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_setup_command(text,jsonb,text,text) to authenticated;
commit;
