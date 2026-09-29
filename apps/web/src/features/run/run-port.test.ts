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
    expect(result.snapshot.recovery?.kind).toBe('content_policy_violation');
    expect(result.snapshot.attempts.find((attempt) => attempt.id === 'motion')?.detail).toMatch(
      /content policy/u,
    );
  });

  it('blocks a reconciliation branch from looking retryable', () => {
    const port = new InMemoryRunPort('reconciliation');
    port.advance('run-lumen-0007', 0);
    const result = port.advance('run-lumen-0007', 1);
    expect(result).toMatchObject({
      type: 'ok',
      snapshot: {
        state: 'reconciliation_required',
        recovery: { kind: 'ambiguous', state: 'reconciliation_required' },
        settlement: { pendingMicros: 1_400_000n },
      },
    });
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

  it('locks an uncertain post-submission transport failure for reconciliation', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('connection closed after request submission');
    });
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-start-uncertain',
      fetch,
    });
    const quote = { ...createGoldenQuote(1_000), id: 'quote-uncertain' };
    const port = new WorkerRunStartPort(client, () => 'start-idem-uncertain');

    await expect(port.confirm({ quote, acknowledged: true, nowMs: 2_000 })).resolves.toEqual({
      type: 'reconciliation_required',
      quoteId: 'quote-uncertain',
      message: expect.stringContaining('Do not submit this paid operation again'),
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('requires a fresh explicit confirmation after session expiry without replaying start_run', async () => {
    let sessionActive = false;
    const startRequests: Array<Readonly<{ headers: Headers; url: string }>> = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      startRequests.push({ headers: new Headers(init?.headers), url: String(input) });
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
          meta: { request_id: 'request-start-session' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => (sessionActive ? 'session-token' : null),
      createRequestId: () => 'request-start-session',
      fetch,
    });
    const createIdempotencyKey = vi.fn(() => 'start-idem-session');
    const quote = { ...createGoldenQuote(1_000), id: 'quote-live', revision: 'revision-live' };
    const port = new WorkerRunStartPort(client, createIdempotencyKey);

    await expect(port.confirm({ quote, acknowledged: true, nowMs: 2_000 })).resolves.toEqual({
      type: 'session_expired',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1);

    sessionActive = true;
    expect(fetch).not.toHaveBeenCalled();
    await expect(port.confirm({ quote, acknowledged: true, nowMs: 2_000 })).resolves.toEqual({
      type: 'ok',
      runId: 'run-live',
      acceptedMaximumMicros: quote.totalMicros,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(startRequests[0]?.url).toContain('quote-live');
    expect(startRequests[0]?.headers.get('idempotency-key')).toBe('start-idem-session');
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
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
              recovery: null,
              spend: {
                currency: 'USD',
                authorizedMicros: '4550000',
                capturedMicros: '150000',
                releasedMicros: '0',
                refundedMicros: '0',
                netMicros: '150000',
                settlementStatus: 'partially_captured',
              },
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
        recovery: null,
        attempts: [
          { id: 'run-node-1', state: 'complete' },
          { id: 'run-node-2', state: 'running' },
        ],
      },
    });
  });

  it('maps a stored content_policy_violation onto customer-safe recovery copy', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-run-0002',
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: {
              run: {
                runId: 'run-blocked',
                projectId: 'project-live',
                canvasId: 'canvas-live',
                canvasRevisionId: 'revision-live',
                quoteId: 'quote-live',
                status: 'failed',
                reservationId: 'reservation-live',
              },
              nodes: [
                {
                  runNodeId: 'run-node-2',
                  nodeKey: 'master-2',
                  modelRouteId: 'route-image',
                  status: 'failed',
                  dispatchWave: 1,
                  providerErrorCode: 'content_policy_violation',
                },
              ],
              recovery: {
                kind: 'content_policy_violation',
                affectedNodeKeys: ['master-2'],
                title: 'Image blocked',
                message:
                  'The image provider blocked this branch as a content-policy violation. No completed output was available to keep.',
                nextAction:
                  'Edit the brief or visual direction, then request a new quote. Do not resubmit the same prompt.',
              },
              spend: {
                currency: 'USD',
                authorizedMicros: '4550000',
                capturedMicros: '0',
                releasedMicros: '4550000',
                refundedMicros: '0',
                netMicros: '0',
                settlementStatus: 'released',
              },
            },
            meta: { request_id: 'request-run-0002' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    const result = await new WorkerRunPort(client, () => 'cancel-idem-2').read('run-blocked');
    expect(result).toMatchObject({
      type: 'ok',
      snapshot: {
        state: 'failed',
        recovery: { kind: 'content_policy_violation' },
        attempts: [{ detail: 'Image blocked by content policy. No charge accepted.' }],
      },
    });
  });
});
