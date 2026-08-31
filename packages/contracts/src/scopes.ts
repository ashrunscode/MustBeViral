import type { P0AuthenticatedRestOperation } from './rest';

export const API_KEY_SCOPES = [
  'workspace:read',
  'workspace:write',
  'canvas:read',
  'canvas:write',
  'run:read',
  'run:write',
  'artifact:read',
  'artifact:write',
  'export:write',
  'model:read',
  'receipt:read',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const OPERATION_REQUIRED_SCOPES: Readonly<
  Record<P0AuthenticatedRestOperation, readonly ApiKeyScope[]>
> = Object.freeze({
  create_workspace: ['workspace:write'],
  get_workspace: ['workspace:read'],
  create_project: ['workspace:write'],
  get_project: ['workspace:read'],
  create_canvas: ['canvas:write'],
  get_canvas_context: ['canvas:read'],
  apply_canvas_patch: ['canvas:write'],
  validate_graph: ['canvas:read'],
  quote_run: ['run:write'],
  start_run: ['run:write'],
  get_run: ['run:read'],
  cancel_run: ['run:write'],
  create_artifact_upload: ['artifact:write'],
  get_artifact: ['artifact:read'],
  approve_artifacts: ['artifact:write'],
  create_export: ['export:write'],
  explain_model: ['model:read'],
  get_receipt: ['receipt:read'],
});

export function requiredScopesForOperation(
  operation: P0AuthenticatedRestOperation,
): readonly ApiKeyScope[] {
  return OPERATION_REQUIRED_SCOPES[operation];
}

export function scopesAuthorizeOperation(
  grantedScopes: readonly string[],
  operation: P0AuthenticatedRestOperation,
): boolean {
  const required = requiredScopesForOperation(operation);
  return required.every((scope) => grantedScopes.includes(scope));
}
