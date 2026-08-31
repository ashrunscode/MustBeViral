import type { ApiKeyScope } from '@mustbeviral/contracts';

export type AuthenticationMethod = 'supabase_jwt' | 'api_key' | 'oauth_token';

export interface AuthenticatedActor {
  readonly actorId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly workspaceId?: string;
  readonly scopes?: readonly ApiKeyScope[];
  readonly credentialId?: string;
}
