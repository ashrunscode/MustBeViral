begin;

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create table public.studio_memberships (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  unique (studio_id, user_id),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);
create unique index studio_one_active_owner on public.studio_memberships(studio_id) where role = 'owner' and status = 'active';
create index studio_membership_actor on public.studio_memberships(user_id, studio_id) where status = 'active';
create index studio_page on public.studios(created_at, id);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, slug)
);
create index brand_page on public.brands(workspace_id, created_at, id);
create table public.brand_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  brand_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null check (char_length(slug) between 1 and 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  time_zone text not null check (char_length(time_zone) between 1 and 100),
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  unique (workspace_id, brand_id, id),
  unique (workspace_id, brand_id, slug)
);
create index location_page on public.brand_locations(workspace_id, brand_id, created_at, id);

create table public.workspace_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  studio_id uuid not null references public.studios(id) on delete restrict,
  brand_id uuid,
  owner_membership_id uuid not null,
  granted_by uuid not null references auth.users(id) on delete restrict,
  actions text[] not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, owner_membership_id) references public.workspace_memberships(workspace_id, id) on delete restrict,
  unique (workspace_id, id),
  check (cardinality(actions) between 1 and 4 and array_position(actions, null) is null
    and actions <@ array['brand:read','brand:write','location:read','location:write']::text[]
    and actions @> array['brand:read']::text[]
    and (not 'location:write' = any(actions) or 'location:read' = any(actions))),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);
create unique index workspace_grant_active_scope on public.workspace_access_grants
  (workspace_id, studio_id, coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'active';
create index workspace_grant_studio_page on public.workspace_access_grants(studio_id, created_at, id);
create index workspace_grant_owner on public.workspace_access_grants(workspace_id, owner_membership_id);

create table public.platform_owner_studio_mappings (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  studio_id uuid not null unique references public.studios(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp()
);
create table public.platform_workspace_mappings (
  workspace_id uuid primary key references public.workspaces(id) on delete restrict,
  owner_membership_id uuid not null,
  studio_id uuid not null references public.studios(id) on delete restrict,
  brand_id uuid not null,
  grant_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  foreign key (workspace_id, owner_membership_id) references public.workspace_memberships(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, grant_id) references public.workspace_access_grants(workspace_id, id) on delete restrict
);
create table public.project_brand_mappings (
  workspace_id uuid not null,
  project_id uuid primary key,
  brand_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  foreign key (workspace_id, project_id) references public.projects(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_id) references public.brands(workspace_id, id) on delete restrict
);
create index project_brand_scope on public.project_brand_mappings(workspace_id, brand_id, project_id);

create table public.studio_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action ~ '^studio\.[a-z_.]+$'),
  entity_id uuid not null,
  request_id text not null check (char_length(request_id) between 1 and 200),
  created_at timestamptz not null default statement_timestamp()
);
create index studio_event_page on public.studio_events(studio_id, created_at, id);

-- Owner membership identity, rather than workspace.created_by, is grant authority.
create function app_private.platform_studio_role(p_studio_id uuid)
returns text language sql stable security definer set search_path = pg_catalog as $$
  select m.role from public.studio_memberships m join public.studios s on s.id = m.studio_id
  where m.studio_id = p_studio_id and m.user_id = (select auth.uid()) and m.status = 'active';
$$;
create function app_private.platform_grant_current(p_grant_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.workspace_access_grants g
    join public.workspace_memberships o on o.workspace_id = g.workspace_id and o.id = g.owner_membership_id
    join public.workspaces w on w.id = g.workspace_id
    join public.studios s on s.id = g.studio_id
    where g.id = p_grant_id and g.status = 'active' and o.status = 'active' and o.role = 'owner'
      and o.user_id = g.granted_by and w.status = 'active' and s.status = 'active');
