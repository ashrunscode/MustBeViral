import { describe, expect, it, vi } from 'vitest';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import { createGoldenQuote } from '../quote/quote-port';
import { InMemoryRunPort, WorkerRunPort, WorkerRunStartPort } from './run-port';

describe('InMemoryRunPort', () => {
  it('streams queued, running, first-reviewable, partial, and complete stages', () => {
    const port = new InMemoryRunPort();
    const listener = vi.fn();
    port.subscribe(listener);

    const initial = port.read('run-lumen-0007');
    expect(initial.type).toBe('ok');
    if (initial.type !== 'ok') return;
    expect(initial.snapshot.attempts.map((attempt) => attempt.state)).toEqual([
      'running',
      'queued',
      'queued',
      'queued',
    ]);

    const partial = port.advance(initial.snapshot.runId, 0);
    expect(partial.type).toBe('ok');
    if (partial.type !== 'ok') return;
    expect(partial.snapshot.state).toBe('reviewable');
    expect(partial.snapshot.firstReviewable).toBe(true);
    expect(partial.snapshot.attempts.map((attempt) => attempt.state)).toContain('running');

    port.advance(partial.snapshot.runId, 1);
    const complete = port.advance(partial.snapshot.runId, 2);
    expect(complete.type === 'ok' && complete.snapshot.state).toBe('complete');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('supports a failed terminal branch', () => {
    const port = new InMemoryRunPort('failed');
    port.advance('run-lumen-0007', 0);
    const result = port.advance('run-lumen-0007', 1);
    expect(result.type).toBe('ok');
    if (result.type !== 'ok') return;
    expect(result.snapshot.state).toBe('failed');
    expect(result.snapshot.attempts.find((attempt) => attempt.id === 'motion')?.state).toBe(
      'failed',
    );
  });

  it('cancels active attempts into a terminal state', () => {
    const port = new InMemoryRunPort();
    const result = port.cancel('run-lumen-0007', 0);
    expect(result.type).toBe('ok');
    if (result.type !== 'ok') return;
    expect(result.snapshot.state).toBe('cancelled');
    expect(result.snapshot.attempts.every((attempt) => attempt.state === 'cancelled')).toBe(true);
  });

  it('renders every result union branch', () => {
    const port = new InMemoryRunPort();
    expect(port.read('missing')).toEqual({ type: 'not_found', run_id: 'missing' });
    expect(port.advance('run-lumen-0007', 99)).toEqual({
      type: 'conflict',
      actual_state: 'running',
    });
  });
});

describe('WorkerRunStartPort', () => {
  it('forwards the minted confirmation token and reuses one idempotency key for retries', async () => {
    const calls: Array<Readonly<{ body: string; headers: Headers }>> = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-start-0001',
      fetch: async (_input, init) => {
        calls.push({ body: String(init?.body), headers: new Headers(init?.headers) });
        return new Response(
          JSON.stringify({
            data: {
              run: {
                runId: 'run-live',
                projectId: 'project-live',
                canvasId: 'canvas-live',
                canvasRevisionId: 'revision-live',
                quoteId: 'quote-live',
                status: 'queued',
                reservationId: 'reservation-live',
              },
            },
            meta: { request_id: 'request-start-0001' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const quote = { ...createGoldenQuote(1_000), id: 'quote-live', revision: 'revision-live' };
    const port = new WorkerRunStartPort(client, () => 'start-idem-stable');

    await expect(port.confirm({ quote, acknowledged: true, nowMs: 2_000 })).resolves.toEqual({
      type: 'ok',
      runId: 'run-live',
      acceptedMaximumMicros: quote.totalMicros,
    });
    await port.confirm({ quote, acknowledged: true, nowMs: 2_000 });
    expect(calls.map(({ headers }) => headers.get('idempotency-key'))).toEqual([
      'start-idem-stable',
      'start-idem-stable',
    ]);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
      confirmed: true,
      confirmation_token: quote.confirmationToken,
    });
  });

  it('maps exact authoritative cap micros and keeps the no-spend explanation', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-start-0002',
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'BUDGET_EXCEEDED',
              message: 'The configured budget cap was exceeded.',
              request_id: 'request-start-0002',
              retryable: false,
              details: {
                tier: 'workspace_day',
                cap_micros: '25000000',
                requested_micros: '4550000',
              },
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
    });

    await expect(
      new WorkerRunStartPort(client, () => 'start-idem-cap').confirm({
        quote: createGoldenQuote(1_000),
        acknowledged: true,
        nowMs: 2_000,
      }),
    ).resolves.toMatchObject({
      type: 'cap_exceeded',
      capMicros: 25_000_000n,
      attemptedMicros: 4_550_000n,
      explanation: expect.stringContaining('No provider work was submitted'),
    });
  });
});

describe('WorkerRunPort', () => {
  it('maps authoritative ordered run nodes into the locked progress states', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-run-0001',
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: {
              run: {
                runId: 'run-live',
                projectId: 'project-live',
                canvasId: 'canvas-live',
                canvasRevisionId: 'revision-live',
                quoteId: 'quote-live',
                status: 'partial_succeeded',
                reservationId: 'reservation-live',
              },
              nodes: [
                {
                  runNodeId: 'run-node-1',
                  nodeKey: 'concept-node',
                  modelRouteId: 'route-text',
                  status: 'succeeded',
                  dispatchWave: 0,
                },
                {
                  runNodeId: 'run-node-2',
                  nodeKey: 'image-node',
                  modelRouteId: 'route-image',
                  status: 'running',
                  dispatchWave: 1,
                },
              ],
            },
            meta: { request_id: 'request-run-0001' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    await expect(
      new WorkerRunPort(client, () => 'cancel-idem-1').read('run-live'),
    ).resolves.toMatchObject({
      type: 'ok',
      snapshot: {
        state: 'reviewable',
        firstReviewable: true,
        attempts: [
          { id: 'run-node-1', state: 'complete' },
          { id: 'run-node-2', state: 'running' },
        ],
      },
    });
  });
});
