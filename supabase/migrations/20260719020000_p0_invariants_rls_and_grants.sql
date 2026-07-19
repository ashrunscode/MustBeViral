begin;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function app_private.protect_tenant_identity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id <> old.id or new.workspace_id <> old.workspace_id then
    raise exception using
      errcode = '22023',
      message = 'TENANT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create or replace function app_private.reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = tg_table_name || '_IMMUTABLE';
end;
$$;

create or replace function app_private.enforce_quote_window()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.expires_at is null then
    new.expires_at := new.created_at + interval '15 minutes';
  elsif new.expires_at <> new.created_at + interval '15 minutes' then
    raise exception using
      errcode = '22023',
      message = 'QUOTE_WINDOW_MUST_BE_15_MINUTES';
  end if;
  return new;
end;
$$;

create or replace function app_private.enforce_canvas_revision_parent()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_parent_exists boolean;
begin
  if new.parent_revision_id is null then
    return new;
  end if;

  if new.parent_revision_id = new.id then
    raise exception using errcode = '23514', message = 'REVISION_PARENT_SELF_REFERENCE';
  end if;

  select exists (
    select 1
    from public.canvas_revisions as parent_revision
    where parent_revision.workspace_id = new.workspace_id
      and parent_revision.canvas_id = new.canvas_id
      and parent_revision.id = new.parent_revision_id
  ) into v_parent_exists;

  if not v_parent_exists then
    raise exception using errcode = '23503', message = 'REVISION_PARENT_NOT_FOUND';
  end if;

  return new;
end;
$$;

create or replace function app_private.assert_ledger_transaction_balanced()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_entry_count integer;
  v_workspace_count integer;
  v_entry_type_count integer;
  v_causative_key_count integer;
  v_balance bigint;
begin
  select
    count(*)::integer,
    count(distinct workspace_id)::integer,
    count(distinct entry_type)::integer,
    count(distinct causative_key)::integer,
    coalesce(sum(case direction when 'credit' then amount_micros else -amount_micros end), 0)::bigint
  into
    v_entry_count,
    v_workspace_count,
    v_entry_type_count,
    v_causative_key_count,
    v_balance
  from public.ledger_transactions
  where transaction_id = new.transaction_id;

  if v_entry_count < 2
    or v_workspace_count <> 1
    or v_entry_type_count <> 1
    or v_causative_key_count <> 1
    or v_balance <> 0 then
    raise exception using
      errcode = '23514',
      message = 'LEDGER_TRANSACTION_UNBALANCED';
  end if;

  return null;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function app_private.set_updated_at();
create trigger briefs_set_updated_at
before update on public.briefs
for each row execute function app_private.set_updated_at();
create trigger brand_kits_set_updated_at
before update on public.brand_kits
for each row execute function app_private.set_updated_at();
create trigger projects_set_updated_at
before update on public.projects
for each row execute function app_private.set_updated_at();
create trigger canvases_set_updated_at
before update on public.canvases
for each row execute function app_private.set_updated_at();
create trigger provider_registrations_set_updated_at
before update on public.provider_registrations
for each row execute function app_private.set_updated_at();
create trigger model_routes_set_updated_at
before update on public.model_routes
for each row execute function app_private.set_updated_at();
create trigger runs_set_updated_at
before update on public.runs
for each row execute function app_private.set_updated_at();
create trigger run_nodes_set_updated_at
before update on public.run_nodes
for each row execute function app_private.set_updated_at();
create trigger attempts_set_updated_at
before update on public.attempts
for each row execute function app_private.set_updated_at();
create trigger provider_jobs_set_updated_at
before update on public.provider_jobs
for each row execute function app_private.set_updated_at();
create trigger artifacts_set_updated_at
before update on public.artifacts
for each row execute function app_private.set_updated_at();
create trigger cost_reservations_set_updated_at
before update on public.cost_reservations
for each row execute function app_private.set_updated_at();
create trigger outbox_events_set_updated_at
before update on public.outbox_events
for each row execute function app_private.set_updated_at();

