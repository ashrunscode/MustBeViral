export type V1RouteAuth = 'supabase_jwt' | 'fal_signature';

export type V1Operation =
  | 'create_workspace'
  | 'get_workspace'
  | 'create_project'
  | 'get_project'
  | 'create_canvas'
  | 'get_canvas_context'
  | 'apply_canvas_patch'
  | 'validate_graph'
  | 'quote_run'
  | 'start_run'
  | 'get_run'
  | 'cancel_run'
  | 'create_artifact_upload'
  | 'get_artifact'
  | 'create_export'
  | 'explain_model'
  | 'get_receipt'
  | 'ingest_fal_webhook';

export interface V1RouteDefinition {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly operation: V1Operation;
  readonly auth: V1RouteAuth;
  readonly mutation: boolean;
  readonly providerTouching: boolean;
}

export const V1_ROUTE_TABLE = [
  {
    method: 'POST',
    path: '/workspaces',
    operation: 'create_workspace',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'GET',
    path: '/workspaces/:id',
    operation: 'get_workspace',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/workspaces/:id/projects',
    operation: 'create_project',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'GET',
    path: '/projects/:id',
    operation: 'get_project',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/projects/:id/canvases',
    operation: 'create_canvas',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'GET',
    path: '/canvases/:id',
    operation: 'get_canvas_context',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/canvases/:id/patches',
    operation: 'apply_canvas_patch',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/canvases/:id/validate',
    operation: 'validate_graph',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/canvases/:id/quotes',
    operation: 'quote_run',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/quotes/:id/runs',
    operation: 'start_run',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: true,
  },
  {
    method: 'GET',
    path: '/runs/:id',
    operation: 'get_run',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/runs/:id/cancel',
    operation: 'cancel_run',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/artifacts/uploads',
    operation: 'create_artifact_upload',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'GET',
    path: '/artifacts/:id',
    operation: 'get_artifact',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/runs/:id/exports',
    operation: 'create_export',
    auth: 'supabase_jwt',
    mutation: true,
    providerTouching: false,
  },
  {
    method: 'GET',
    path: '/models/:id',
    operation: 'explain_model',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'GET',
    path: '/runs/:id/receipt',
    operation: 'get_receipt',
    auth: 'supabase_jwt',
    mutation: false,
    providerTouching: false,
  },
  {
    method: 'POST',
    path: '/webhooks/fal',
    operation: 'ingest_fal_webhook',
    auth: 'fal_signature',
    mutation: true,
    providerTouching: true,
  },
] as const satisfies readonly V1RouteDefinition[];

export const V1_ROUTE_COUNT = V1_ROUTE_TABLE.length;
