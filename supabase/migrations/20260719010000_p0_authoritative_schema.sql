begin;

create extension if not exists pgcrypto with schema extensions;

alter default privileges in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema public
  revoke all on functions from public, anon, authenticated, service_role;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deletion_pending')),
  created_by uuid not null references auth.users(id) on delete restrict,
  per_run_spend_cap_micros bigint not null default 8000000
    check (per_run_spend_cap_micros >= 0),
  daily_spend_cap_micros bigint not null default 25000000
    check (daily_spend_cap_micros >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null default 'owner' check (role = 'owner'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  unique (workspace_id, user_id),
  unique (workspace_id, id),
  check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create unique index workspace_memberships_one_active_owner_idx
  on public.workspace_memberships (workspace_id)
  where role = 'owner' and status = 'active';
create index workspace_memberships_user_active_idx
  on public.workspace_memberships (user_id, workspace_id)
  where status = 'active';

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  brief_data jsonb not null check (jsonb_typeof(brief_data) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id)
);

create index briefs_workspace_updated_idx
  on public.briefs (workspace_id, updated_at desc, id desc);

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  kit_data jsonb not null check (jsonb_typeof(kit_data) = 'object'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id)
);

create index brand_kits_workspace_updated_idx
  on public.brand_kits (workspace_id, updated_at desc, id desc);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  brief_id uuid,
  brand_kit_id uuid,
  name text not null check (char_length(name) between 1 and 160),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, brief_id)
    references public.briefs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, brand_kit_id)
    references public.brand_kits(workspace_id, id) on delete restrict
);

create index projects_workspace_status_updated_idx
  on public.projects (workspace_id, status, updated_at desc, id desc);

create table public.canvases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null,
  name text not null check (char_length(name) between 1 and 160),
  head_revision_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id) on delete restrict
);

create index canvases_workspace_project_idx
  on public.canvases (workspace_id, project_id, created_at desc, id desc);

create table public.canvas_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  canvas_id uuid not null,
  parent_revision_id uuid,
  graph_schema_version integer not null check (graph_schema_version > 0),
  graph_snapshot jsonb not null check (jsonb_typeof(graph_snapshot) = 'object'),
  canonical_hash text not null check (canonical_hash ~ '^[0-9a-f]{64}$'),
  actor_type text not null check (actor_type in ('user', 'system', 'operator')),
  actor_id uuid references auth.users(id) on delete restrict,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, canvas_id, id),
  foreign key (workspace_id, canvas_id)
    references public.canvases(workspace_id, id) on delete restrict,
  foreign key (workspace_id, canvas_id, parent_revision_id)
    references public.canvas_revisions(workspace_id, canvas_id, id) on delete restrict,
  check (parent_revision_id is null or parent_revision_id <> id),
  check ((actor_type = 'user' and actor_id is not null) or actor_type <> 'user')
);

create unique index canvas_revisions_one_root_idx
  on public.canvas_revisions (canvas_id)
  where parent_revision_id is null;
create index canvas_revisions_workspace_canvas_created_idx
  on public.canvas_revisions (workspace_id, canvas_id, created_at desc, id desc);

alter table public.canvases
  add constraint canvases_head_revision_fk
  foreign key (workspace_id, id, head_revision_id)
  references public.canvas_revisions(workspace_id, canvas_id, id)
  on delete restrict;

