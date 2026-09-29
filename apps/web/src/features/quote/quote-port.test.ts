import { describe, expect, it } from 'vitest';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import {
  InMemoryQuotePort,
  WorkerQuotePort,
  canConfirmQuote,
  createGoldenQuote,
  formatQuoteCountdown,
  quoteIsExpired,
  quoteSecondsRemaining,
} from './quote-port';

describe('quote expiry and confirmation gate', () => {
  const now = Date.UTC(2026, 6, 20, 12, 0, 0);
  const quote = createGoldenQuote(now);

  it('creates a complete 15-minute quote and formats the countdown', () => {
    expect(quote.expiresAtMs - quote.createdAtMs).toBe(15 * 60 * 1000);
    expect(quoteSecondsRemaining(quote.expiresAtMs, now)).toBe(900);
    expect(formatQuoteCountdown(900)).toBe('15:00');
    expect(formatQuoteCountdown(0)).toBe('00:00');
  });

  it('expires at the boundary and disables confirmation', () => {
    expect(quoteIsExpired(quote.expiresAtMs, quote.expiresAtMs - 1)).toBe(false);
    expect(quoteIsExpired(quote.expiresAtMs, quote.expiresAtMs)).toBe(true);
    expect(
      canConfirmQuote({
        acknowledged: true,
        confirmationAttempted: false,
        expiresAtMs: quote.expiresAtMs,
        nowMs: quote.expiresAtMs,
        pending: false,
      }),
    ).toBe(false);
    expect(
      canConfirmQuote({
        acknowledged: false,
        confirmationAttempted: false,
        expiresAtMs: quote.expiresAtMs,
        nowMs: now,
        pending: false,
      }),
    ).toBe(false);
    expect(
      canConfirmQuote({
        acknowledged: true,
        confirmationAttempted: true,
        expiresAtMs: quote.expiresAtMs,
        nowMs: now,
        pending: false,
      }),
    ).toBe(false);
  });
});

describe('WorkerQuotePort', () => {
  const success = {
    data: {
      quote: {
        quoteId: 'quote-live',
        workspaceId: 'workspace-live',
        canvasRevisionId: 'revision-live',
        priceCatalogVersionId: 'catalog-live',
        currency: 'USD',
        nodeLines: [
          {
            nodeId: 'node-live',
            modelRouteId: 'route-live',
            providerModelId: 'provider/model-live',
            priceComponents: [
              {
                unit: 'request',
                quantity: '1',
                unitPriceMicros: '4550000',
                totalMicros: '4550000',
              },
            ],
            totalMicros: '4550000',
          },
        ],
        maximumChargeMicros: '4550000',
        createdAt: '2026-08-11T12:00:00.000Z',
        expiresAt: '2026-08-11T12:15:00.000Z',
      },
      confirmationToken: 'confirmation-token-live',
      spend: {
        runCapMicros: '8000000',
        workspaceDayCapMicros: '25000000',
        workspaceDayExposureMicros: '18420000',
      },
    },
    meta: { request_id: 'request-quote-0001' },
  } as const;

  it('creates one immutable quote and maps exact wire micros and cap exposure', async () => {
    const calls: Array<Readonly<{ headers: Headers; url: string }>> = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-quote-0001',
      fetch: async (input, init) => {
        calls.push({ headers: new Headers(init?.headers), url: String(input) });
        return new Response(JSON.stringify(success), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const port = new WorkerQuotePort(client, 'canvas-live', 'revision-live', () => 'quote-idem-1');

    const first = await port.read();
    const replay = await port.read();
    expect(first).toMatchObject({
      type: 'ok',
      quote: {
        totalMicros: 4_550_000n,
        runCapMicros: 8_000_000n,
        workspaceDayCapMicros: 25_000_000n,
        workspaceDayUsedMicros: 18_420_000n,
        confirmationToken: 'confirmation-token-live',
      },
    });
    expect(replay).toEqual(first);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.example.test/v1/canvases/canvas-live/quotes');
    expect(calls[0]?.headers.get('idempotency-key')).toBe('quote-idem-1');
  });

  it('maps the authoritative revision conflict without creating a display fallback', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-quote-0002',
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'REVISION_CONFLICT',
              message: 'The requested state change conflicts with current state.',
              request_id: 'request-quote-0002',
              retryable: false,
              details: { reason: 'revision', actual: 'revision-current' },
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
    });

    await expect(
      new WorkerQuotePort(client, 'canvas-live', 'revision-stale', () => 'quote-idem-2').read(),
    ).resolves.toEqual({
      type: 'conflict',
      expected_revision_id: 'revision-stale',
      actual_revision_id: 'revision-current',
    });
  });
});

describe('InMemoryQuotePort result union', () => {
  it.each(['ok', 'expired_quote', 'cap_exceeded', 'conflict'] as const)(
    'returns the %s branch',
    async (scenario) => {
      const port = new InMemoryQuotePort({ nowMs: 1_000, scenario });
      const quote = port.read();
      const result = await port.confirm({ quote, acknowledged: true, nowMs: 2_000 });
      expect(result.type).toBe(scenario);
    },
  );
});
