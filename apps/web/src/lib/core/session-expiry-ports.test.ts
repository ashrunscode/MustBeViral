import { createMustBeViralRestClient } from '@mustbeviral/contracts';
import { describe, expect, it, vi } from 'vitest';

import { WorkerBriefBootstrapPort } from '../../features/brief/brief-bootstrap';
import { WorkerCanvasReadPort } from '../../features/canvas/canvas-port';
import { WorkerExportPort } from '../../features/export/export-port';
import { WorkerQuotePort } from '../../features/quote/quote-port';
import { WorkerReviewPort } from '../../features/review/review-port';
import { WorkerRunPort } from '../../features/run/run-port';

function readBoundaries(client: ReturnType<typeof createMustBeViralRestClient>) {
  return [
    new WorkerBriefBootstrapPort(client).bootstrap({
      workspaceRef: 'campaign',
      campaignName: 'Session boundary campaign',
    }),
    new WorkerCanvasReadPort(client, 'canvas-session').read(),
    new WorkerQuotePort(client, 'canvas-session', 'revision-session', () => 'quote-session').read(),
    new WorkerRunPort(client, () => 'cancel-session').read('run-session'),
    new WorkerReviewPort(client, 'run-session', 'buyer-session', () => 'review-session').read(),
    new WorkerExportPort(client, 'run-session', () => 'export-session').read(),
  ] as const;
}

describe('worker session-expiry boundaries', () => {
  it('maps a missing Supabase browser token across every Studio worker port', async () => {
    const fetch = vi.fn();
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => null,
      createRequestId: () => 'request-session-missing',
      fetch,
    });

    await expect(Promise.all(readBoundaries(client))).resolves.toEqual(
      Array.from({ length: 6 }, () => ({ type: 'session_expired' })),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps Core UNAUTHENTICATED responses across every Studio worker port', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'expired-session-token',
      createRequestId: () => 'request-session-expired',
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHENTICATED',
              message: 'The bearer session is missing or expired.',
              request_id: 'request-session-expired',
              retryable: false,
            },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    });

    await expect(Promise.all(readBoundaries(client))).resolves.toEqual(
      Array.from({ length: 6 }, () => ({ type: 'session_expired' })),
    );
  });
});
