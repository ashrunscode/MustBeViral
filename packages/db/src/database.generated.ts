// DO NOT EDIT. Regenerate from the migrated local database with `pnpm db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GeneratedTable<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

type WorkspaceRow = {
  created_at: string;
  created_by: string;
  daily_spend_cap_micros: number;
  id: string;
  name: string;
  per_run_spend_cap_micros: number;
  slug: string;
  status: string;
  updated_at: string;
};

type WorkspaceMembershipRow = {
  created_at: string;
  id: string;
  revoked_at: string | null;
  role: string;
  status: string;
  user_id: string;
  workspace_id: string;
};

type BriefRow = {
  brief_data: Json;
  created_at: string;
  created_by: string;
  id: string;
  title: string;
  updated_at: string;
  workspace_id: string;
};

type BrandKitRow = {
  created_at: string;
  created_by: string;
  id: string;
  kit_data: Json;
  name: string;
  updated_at: string;
  workspace_id: string;
};

type ProjectRow = {
  brand_kit_id: string | null;
  brief_id: string | null;
  created_at: string;
  created_by: string;
  id: string;
  name: string;
  status: string;
  updated_at: string;
  workspace_id: string;
};

type CanvasRow = {
  created_at: string;
  created_by: string;
  head_revision_id: string | null;
  id: string;
  name: string;
  project_id: string;
  updated_at: string;
  workspace_id: string;
};

type CanvasRevisionRow = {
  actor_id: string | null;
  actor_type: string;
  canonical_hash: string;
  canvas_id: string;
  created_at: string;
  graph_schema_version: number;
  graph_snapshot: Json;
  id: string;
  parent_revision_id: string | null;
  reason: string;
  workspace_id: string;
};

type ProviderRegistrationRow = {
  created_at: string;
  display_name: string;
  evidence_ref: string;
  id: string;
  provider_key: string;
  status: string;
  transport_version: string;
  updated_at: string;
};

type PriceCatalogVersionRow = {
  created_at: string;
  currency: string;
  effective_at: string;
  id: string;
  provider_registration_id: string;
  retired_at: string | null;
  source_hash: string;
  source_ref: string;
  status: string;
  version: string;
};

type ModelRouteRow = {
  capability: string;
  created_at: string;
  driver_version: string;
  id: string;
  input_schema_version: number;
  output_schema_version: number;
  provider_model_id: string;
  provider_registration_id: string;
  route_key: string;
  status: string;
  updated_at: string;
};

type ModelRoutePriceRow = {
  created_at: string;
  id: string;
  model_route_id: string;
  price_catalog_version_id: string;
  unit: string;
  unit_price_micros: number;
};

type QuoteRow = {
  canvas_id: string;
  canvas_revision_id: string;
  created_at: string;
  created_by: string;
  currency: string;
  execution_plan: Json;
  expires_at: string;
  id: string;
  maximum_charge_micros: number;
  price_catalog_version_id: string;
  project_id: string;
  quote_hash: string;
  workspace_id: string;
};

type RunRow = {
  canvas_id: string;
  canvas_revision_hash: string;
  canvas_revision_id: string;
  confirmed_at: string;
  confirmed_by: string;
  created_at: string;
  id: string;
  project_id: string;
  quote_id: string;
  status: string;
  updated_at: string;
  workspace_id: string;
};

type RunNodeRow = {
  created_at: string;
  id: string;
  model_route_id: string | null;
  node_key: string;
  run_id: string;
  status: string;
  updated_at: string;
  workspace_id: string;
};

type AttemptRow = {
  attempt_number: number;
  created_at: string;
  id: string;
  lease_expires_at: string | null;
  lease_owner: string | null;
  provider_registration_id: string;
  request_id: string;
  run_id: string;
  run_node_id: string;
  status: string;
  updated_at: string;
  workspace_id: string;
};

