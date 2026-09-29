begin;

-- Core's credential has no operator auth.uid(). Recheck every grant condition against the
-- persisted initiating actor. Keep the subject-bound RLS helper and existing lock order intact.
create or replace function app_private.platform_can_for(p_user_id uuid, p_workspace_id uuid, p_brand_id uuid, p_action text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select p_user_id is not null
    and p_action = any(array['brand:read','brand:write','location:read','location:write'])
    and exists(select 1 from public.workspaces w where w.id = p_workspace_id and w.status = 'active')
    and (
      p_action like '%:read'
      or exists (
        select 1 from public.brands b
        where b.workspace_id = p_workspace_id and b.id = p_brand_id and b.status = 'active')
    )
    and (
      exists(select 1 from public.workspace_memberships m
        where m.workspace_id = p_workspace_id and m.user_id = p_user_id and m.status = 'active' and m.role = 'owner')
      or exists(
        select 1 from public.workspace_access_grants g
        join public.studio_memberships sm on sm.studio_id = g.studio_id
        join public.workspace_memberships o on o.workspace_id = g.workspace_id and o.id = g.owner_membership_id
        join public.studios s on s.id = g.studio_id
        where g.workspace_id = p_workspace_id and (g.brand_id is null or g.brand_id = p_brand_id)
          and p_action = any(g.actions)
          and g.status = 'active' and o.status = 'active' and o.role = 'owner'
          and o.user_id = g.granted_by and s.status = 'active'
          and sm.user_id = p_user_id and sm.status = 'active'
          and (p_action like '%:read' or sm.role in ('owner','editor'))));
$$;
revoke all on function app_private.platform_can_for(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

commit;