create trigger workspace_memberships_protect_identity
before update on public.workspace_memberships
for each row execute function app_private.protect_tenant_identity();
create trigger briefs_protect_identity
before update on public.briefs
for each row execute function app_private.protect_tenant_identity();
create trigger brand_kits_protect_identity
before update on public.brand_kits
for each row execute function app_private.protect_tenant_identity();
create trigger projects_protect_identity
before update on public.projects
for each row execute function app_private.protect_tenant_identity();
create trigger canvases_protect_identity
before update on public.canvases
for each row execute function app_private.protect_tenant_identity();
create trigger runs_protect_identity
before update on public.runs
for each row execute function app_private.protect_tenant_identity();
create trigger run_nodes_protect_identity
before update on public.run_nodes
for each row execute function app_private.protect_tenant_identity();
create trigger attempts_protect_identity
before update on public.attempts
for each row execute function app_private.protect_tenant_identity();
create trigger provider_jobs_protect_identity
before update on public.provider_jobs
for each row execute function app_private.protect_tenant_identity();
create trigger artifacts_protect_identity
before update on public.artifacts
for each row execute function app_private.protect_tenant_identity();
create trigger cost_reservations_protect_identity
before update on public.cost_reservations
for each row execute function app_private.protect_tenant_identity();
create trigger outbox_events_protect_identity
before update on public.outbox_events
for each row execute function app_private.protect_tenant_identity();

create trigger quotes_enforce_window
before insert on public.quotes
for each row execute function app_private.enforce_quote_window();
create trigger canvas_revisions_enforce_parent
before insert on public.canvas_revisions
for each row execute function app_private.enforce_canvas_revision_parent();

create trigger canvas_revisions_immutable
before update or delete on public.canvas_revisions
for each row execute function app_private.reject_immutable_mutation();
create trigger quotes_immutable
before update or delete on public.quotes
for each row execute function app_private.reject_immutable_mutation();
create trigger ledger_transactions_immutable
before update or delete on public.ledger_transactions
for each row execute function app_private.reject_immutable_mutation();
create trigger artifact_lineage_immutable
before update or delete on public.artifact_lineage
for each row execute function app_private.reject_immutable_mutation();
create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function app_private.reject_immutable_mutation();
create trigger idempotency_records_immutable
before update or delete on public.idempotency_records
for each row execute function app_private.reject_immutable_mutation();
create trigger price_catalog_versions_immutable
before update or delete on public.price_catalog_versions
for each row execute function app_private.reject_immutable_mutation();
create trigger model_route_prices_immutable
before update or delete on public.model_route_prices
for each row execute function app_private.reject_immutable_mutation();

create constraint trigger ledger_transactions_balance
after insert on public.ledger_transactions
deferrable initially deferred
for each row execute function app_private.assert_ledger_transaction_balanced();

create or replace function app_private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function app_private.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = 'owner'
  );
$$;

revoke all on function app_private.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function app_private.protect_tenant_identity() from public, anon, authenticated, service_role;
revoke all on function app_private.reject_immutable_mutation() from public, anon, authenticated, service_role;
revoke all on function app_private.enforce_quote_window() from public, anon, authenticated, service_role;
revoke all on function app_private.enforce_canvas_revision_parent() from public, anon, authenticated, service_role;
revoke all on function app_private.assert_ledger_transaction_balanced() from public, anon, authenticated, service_role;
revoke all on function app_private.is_workspace_member(uuid) from public, anon, service_role;
revoke all on function app_private.is_workspace_owner(uuid) from public, anon, service_role;