type ProviderJobRow = {
  attempt_id: string;
  created_at: string;
  id: string;
  normalized_evidence: Json;
  provider_registration_id: string;
  provider_request_id: string;
  request_hash: string;
  run_id: string;
  status: string;
  updated_at: string;
  workspace_id: string;
};

type ArtifactRow = {
  artifact_kind: string;
  byte_size: number;
  canvas_revision_id: string | null;
  content_hash: string | null;
  created_at: string;
  id: string;
  mime_type: string;
  object_key: string;
  project_id: string;
  rights_attestation: Json;
  run_id: string | null;
  status: string;
  updated_at: string;
  workspace_id: string;
};

type ArtifactLineageRow = {
  child_artifact_id: string;
  created_at: string;
  id: string;
  parent_artifact_id: string;
  relationship: string;
  workspace_id: string;
};

type CostReservationRow = {
  amount_micros: number;
  captured_micros: number;
  created_at: string;
  id: string;
  quote_id: string;
  refunded_micros: number;
  released_micros: number;
  run_id: string;
  status: string;
  updated_at: string;
  workspace_id: string;
};

type LedgerTransactionRow = {
  account_code: string;
  amount_micros: number;
  causative_key: string;
  created_at: string;
  direction: string;
  entry_type: string;
  id: string;
  metadata: Json;
  reservation_id: string | null;
  run_id: string | null;
  transaction_id: string;
  workspace_id: string;
};

type IdempotencyRecordRow = {
  actor_id: string;
  created_at: string;
  expires_at: string | null;
  id: string;
  idempotency_key: string;
  operation: string;
  request_hash: string;
  response_payload: Json;
  workspace_id: string | null;
};

type AuditEventRow = {
  action: string;
  actor_id: string | null;
  actor_type: string;
  created_at: string;
  details: Json;
  entity_id: string;
  entity_type: string;
  id: string;
  request_id: string;
  workspace_id: string;
};

type OutboxEventRow = {
  aggregate_id: string;
  aggregate_type: string;
  available_at: string;
  created_at: string;
  dedupe_key: string;
  event_type: string;
  id: string;
  lease_expires_at: string | null;
  lease_owner: string | null;
  payload: Json;
  publish_attempts: number;
  published_at: string | null;
  status: string;
  updated_at: string;
  workspace_id: string;
};