$$;
create function app_private.platform_can(p_workspace_id uuid, p_brand_id uuid, p_action text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select p_action = any(array['brand:read','brand:write','location:read','location:write'])
    and exists(select 1 from public.workspaces w where w.id = p_workspace_id and w.status = 'active')
    and (app_private.is_workspace_owner(p_workspace_id) or exists(
      select 1 from public.workspace_access_grants g
      join public.studio_memberships m on m.studio_id = g.studio_id
      where g.workspace_id = p_workspace_id and (g.brand_id is null or g.brand_id = p_brand_id)
        and p_action = any(g.actions) and app_private.platform_grant_current(g.id)
        and m.user_id = (select auth.uid()) and m.status = 'active'
        and (p_action like '%:read' or m.role in ('owner', 'editor'))));
$$;
revoke all on function app_private.platform_studio_role(uuid), app_private.platform_grant_current(uuid),
  app_private.platform_can(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function app_private.platform_studio_role(uuid), app_private.platform_grant_current(uuid),
  app_private.platform_can(uuid, uuid, text) to authenticated;

-- Every write that can revoke authority shares the row locks taken by platform commands.
create function app_private.serialize_platform_membership()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if tg_table_name = 'workspace_memberships' then
    perform 1 from public.workspaces where id = coalesce(new.workspace_id, old.workspace_id) for update;
  else
    perform 1 from public.studios where id = coalesce(new.studio_id, old.studio_id) for update;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.serialize_platform_membership() from public, anon, authenticated, service_role;
create trigger workspace_membership_platform_lock before insert or update or delete on public.workspace_memberships
  for each row execute function app_private.serialize_platform_membership();
create trigger studio_membership_platform_lock before insert or update or delete on public.studio_memberships
  for each row execute function app_private.serialize_platform_membership();

create function app_private.protect_platform_identity()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if (to_jsonb(new) - array['name','slug','status','version','updated_at','time_zone','role','revoked_at'])
     is distinct from (to_jsonb(old) - array['name','slug','status','version','updated_at','time_zone','role','revoked_at']) then
    raise exception using errcode = '22023', message = 'PLATFORM_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_platform_identity() from public, anon, authenticated, service_role;

do $$ declare t text; begin
  foreach t in array array['studios','studio_memberships','brands','brand_locations','workspace_access_grants',
    'platform_owner_studio_mappings','platform_workspace_mappings','project_brand_mappings','studio_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    if t = any(array['studios','studio_memberships','brands','brand_locations','workspace_access_grants']) then
      execute format('create trigger protect_identity before update on public.%I for each row execute function app_private.protect_platform_identity()', t);
    else
      execute format('create trigger immutable before update or delete on public.%I for each row execute function app_private.reject_immutable_mutation()', t);
    end if;
  end loop;
end $$;
create policy studio_read on public.studios for select to authenticated
  using (app_private.platform_studio_role(id) is not null);
create policy studio_member_read on public.studio_memberships for select to authenticated
  using (app_private.platform_studio_role(studio_id) = 'owner' or (user_id = (select auth.uid()) and status = 'active'));
create policy brand_read on public.brands for select to authenticated
  using (app_private.platform_can(workspace_id, id, 'brand:read'));
create policy location_read on public.brand_locations for select to authenticated
  using (app_private.platform_can(workspace_id, brand_id, 'location:read'));
create policy grant_read on public.workspace_access_grants for select to authenticated
  using (app_private.is_workspace_owner(workspace_id) or
    (app_private.platform_studio_role(studio_id) is not null and app_private.platform_grant_current(id)));
create policy owner_mapping_read on public.platform_owner_studio_mappings for select to authenticated
  using (owner_id = (select auth.uid()) and app_private.platform_studio_role(studio_id) = 'owner');
create policy workspace_mapping_read on public.platform_workspace_mappings for select to authenticated
  using (app_private.is_workspace_owner(workspace_id));
create policy project_mapping_read on public.project_brand_mappings for select to authenticated
  using (app_private.is_workspace_owner(workspace_id) and app_private.platform_can(workspace_id, brand_id, 'brand:read'));
create policy studio_event_read on public.studio_events for select to authenticated
  using (app_private.platform_studio_role(studio_id) = 'owner');

-- Migration/operator-only; callers supply the exact bounded workspace set. No remote invocation is authorized.
create function app_private.backfill_platform_identity(p_workspace_ids uuid[])
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_workspace record; v_studio uuid; v_brand uuid; v_grant uuid; v_created integer := 0; v_projects integer := 0;
begin
  if p_workspace_ids is null or array_position(p_workspace_ids, null) is not null
    or cardinality(p_workspace_ids) <> (select count(distinct x) from unnest(p_workspace_ids) x) then
    raise exception using errcode = '22023', message = 'BACKFILL_INVALID_WORKSPACE_SET';
  end if;
  -- Serialize reruns and freeze the selected owner/project inventory for this bounded backfill.
  perform pg_advisory_xact_lock(hashtextextended('platform-identity-backfill', 0));
  lock table public.workspace_memberships, public.projects in share row exclusive mode;
  perform 1 from public.workspaces where id = any(p_workspace_ids) order by id for update;
  if exists(select 1 from unnest(p_workspace_ids) x where not exists(
    select 1 from public.workspaces w where w.id = x and w.status = 'active')) then
    raise exception using errcode = 'P0002', message = 'BACKFILL_WORKSPACE_NOT_ACTIVE';
  end if;
  if exists(select w.id from public.workspaces w left join public.workspace_memberships m
    on m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
    where w.id = any(p_workspace_ids) group by w.id having count(m.id) <> 1) then
    raise exception using errcode = 'P0001', message = 'BACKFILL_OWNER_CONFLICT';
  end if;
  if exists(select 1 from public.platform_workspace_mappings b
    join public.workspace_memberships m on m.workspace_id = b.workspace_id and m.role = 'owner' and m.status = 'active'
    where b.workspace_id = any(p_workspace_ids) and (b.owner_membership_id <> m.id or not exists(
      select 1 from public.platform_owner_studio_mappings s where s.owner_id = m.user_id and s.studio_id = b.studio_id))) then
    raise exception using errcode = 'P0001', message = 'BACKFILL_MAPPING_CONFLICT';
  end if;
  for v_workspace in select w.id, w.name, m.id membership_id, m.user_id from public.workspaces w
    join public.workspace_memberships m on m.workspace_id = w.id and m.role = 'owner' and m.status = 'active'
    where w.id = any(p_workspace_ids) order by w.id loop
    select studio_id into v_studio from public.platform_owner_studio_mappings where owner_id = v_workspace.user_id;
    if v_studio is null then
      insert into public.studios(name, slug, created_by) values ('My studio', 'owner-' || v_workspace.user_id::text, v_workspace.user_id) returning id into v_studio;
      insert into public.studio_memberships(studio_id, user_id, role) values (v_studio, v_workspace.user_id, 'owner');
      insert into public.platform_owner_studio_mappings(owner_id, studio_id) values (v_workspace.user_id, v_studio);
    elsif not exists(select 1 from public.studios s join public.studio_memberships m on m.studio_id = s.id
      where s.id = v_studio and s.status = 'active' and m.user_id = v_workspace.user_id and m.role = 'owner' and m.status = 'active') then
      raise exception using errcode = 'P0001', message = 'BACKFILL_STUDIO_CONFLICT';
    end if;
    select brand_id into v_brand from public.platform_workspace_mappings where workspace_id = v_workspace.id;
    if v_brand is null then
      insert into public.brands(workspace_id, name, slug, created_by) values (v_workspace.id, v_workspace.name, 'default', v_workspace.user_id) returning id into v_brand;
      insert into public.workspace_access_grants(workspace_id, studio_id, owner_membership_id, granted_by, actions)
        values (v_workspace.id, v_studio, v_workspace.membership_id, v_workspace.user_id, array['brand:read','brand:write','location:read','location:write']) returning id into v_grant;
      insert into public.platform_workspace_mappings(workspace_id, owner_membership_id, studio_id, brand_id, grant_id)
        values (v_workspace.id, v_workspace.membership_id, v_studio, v_brand, v_grant);
      v_created := v_created + 1;
    end if;
    if exists(select 1 from public.project_brand_mappings where workspace_id = v_workspace.id and brand_id <> v_brand) then
      raise exception using errcode = 'P0001', message = 'BACKFILL_PROJECT_CONFLICT';
    end if;
    with mapped as (insert into public.project_brand_mappings(workspace_id, project_id, brand_id)
      select workspace_id, id, v_brand from public.projects where workspace_id = v_workspace.id
      on conflict (project_id) do nothing returning 1) select v_projects + count(*) into v_projects from mapped;
  end loop;
  return jsonb_build_object('workspaces_selected', cardinality(p_workspace_ids), 'workspaces_created', v_created, 'projects_mapped', v_projects);
end;
$$;
revoke all on function app_private.backfill_platform_identity(uuid[]) from public, anon, authenticated, service_role;

-- Existing local inventory is empty. Production backfill must use a reviewed explicit inventory.
-- Additive schema installation deliberately does not infer or bulk-migrate external tenant data.
commit;
