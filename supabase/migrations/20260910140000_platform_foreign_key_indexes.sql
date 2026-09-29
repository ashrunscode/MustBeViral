begin;
-- Preserve the existing all-foreign-keys-covered gate for additive portfolio relations.
create index studios_creator_fk on public.studios(created_by);
create index brands_creator_fk on public.brands(created_by);
create index brand_locations_creator_fk on public.brand_locations(created_by);
create index studio_events_actor_fk on public.studio_events(actor_id);
create index workspace_grants_issuer_fk on public.workspace_access_grants(granted_by);
create index workspace_grants_brand_fk on public.workspace_access_grants(workspace_id,brand_id);
create index platform_mapping_studio_fk on public.platform_workspace_mappings(studio_id);
create index platform_mapping_brand_fk on public.platform_workspace_mappings(workspace_id,brand_id);
create index platform_mapping_grant_fk on public.platform_workspace_mappings(workspace_id,grant_id);
create index platform_mapping_owner_fk on public.platform_workspace_mappings(workspace_id,owner_membership_id);
create index project_brand_mapping_project_fk on public.project_brand_mappings(workspace_id,project_id);
commit;
