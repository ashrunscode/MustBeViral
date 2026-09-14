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

const UNAVAILABLE_REQUEST = 'We could not confirm this request. Check your connection and retry.';
const UNSAVED_CHANGES = 'Your changes are not marked as saved.';

export function platformErrorMessage(error: unknown): string {
  if (error instanceof PlatformRequestError) {
    if (error.code === 'FORBIDDEN')
      return 'You do not have permission for this action. Return to your studio and use an allowed role.';
    if (error.code === 'NOT_FOUND')
      return 'This resource is unavailable or your access has changed. Return to your studio and choose a permitted brand.';
    if (error.code === 'REVISION_CONFLICT')
      return 'Someone saved a newer version. Your edits are still here. Reload the saved version before trying again.';
    if (error.code === 'RESOURCE_ARCHIVED')
      return 'This record is archived, revoked or expired. Refresh to see its current state.';
    if (error.code === 'SOURCE_UNSAFE')
      return 'That destination is not a permitted public website.';
    if (error.code === 'SOURCE_UNSUPPORTED')
      return 'Use a text, Markdown, or HTML file. PDF and Word files are not supported yet.';
    if (error.code === 'SOURCE_MALFORMED')
      return 'That file could not be read as a supported document.';
    if (error.code === 'SOURCE_TOO_LARGE') return 'That source is larger than the capture limit.';
    if (error.code === 'SOURCE_TIMEOUT')
      return 'The website did not respond in time. You can retry.';
    if (error.code === 'SOURCE_UNREACHABLE')
      return 'The website could not be retrieved. You can retry.';
    if (error.code === 'SOURCE_INTERRUPTED')
      return 'Capture stopped before it finished. You can retry.';
    if (error.code === 'SOURCE_EGRESS_UNAVAILABLE')
      return 'Website capture is not configured in this environment.';
    if (error.code === 'INTERNAL_ERROR') return UNAVAILABLE_REQUEST;
    return error.message;
  }
  return UNAVAILABLE_REQUEST;
}

export function platformMutationErrorMessage(error: unknown): string {
  const message = platformErrorMessage(error);
  const uncertain = !(error instanceof PlatformRequestError) || error.code === 'INTERNAL_ERROR';
  if (!uncertain || message.includes(UNSAVED_CHANGES)) return message;
  return `${message} ${UNSAVED_CHANGES}`;
}