export type Database = {
  public: {
    Tables: {
      artifact_lineage: GeneratedTable<
        ArtifactLineageRow,
        'child_artifact_id' | 'parent_artifact_id' | 'relationship' | 'workspace_id'
      >;
      artifacts: GeneratedTable<
        ArtifactRow,
        'artifact_kind' | 'byte_size' | 'mime_type' | 'object_key' | 'project_id' | 'workspace_id'
      >;
      attempts: GeneratedTable<
        AttemptRow,
        | 'attempt_number'
        | 'provider_registration_id'
        | 'request_id'
        | 'run_id'
        | 'run_node_id'
        | 'workspace_id'
      >;
      audit_events: GeneratedTable<
        AuditEventRow,
        'action' | 'actor_type' | 'entity_id' | 'entity_type' | 'request_id' | 'workspace_id'
      >;
      brand_kits: GeneratedTable<BrandKitRow, 'created_by' | 'kit_data' | 'name' | 'workspace_id'>;
      briefs: GeneratedTable<BriefRow, 'brief_data' | 'created_by' | 'title' | 'workspace_id'>;
      canvas_revisions: GeneratedTable<
        CanvasRevisionRow,
        | 'actor_type'
        | 'canonical_hash'
        | 'canvas_id'
        | 'graph_schema_version'
        | 'graph_snapshot'
        | 'reason'
        | 'workspace_id'
      >;
      canvases: GeneratedTable<CanvasRow, 'created_by' | 'name' | 'project_id' | 'workspace_id'>;
      cost_reservations: GeneratedTable<
        CostReservationRow,
        'amount_micros' | 'quote_id' | 'run_id' | 'workspace_id'
      >;
      idempotency_records: GeneratedTable<
        IdempotencyRecordRow,
        'actor_id' | 'idempotency_key' | 'operation' | 'request_hash' | 'response_payload'
      >;
      ledger_transactions: GeneratedTable<
        LedgerTransactionRow,
        | 'account_code'
        | 'amount_micros'
        | 'causative_key'
        | 'direction'
        | 'entry_type'
        | 'transaction_id'
        | 'workspace_id'
      >;
      model_route_prices: GeneratedTable<
        ModelRoutePriceRow,
        'model_route_id' | 'price_catalog_version_id' | 'unit' | 'unit_price_micros'
      >;
      model_routes: GeneratedTable<
        ModelRouteRow,
        | 'capability'
        | 'driver_version'
        | 'input_schema_version'
        | 'output_schema_version'
        | 'provider_model_id'
        | 'provider_registration_id'
        | 'route_key'
      >;
      outbox_events: GeneratedTable<
        OutboxEventRow,
        'aggregate_id' | 'aggregate_type' | 'dedupe_key' | 'event_type' | 'payload' | 'workspace_id'
      >;
      price_catalog_versions: GeneratedTable<
        PriceCatalogVersionRow,
        'effective_at' | 'provider_registration_id' | 'source_hash' | 'source_ref' | 'version'
      >;
      projects: GeneratedTable<ProjectRow, 'created_by' | 'name' | 'workspace_id'>;
      provider_jobs: GeneratedTable<
        ProviderJobRow,
        | 'attempt_id'
        | 'provider_registration_id'
        | 'provider_request_id'
        | 'request_hash'
        | 'run_id'
        | 'workspace_id'
      >;
      provider_registrations: GeneratedTable<
        ProviderRegistrationRow,
        'display_name' | 'evidence_ref' | 'provider_key' | 'transport_version'
      >;
      quotes: GeneratedTable<
        QuoteRow,
        | 'canvas_id'
        | 'canvas_revision_id'
        | 'created_by'
        | 'execution_plan'
        | 'expires_at'
        | 'maximum_charge_micros'
        | 'price_catalog_version_id'
        | 'project_id'
        | 'quote_hash'
        | 'workspace_id'
      >;
      run_nodes: GeneratedTable<RunNodeRow, 'node_key' | 'run_id' | 'workspace_id'>;
      runs: GeneratedTable<
        RunRow,
        | 'canvas_id'
        | 'canvas_revision_hash'
        | 'canvas_revision_id'
        | 'confirmed_by'
        | 'project_id'
        | 'quote_id'
        | 'workspace_id'
      >;
      workspace_memberships: GeneratedTable<WorkspaceMembershipRow, 'user_id' | 'workspace_id'>;
      workspaces: GeneratedTable<WorkspaceRow, 'created_by' | 'name' | 'slug'>;
    };
    Views: Record<string, never>;
    Functions: {
      apply_canvas_revision: {
        Args: {
          p_canvas_id: string;
          p_expected_revision_id: string;
          p_graph_schema_version: number;
          p_graph_snapshot: Json;
          p_idempotency_key: string;
          p_reason: string;
          p_request_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_canvas_with_revision: {
        Args: {
          p_graph_schema_version: number;
          p_graph_snapshot: Json;
          p_idempotency_key: string;
          p_name: string;
          p_project_id: string;
          p_reason: string;
          p_request_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      create_workspace: {
        Args: { p_idempotency_key: string; p_name: string; p_request_id: string; p_slug: string };
        Returns: Json;
      };
      record_ledger_movement: {
        Args: {
          p_amount_micros: number;
          p_causative_key: string;
          p_entry_type: string;
          p_metadata?: Json;
          p_request_id: string;
          p_reservation_id: string | null;
          p_run_id: string | null;
          p_workspace_id: string;
        };
        Returns: Json;
      };
      start_run_barrier: {
        Args: {
          p_canvas_id: string;
          p_confirmed: boolean;
          p_expected_revision_id: string;
          p_idempotency_key: string;
          p_quote_id: string;
          p_request_id: string;
          p_workspace_id: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