create table public.provider_registrations (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique check (provider_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  transport_version text not null check (char_length(transport_version) between 1 and 80),
  status text not null default 'disabled' check (status in ('disabled', 'canary', 'enabled', 'killed')),
  evidence_ref text not null check (char_length(evidence_ref) between 1 and 500),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.price_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  provider_registration_id uuid not null
    references public.provider_registrations(id) on delete restrict,
  version text not null check (char_length(version) between 1 and 120),
  currency text not null default 'USD' check (currency = 'USD'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_ref text not null check (char_length(source_ref) between 1 and 500),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  effective_at timestamptz not null,
  retired_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (provider_registration_id, version),
  check ((status = 'retired' and retired_at is not null) or status <> 'retired')
);

create table public.model_routes (
  id uuid primary key default gen_random_uuid(),
  provider_registration_id uuid not null
    references public.provider_registrations(id) on delete restrict,
  route_key text not null unique check (route_key ~ '^[a-z0-9][a-z0-9_.-]*$'),
  provider_model_id text not null check (char_length(provider_model_id) between 1 and 240),
  driver_version text not null check (char_length(driver_version) between 1 and 80),
  capability text not null check (capability in ('text', 'image', 'video')),
  status text not null default 'disabled' check (status in ('disabled', 'canary', 'enabled', 'killed')),
  input_schema_version integer not null check (input_schema_version > 0),
  output_schema_version integer not null check (output_schema_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (provider_registration_id, provider_model_id, driver_version)
);

create table public.model_route_prices (
  id uuid primary key default gen_random_uuid(),
  price_catalog_version_id uuid not null
    references public.price_catalog_versions(id) on delete restrict,
  model_route_id uuid not null references public.model_routes(id) on delete restrict,
  unit text not null check (unit in ('request', 'image', 'video_second', 'input_token', 'output_token')),
  unit_price_micros bigint not null check (unit_price_micros >= 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (price_catalog_version_id, model_route_id, unit)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null,
  canvas_id uuid not null,
  canvas_revision_id uuid not null,
  price_catalog_version_id uuid not null
    references public.price_catalog_versions(id) on delete restrict,
  execution_plan jsonb not null
    check (jsonb_typeof(execution_plan) = 'array' and jsonb_array_length(execution_plan) > 0),
  quote_hash text not null check (quote_hash ~ '^[0-9a-f]{64}$'),
  maximum_charge_micros bigint not null check (maximum_charge_micros >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  unique (workspace_id, id),
  unique (workspace_id, canvas_id, canvas_revision_id, id),
  foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id) on delete restrict,
  foreign key (workspace_id, canvas_id, canvas_revision_id)
    references public.canvas_revisions(workspace_id, canvas_id, id) on delete restrict,
  check (expires_at = created_at + interval '15 minutes')
);

create index quotes_workspace_expiry_idx
  on public.quotes (workspace_id, expires_at, created_at desc, id desc);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null,
  canvas_id uuid not null,
  canvas_revision_id uuid not null,
  canvas_revision_hash text not null check (canvas_revision_hash ~ '^[0-9a-f]{64}$'),
  quote_id uuid not null,
  status text not null default 'queued'
    check (status in (
      'queued', 'dispatching', 'running', 'partial_succeeded', 'succeeded',
      'cancel_requested', 'canceled', 'failed', 'reconciliation_required'
    )),
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, quote_id),
  foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id) on delete restrict,
  foreign key (workspace_id, canvas_id, canvas_revision_id)
    references public.canvas_revisions(workspace_id, canvas_id, id) on delete restrict,
  foreign key (workspace_id, canvas_id, canvas_revision_id, quote_id)
    references public.quotes(workspace_id, canvas_id, canvas_revision_id, id) on delete restrict
);

create index runs_workspace_status_created_idx
  on public.runs (workspace_id, status, created_at desc, id desc);

create table public.run_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  run_id uuid not null,
  node_key text not null check (char_length(node_key) between 1 and 200),
  model_route_id uuid references public.model_routes(id) on delete restrict,
  status text not null default 'pending'
    check (status in (
      'pending', 'ready', 'queued', 'running', 'succeeded', 'failed',
      'canceled', 'skipped', 'reconciliation_required'
    )),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, run_id, node_key),
  foreign key (workspace_id, run_id)
    references public.runs(workspace_id, id) on delete restrict
);

