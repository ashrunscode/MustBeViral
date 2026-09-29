-- WP-P3-008: disable every costly/customer behavior and clear production Advisor findings.
begin;

alter table app_private.platform_kill_switches
  alter column generation_enabled set default false,
  alter column provider_routes_enabled set default false;

update app_private.platform_kill_switches
set signups_enabled = false,
    generation_enabled = false,
    provider_routes_enabled = false,
    charging_enabled = false,
    updated_at = statement_timestamp()
where singleton;

drop policy if exists workspace_billing_profiles_select on public.workspace_billing_profiles;
create policy workspace_billing_profiles_select on public.workspace_billing_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = workspace_billing_profiles.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
    )
  );

drop policy if exists api_keys_owner_select on public.api_keys;
create policy api_keys_owner_select on public.api_keys
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = api_keys.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
    )
  );

drop policy if exists oauth_clients_owner_select on public.oauth_clients;
create policy oauth_clients_owner_select on public.oauth_clients
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = oauth_clients.workspace_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
    )
  );

drop policy if exists oauth_access_tokens_owner_select on public.oauth_access_tokens;
create policy oauth_access_tokens_owner_select on public.oauth_access_tokens
  for select to authenticated
  using (
    exists (
      select 1
      from public.oauth_clients as client
      join public.workspace_memberships as membership
        on membership.workspace_id = client.workspace_id
      where client.id = oauth_access_tokens.client_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
    )
  );

drop policy if exists skills_member_select on public.skills;
create policy skills_member_select on public.skills
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = skills.workspace_id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists skill_versions_member_select on public.skill_versions;
create policy skill_versions_member_select on public.skill_versions
  for select to authenticated
  using (
    exists (
      select 1
      from public.skills as skill
      join public.workspace_memberships as membership
        on membership.workspace_id = skill.workspace_id
      where skill.id = skill_versions.skill_id
        and membership.user_id = (select auth.uid())
    )
  );

create index if not exists api_keys_created_by_fk_idx
  on public.api_keys (created_by);
create index if not exists artifacts_workspace_canvas_revision_fk_idx
  on public.artifacts (workspace_id, canvas_revision_id);
create index if not exists artifacts_workspace_project_fk_idx
  on public.artifacts (workspace_id, project_id);
create index if not exists attempts_provider_registration_fk_idx
  on public.attempts (provider_registration_id);
create index if not exists attempts_workspace_run_fk_idx
  on public.attempts (workspace_id, run_id);
create index if not exists audit_events_actor_fk_idx
  on public.audit_events (actor_id);
create index if not exists brand_kits_created_by_fk_idx
  on public.brand_kits (created_by);
create index if not exists briefs_created_by_fk_idx
  on public.briefs (created_by);
create index if not exists canvas_revisions_actor_fk_idx
  on public.canvas_revisions (actor_id);
create index if not exists canvas_revisions_workspace_canvas_parent_fk_idx
  on public.canvas_revisions (workspace_id, canvas_id, parent_revision_id);
create index if not exists canvases_created_by_fk_idx
  on public.canvases (created_by);
create index if not exists canvases_workspace_id_head_revision_fk_idx
  on public.canvases (workspace_id, id, head_revision_id);
create index if not exists ledger_transactions_workspace_reservation_fk_idx
  on public.ledger_transactions (workspace_id, reservation_id);
create index if not exists ledger_transactions_workspace_run_fk_idx
  on public.ledger_transactions (workspace_id, run_id);
create index if not exists model_route_prices_model_route_fk_idx
  on public.model_route_prices (model_route_id);
create index if not exists oauth_access_tokens_actor_fk_idx
  on public.oauth_access_tokens (actor_id);
create index if not exists oauth_clients_created_by_fk_idx
  on public.oauth_clients (created_by);
create index if not exists projects_created_by_fk_idx
  on public.projects (created_by);
create index if not exists projects_workspace_brand_kit_fk_idx
  on public.projects (workspace_id, brand_kit_id);
create index if not exists projects_workspace_brief_fk_idx
  on public.projects (workspace_id, brief_id);
create index if not exists provider_jobs_workspace_run_fk_idx
  on public.provider_jobs (workspace_id, run_id);
create index if not exists quotes_created_by_fk_idx
  on public.quotes (created_by);
create index if not exists quotes_price_catalog_version_fk_idx
  on public.quotes (price_catalog_version_id);
create index if not exists quotes_workspace_project_fk_idx
  on public.quotes (workspace_id, project_id);
create index if not exists run_nodes_model_route_fk_idx
  on public.run_nodes (model_route_id);
create index if not exists runs_confirmed_by_fk_idx
  on public.runs (confirmed_by);
create index if not exists runs_workspace_canvas_revision_fk_idx
  on public.runs (workspace_id, canvas_id, canvas_revision_id);
create index if not exists runs_workspace_canvas_revision_quote_fk_idx
  on public.runs (workspace_id, canvas_id, canvas_revision_id, quote_id);
create index if not exists runs_workspace_project_fk_idx
  on public.runs (workspace_id, project_id);
create index if not exists skill_versions_published_by_fk_idx
  on public.skill_versions (published_by);
create index if not exists skills_created_by_fk_idx
  on public.skills (created_by);
create index if not exists workspaces_created_by_fk_idx
  on public.workspaces (created_by);

commit;
