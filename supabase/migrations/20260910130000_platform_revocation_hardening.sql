begin;

-- A revoked owner cannot silently revive old portfolio grants if that membership is later restored.
create function app_private.revoke_platform_grants_on_owner_change()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare v_grant record;
begin
  if old.role='owner' and old.status='active' and
    (new.status<>'active' or new.role<>'owner' or new.user_id<>old.user_id) then
    for v_grant in update public.workspace_access_grants
      set status='revoked',revoked_at=statement_timestamp(),version=version+1
      where workspace_id=old.workspace_id and owner_membership_id=old.id and status='active'
      returning id,workspace_id loop
      insert into public.audit_events(workspace_id,actor_type,action,entity_type,entity_id,request_id,details)
        values(v_grant.workspace_id,'system','platform.owner_change_revoked_grant','workspace_access_grant',v_grant.id,'platform-owner-change','{}');
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function app_private.revoke_platform_grants_on_owner_change() from public,anon,authenticated,service_role;
create trigger workspace_owner_revoke_platform_grants after update on public.workspace_memberships
  for each row execute function app_private.revoke_platform_grants_on_owner_change();

create or replace function app_private.platform_grant_current(p_grant_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.workspace_access_grants g
    join public.workspace_memberships o on o.workspace_id = g.workspace_id and o.id = g.owner_membership_id
    join public.workspaces w on w.id = g.workspace_id
    join public.studios s on s.id = g.studio_id
    where g.id = p_grant_id and g.status = 'active' and o.status = 'active' and o.role = 'owner'
      and o.user_id = g.granted_by and w.status = 'active' and s.status = 'active'
      and (o.user_id=(select auth.uid()) or exists(select 1 from public.studio_memberships m
        where m.studio_id=g.studio_id and m.user_id=(select auth.uid()) and m.status='active')));
$$;
commit;
