export type P1bRouteAuth = 'supabase_jwt' | 'client_credentials';

export type P1bOperation =
  | 'issue_oauth_token'
  | 'create_api_key'
  | 'list_api_keys'
  | 'revoke_api_key'
  | 'create_oauth_client'
  | 'list_oauth_clients'
  | 'revoke_oauth_client'
  | 'publish_skill'
  | 'list_skills';

export interface P1bRouteDefinition {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly operation: P1bOperation;
  readonly auth: P1bRouteAuth;
  readonly mutation: boolean;
}

export const P1B_ROUTE_TABLE = [
  {
    method: 'POST',
    path: '/oauth/token',
    operation: 'issue_oauth_token',
    auth: 'client_credentials',
    mutation: false,
  },
  {
    method: 'POST',
    path: '/workspaces/:id/api-keys',
    operation: 'create_api_key',
    auth: 'supabase_jwt',
    mutation: true,
  },
  {
    method: 'GET',
    path: '/workspaces/:id/api-keys',
    operation: 'list_api_keys',
    auth: 'supabase_jwt',
    mutation: false,
  },
  {
    method: 'POST',
    path: '/api-keys/:id/revoke',
    operation: 'revoke_api_key',
    auth: 'supabase_jwt',
    mutation: true,
  },
  {
    method: 'POST',
    path: '/workspaces/:id/oauth-clients',
    operation: 'create_oauth_client',
    auth: 'supabase_jwt',
    mutation: true,
  },
  {
    method: 'GET',
    path: '/workspaces/:id/oauth-clients',
    operation: 'list_oauth_clients',
    auth: 'supabase_jwt',
    mutation: false,
  },
  {
    method: 'POST',
    path: '/oauth-clients/:id/revoke',
    operation: 'revoke_oauth_client',
    auth: 'supabase_jwt',
    mutation: true,
  },
  {
    method: 'POST',
    path: '/workspaces/:id/skills/publish',
    operation: 'publish_skill',
    auth: 'supabase_jwt',
    mutation: true,
  },
  {
    method: 'GET',
    path: '/workspaces/:id/skills',
    operation: 'list_skills',
    auth: 'supabase_jwt',
    mutation: false,
  },
] as const satisfies readonly P1bRouteDefinition[];

export const P1B_ROUTE_COUNT = P1B_ROUTE_TABLE.length;
