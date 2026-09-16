'use client';

import {
  CollaborationTicketDeniedError,
  type CollaborationTicketGrant,
} from '@mustbeviral/collaboration';
import {
  MustBeViralClientError,
  type MustBeViralRestClient,
  type P0OperationResponse,
} from '@mustbeviral/contracts';

import { createBrowserCoreClient } from '../../lib/core/browser-client';

/**
 * Asks Core for a short-lived collaboration ticket through the authenticated Core browser client.
 * Core verifies the Supabase session and canvas access and returns the identity the ticket binds;
 * the browser never chooses its own collaboration identity.
 */
export async function requestCollaborationTicket(
  canvasId: string,
  client: MustBeViralRestClient = createBrowserCoreClient(),
): Promise<CollaborationTicketGrant> {
  let response: P0OperationResponse<'create_collaboration_ticket'>;
  try {
    response = await client.request('create_collaboration_ticket', { id: canvasId });
  } catch (error) {
    if (error instanceof MustBeViralClientError && error.code === 'AUTH_REQUIRED') {
      throw new CollaborationTicketDeniedError('A signed-in session is required to collaborate.');
    }
    throw error;
  }
  if ('error' in response) {
    // Core marks every refusal a retry cannot fix (no session, no access, not configured) as not
    // retryable. Stop reconnecting on those instead of calling the endpoint again.
    if (!response.error.retryable) {
      throw new CollaborationTicketDeniedError(response.error.code);
    }
    throw new Error(response.error.code);
  }
  return { ticket: response.data.ticket, actor: response.data.actor };
}
