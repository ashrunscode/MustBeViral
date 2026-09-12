'use client';

import {
  createPlatformRestClient,
  type PlatformInput,
  type PlatformOperation,
  type PlatformOutput,
} from '@mustbeviral/contracts';
import { readWebPublicEnvironment } from '../../config/public-environment';
import { resolveBrowserCoreBaseUrl } from '../../lib/core/browser-client';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';

export class PlatformRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function platformRequest<O extends PlatformOperation>(
  operation: O,
  input: PlatformInput<O>,
  key?: string,
): Promise<PlatformOutput<O>> {
  const environment = readWebPublicEnvironment();
  const supabase = createBrowserSupabaseClient();
  const client = createPlatformRestClient({
    baseUrl: resolveBrowserCoreBaseUrl(
      environment.NEXT_PUBLIC_CORE_API_URL,
      window.location.origin,
    ),
    getAccessToken: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error !== null || !data.session)
        throw new PlatformRequestError(
          'UNAUTHENTICATED',
          'Your session has ended. Sign in to continue.',
        );
      return data.session.access_token;
    },
  });
  const response = await client.execute(operation, input, key);
  if ('error' in response)
    throw new PlatformRequestError(response.error.code, response.error.message);
  return response.data;
}

export function platformErrorMessage(error: unknown): string {
  if (error instanceof PlatformRequestError) {
    if (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
      return 'This resource is unavailable or your access has changed. Return to your studio and choose a permitted brand.';
    if (error.code === 'REVISION_CONFLICT')
      return 'Someone saved a newer version. Your edits are still here. Reload the saved version before trying again.';
    if (error.code === 'RESOURCE_ARCHIVED')
      return 'This record is archived, revoked or expired. Refresh to see its current state.';
    return error.message;
  }
  return 'We could not confirm this request. Check your connection and retry. Your changes are not marked as saved.';
}
