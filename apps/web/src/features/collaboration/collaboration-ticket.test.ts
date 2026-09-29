import { CollaborationTicketDeniedError } from '@mustbeviral/collaboration';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';
import { describe, expect, it, vi } from 'vitest';

import { requestCollaborationTicket } from './collaboration-ticket';

const canvasId = '20000000-0000-4000-8000-000000000002';

function clientReturning(status: number, payload: unknown, accessToken: string | null = 'jwt') {
  const fetchImplementation = vi.fn(async () => Response.json(payload, { status }));
  const client = createMustBeViralRestClient({
    baseUrl: 'https://studio.example.test/api/core',
    getAccessToken: async () => accessToken,
    fetch: fetchImplementation,
    createRequestId: () => 'request-ticket-0001',
  });
  return { client, fetchImplementation };
}

describe('requestCollaborationTicket', () => {
  it('asks Core for a ticket with the session bearer and returns the bound actor', async () => {
    const actor = {
      actor_id: '9f2c1d7e-5b8a-4c3f-9e21-7a6b5c4d3e2f',
      display_name: 'Collaborator 1A2B',
      color: '#3182d4',
    };
    const { client, fetchImplementation } = clientReturning(200, {
      data: {
        canvas_id: canvasId,
        ticket: 'eyJ2IjoxfQ.c2lnbmF0dXJl',
        expires_at: '2026-09-16T12:01:00.000Z',
        actor,
      },
      meta: { request_id: 'request-ticket-0001' },
    });

    await expect(requestCollaborationTicket(canvasId, client)).resolves.toEqual({
      ticket: 'eyJ2IjoxfQ.c2lnbmF0dXJl',
      actor,
    });
    const [url, init] = fetchImplementation.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://studio.example.test/api/core/v1/canvases/${canvasId}/collaboration-tickets`,
    );
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer jwt');
    expect(headers.has('idempotency-key')).toBe(false);
    expect(init.body).toBeUndefined();
  });

  it('stops retrying when Core refuses for a reason a retry cannot fix', async () => {
    for (const [status, code] of [
      [401, 'UNAUTHENTICATED'],
      [403, 'FORBIDDEN'],
      [503, 'INTERNAL_ERROR'],
    ] as const) {
      const { client } = clientReturning(status, {
        error: { code, message: 'Refused.', request_id: 'request-ticket-0001', retryable: false },
      });
      await expect(requestCollaborationTicket(canvasId, client)).rejects.toBeInstanceOf(
        CollaborationTicketDeniedError,
      );
    }
    const { client: signedOut } = clientReturning(200, {}, null);
    await expect(requestCollaborationTicket(canvasId, signedOut)).rejects.toBeInstanceOf(
      CollaborationTicketDeniedError,
    );
  });

  it('lets the client retry a retryable failure', async () => {
    const { client } = clientReturning(503, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Try again.',
        request_id: 'request-ticket-0001',
        retryable: true,
      },
    });
    const failure = await requestCollaborationTicket(canvasId, client).catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(CollaborationTicketDeniedError);
  });
});