grant usage on schema app_private to authenticated;
grant execute on function app_private.is_workspace_member(uuid) to authenticated;
grant execute on function app_private.is_workspace_owner(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_memberships force row level security;
alter table public.briefs enable row level security;
alter table public.briefs force row level security;
alter table public.brand_kits enable row level security;
alter table public.brand_kits force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.canvases enable row level security;
alter table public.canvases force row level security;
alter table public.canvas_revisions enable row level security;
alter table public.canvas_revisions force row level security;
alter table public.quotes enable row level security;
alter table public.quotes force row level security;
alter table public.runs enable row level security;
alter table public.runs force row level security;
alter table public.run_nodes enable row level security;
alter table public.run_nodes force row level security;
alter table public.attempts enable row level security;
alter table public.attempts force row level security;
alter table public.provider_jobs enable row level security;
alter table public.provider_jobs force row level security;
alter table public.artifacts enable row level security;
alter table public.artifacts force row level security;
alter table public.artifact_lineage enable row level security;
alter table public.artifact_lineage force row level security;
alter table public.cost_reservations enable row level security;
alter table public.cost_reservations force row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_transactions force row level security;
alter table public.idempotency_records enable row level security;
alter table public.idempotency_records force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;

create policy workspaces_select_member
on public.workspaces for select to authenticated
using ((select app_private.is_workspace_member(id)));
create policy workspaces_update_owner
on public.workspaces for update to authenticated
using ((select app_private.is_workspace_owner(id)))
with check ((select app_private.is_workspace_owner(id)));

create policy workspace_memberships_select_self
on public.workspace_memberships for select to authenticated
using (user_id = (select auth.uid()) and status = 'active');

create policy briefs_select_member
on public.briefs for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy briefs_insert_owner
on public.briefs for insert to authenticated
with check (
  (select app_private.is_workspace_owner(workspace_id))
  and created_by = (select auth.uid())
);
create policy briefs_update_owner
on public.briefs for update to authenticated
using ((select app_private.is_workspace_owner(workspace_id)))
with check ((select app_private.is_workspace_owner(workspace_id)));
create policy briefs_delete_owner
on public.briefs for delete to authenticated
using ((select app_private.is_workspace_owner(workspace_id)));

create policy brand_kits_select_member
on public.brand_kits for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy brand_kits_insert_owner
on public.brand_kits for insert to authenticated
with check (
  (select app_private.is_workspace_owner(workspace_id))
  and created_by = (select auth.uid())
);
create policy brand_kits_update_owner
on public.brand_kits for update to authenticated
using ((select app_private.is_workspace_owner(workspace_id)))
with check ((select app_private.is_workspace_owner(workspace_id)));
create policy brand_kits_delete_owner
on public.brand_kits for delete to authenticated
using ((select app_private.is_workspace_owner(workspace_id)));

create policy projects_select_member
on public.projects for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy projects_insert_owner
on public.projects for insert to authenticated
with check (
  (select app_private.is_workspace_owner(workspace_id))
  and created_by = (select auth.uid())
);
create policy projects_update_owner
on public.projects for update to authenticated
using ((select app_private.is_workspace_owner(workspace_id)))
with check ((select app_private.is_workspace_owner(workspace_id)));
create policy projects_delete_owner
on public.projects for delete to authenticated
using ((select app_private.is_workspace_owner(workspace_id)));

create policy canvases_select_member
on public.canvases for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy canvas_revisions_select_member
on public.canvas_revisions for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy quotes_select_member
on public.quotes for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy runs_select_member
on public.runs for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy run_nodes_select_member
on public.run_nodes for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy attempts_select_member
on public.attempts for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy provider_jobs_select_member
on public.provider_jobs for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy artifacts_select_member
on public.artifacts for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy artifact_lineage_select_member
on public.artifact_lineage for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy cost_reservations_select_member
on public.cost_reservations for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy ledger_transactions_select_member
on public.ledger_transactions for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy audit_events_select_member
on public.audit_events for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));
create policy outbox_events_select_member
on public.outbox_events for select to authenticated
using ((select app_private.is_workspace_member(workspace_id)));

create policy idempotency_records_select_actor
on public.idempotency_records for select to authenticated
using (
  actor_id = (select auth.uid())
  and (
    workspace_id is null
    or (select app_private.is_workspace_member(workspace_id))
  )
);

grant select on table
  public.workspaces,
  public.workspace_memberships,
  public.briefs,
  public.brand_kits,
  public.projects,
  public.canvases,
  public.canvas_revisions,
  public.quotes,
  public.runs,
  public.run_nodes,
  public.attempts,
  public.provider_jobs,
  public.artifacts,
  public.artifact_lineage,
  public.cost_reservations,
  public.ledger_transactions,
  public.idempotency_records,
  public.audit_events,
  public.outbox_events
to authenticated;

grant select on table
  public.provider_registrations,
  public.price_catalog_versions,
  public.model_routes,
  public.model_route_prices
to authenticated;

grant update (name, slug) on public.workspaces to authenticated;
grant insert (id, workspace_id, title, brief_data, created_by),
  update (title, brief_data), delete on public.briefs to authenticated;
grant insert (id, workspace_id, name, kit_data, created_by),
  update (name, kit_data), delete on public.brand_kits to authenticated;
grant insert (id, workspace_id, brief_id, brand_kit_id, name, status, created_by),
  update (brief_id, brand_kit_id, name, status), delete on public.projects to authenticated;

revoke all on all tables in schema public from public, anon, service_role;
revoke all on all sequences in schema public from public, anon, service_role;

comment on function app_private.is_workspace_member(uuid) is
  'RLS-only membership check derived from auth.uid(); no actor argument is accepted.';
comment on function app_private.is_workspace_owner(uuid) is
  'RLS-only P0 owner check derived from auth.uid(); later roles require an accepted additive migration.';

commit;