create index run_nodes_workspace_run_status_idx
  on public.run_nodes (workspace_id, run_id, status, created_at, id);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  run_id uuid not null,
  run_node_id uuid not null,
  provider_registration_id uuid not null
    references public.provider_registrations(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  request_id text not null check (char_length(request_id) between 1 and 200),
  status text not null default 'created'
    check (status in (
      'created', 'submitting', 'submitted', 'running', 'succeeded', 'failed',
      'cancel_requested', 'canceled', 'ambiguous'
    )),
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, run_node_id, attempt_number),
  unique (workspace_id, request_id),
  foreign key (workspace_id, run_id)
    references public.runs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, run_node_id)
    references public.run_nodes(workspace_id, id) on delete restrict,
  check ((lease_owner is null) = (lease_expires_at is null))
);

create index attempts_workspace_status_lease_idx
  on public.attempts (workspace_id, status, lease_expires_at, created_at, id);

create table public.provider_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  run_id uuid not null,
  attempt_id uuid not null,
  provider_registration_id uuid not null
    references public.provider_registrations(id) on delete restrict,
  provider_request_id text not null check (char_length(provider_request_id) between 1 and 300),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'submitted'
    check (status in ('submitted', 'running', 'succeeded', 'failed', 'cancel_requested', 'canceled', 'unknown')),
  normalized_evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(normalized_evidence) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (provider_registration_id, provider_request_id),
  unique (workspace_id, attempt_id),
  foreign key (workspace_id, run_id)
    references public.runs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, attempt_id)
    references public.attempts(workspace_id, id) on delete restrict
);

create index provider_jobs_workspace_status_updated_idx
  on public.provider_jobs (workspace_id, status, updated_at, id);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null,
  run_id uuid,
  canvas_revision_id uuid,
  artifact_kind text not null check (artifact_kind in ('input', 'provider_output', 'approved_output', 'export')),
  status text not null default 'pending'
    check (status in ('pending', 'verifying', 'available', 'quarantined', 'deleted')),
  object_key text not null check (char_length(object_key) between 1 and 1024),
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  mime_type text not null check (char_length(mime_type) between 1 and 160),
  byte_size bigint not null check (byte_size >= 0),
  rights_attestation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(rights_attestation) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (object_key),
  foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id) on delete restrict,
  foreign key (workspace_id, run_id)
    references public.runs(workspace_id, id) on delete restrict,
  foreign key (workspace_id, canvas_revision_id)
    references public.canvas_revisions(workspace_id, id) on delete restrict,
  check (status not in ('available', 'quarantined') or content_hash is not null)
);

create index artifacts_workspace_run_created_idx
  on public.artifacts (workspace_id, run_id, created_at desc, id desc);

create table public.artifact_lineage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  parent_artifact_id uuid not null,
  child_artifact_id uuid not null,
  relationship text not null
    check (relationship in ('input_to_output', 'adaptation', 'motion_source', 'export_member', 'revision_source')),
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, parent_artifact_id, child_artifact_id, relationship),
  foreign key (workspace_id, parent_artifact_id)
    references public.artifacts(workspace_id, id) on delete restrict,
  foreign key (workspace_id, child_artifact_id)
    references public.artifacts(workspace_id, id) on delete restrict,
  check (parent_artifact_id <> child_artifact_id)
);

create index artifact_lineage_workspace_child_idx
  on public.artifact_lineage (workspace_id, child_artifact_id, created_at, id);

create table public.cost_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  quote_id uuid not null,
  run_id uuid not null,
  amount_micros bigint not null check (amount_micros >= 0),
  captured_micros bigint not null default 0 check (captured_micros >= 0),
  released_micros bigint not null default 0 check (released_micros >= 0),
  refunded_micros bigint not null default 0 check (refunded_micros >= 0),
  status text not null default 'active'
    check (status in ('active', 'partially_captured', 'captured', 'released', 'refunded')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, quote_id),
  unique (workspace_id, run_id),
  foreign key (workspace_id, quote_id)
    references public.quotes(workspace_id, id) on delete restrict,
  foreign key (workspace_id, run_id)
    references public.runs(workspace_id, id) on delete restrict,
  check (captured_micros + released_micros <= amount_micros),
  check (refunded_micros <= captured_micros)
);

create index cost_reservations_workspace_created_idx
  on public.cost_reservations (workspace_id, created_at desc, id desc);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  transaction_id uuid not null,
  entry_type text not null check (entry_type in ('credit', 'reserve', 'capture', 'release', 'refund')),
  account_code text not null
    check (account_code in ('funding_clearing', 'wallet_available', 'wallet_reserved', 'usage_expense')),
  direction text not null check (direction in ('debit', 'credit')),
  amount_micros bigint not null check (amount_micros > 0),
  causative_key text not null check (char_length(causative_key) between 1 and 240),
  reservation_id uuid,
  run_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  unique (workspace_id, transaction_id, account_code, direction),
  unique (workspace_id, causative_key, account_code, direction),
  foreign key (workspace_id, reservation_id)
    references public.cost_reservations(workspace_id, id) on delete restrict,
  foreign key (workspace_id, run_id)
    references public.runs(workspace_id, id) on delete restrict
);

create index ledger_transactions_workspace_account_created_idx
  on public.ledger_transactions (workspace_id, account_code, created_at, id);
create index ledger_transactions_workspace_transaction_idx
  on public.ledger_transactions (workspace_id, transaction_id);

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation text not null check (operation ~ '^[a-z][a-z0-9_.-]*$'),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_payload jsonb not null check (jsonb_typeof(response_payload) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz,
  unique (workspace_id, id),
  check (workspace_id is not null or operation = 'create_workspace')
);

create unique index idempotency_records_contract_key_idx
  on public.idempotency_records (
    actor_id,
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    operation,
    idempotency_key
  );
create index idempotency_records_workspace_created_idx
  on public.idempotency_records (workspace_id, created_at desc, id desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'system', 'operator', 'provider')),
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]*$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_.-]*$'),
  entity_id uuid not null,
  request_id text not null check (char_length(request_id) between 1 and 200),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id)
);

create index audit_events_workspace_created_idx
  on public.audit_events (workspace_id, created_at desc, id desc);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  aggregate_type text not null check (aggregate_type ~ '^[a-z][a-z0-9_.-]*$'),
  aggregate_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]*$'),
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 240),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'leased', 'published', 'dead')),
  available_at timestamptz not null default statement_timestamp(),
  lease_owner text,
  lease_expires_at timestamptz,
  publish_attempts integer not null default 0 check (publish_attempts >= 0),
  published_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (workspace_id, id),
  check ((lease_owner is null) = (lease_expires_at is null)),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create index outbox_events_claim_idx
  on public.outbox_events (status, available_at, lease_expires_at, created_at, id)
  where status in ('pending', 'leased');
create index outbox_events_workspace_created_idx
  on public.outbox_events (workspace_id, created_at desc, id desc);

create table app_private.platform_billing_settings (
  singleton boolean primary key default true check (singleton),
  global_daily_spend_cap_micros bigint not null default 100000000
    check (global_daily_spend_cap_micros >= 0),
  updated_at timestamptz not null default statement_timestamp()
);

insert into app_private.platform_billing_settings (singleton)
values (true)
on conflict (singleton) do nothing;

comment on table public.canvas_revisions is
  'Immutable canonical graph snapshots; the application must supply deterministic node and edge ordering.';
comment on table public.ledger_transactions is
  'Append-only balanced double-entry rows in integer USD micros.';
comment on column public.artifacts.object_key is
  'Exact private R2 object key. Provider delivery URLs and signed URLs are never persisted here.';
comment on table app_private.platform_billing_settings is
  'Authoritative machine-only P0 spend limits; no user or Data API grants.';

revoke all on all tables in schema public from public, anon, authenticated, service_role;
revoke all on all sequences in schema public from public, anon, authenticated, service_role;
revoke all on all tables in schema app_private from public, anon, authenticated, service_role;

commit;
