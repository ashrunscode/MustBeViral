import { describe, expect, it, vi } from 'vitest';

import {
  createStripeWebhookDedupPort,
  StripeWebhookDedupForbiddenError,
  StripeWebhookDedupRejectedError,
  StripeWebhookDedupUnavailableError,
} from '../../src/composition/stripe-webhook-dedup';

const bindings = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
} as never;

const event = {
  eventId: 'evt_1',
  eventType: 'checkout.session.completed',
  livemode: false,
  payloadHash: 'abc123',
} as const;

function respondWith(body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status: 200 }));
}

function respondWithStatus(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () =>
    typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }),
  );
}

describe('stripe webhook dedup', () => {
  it('claims first-seen events through the five-argument claim RPC', async () => {
    const fetchMock = respondWith({ claim: 'inserted' });
    const port = createStripeWebhookDedupPort(bindings, 'req-stripe-dedup-1', fetchMock);

    await expect(port.recordEvent(event)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://example.supabase.co/rest/v1/rpc/record_stripe_webhook_event');
    expect(init?.method).toBe('POST');
    // PostgREST matches an RPC by the exact set of named arguments, and the function takes five, so
    // dropping p_request_id would fail the call instead of recording the claim.
    expect(JSON.parse(String(init?.body))).toStrictEqual({
      p_stripe_event_id: 'evt_1',
      p_event_type: 'checkout.session.completed',
      p_livemode: false,
      p_payload_hash: 'abc123',
      p_request_id: 'req-stripe-dedup-1',
    });
  });

  it('reports duplicate claims as false', async () => {
    const fetchMock = respondWith({ claim: 'duplicate' });
    const port = createStripeWebhookDedupPort(bindings, 'req-stripe-dedup-2', fetchMock);

    await expect(port.recordEvent({ ...event, eventId: 'evt_dup' })).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['the retired four-argument overload shape', { inserted: true }],
    ['a provider webhook claim value', { claim: 'claimed' }],
    ['a non-string claim', { claim: true }],
    ['an array', [{ claim: 'inserted' }]],
    ['null', null],
  ])('fails closed on %s', async (_label, body) => {
    const port = createStripeWebhookDedupPort(bindings, 'req-stripe-dedup-3', respondWith(body));

    await expect(port.recordEvent(event)).rejects.toBeInstanceOf(
      StripeWebhookDedupUnavailableError,
    );
  });

  it.each([
    {
      label: 'HTTP 401',
      respond: () => Response.json({ message: 'Invalid API key' }, { status: 401 }),
      error: StripeWebhookDedupForbiddenError,
    },
    {
      // The historical overload failure: the retired four-argument overload raised 42883 at RETURN
      // and PostgREST answered HTTP 404, so no receipt was ever written.
      label: 'HTTP 404',
      respond: () =>
        Response.json(
          { code: '42883', message: 'operator does not exist: boolean > integer' },
          { status: 404 },
        ),
      error: StripeWebhookDedupUnavailableError,
    },
    {
      label: 'HTTP 500',
      respond: () => Response.json({ code: 'XX000' }, { status: 500 }),
      error: StripeWebhookDedupUnavailableError,
    },
    {
      label: 'HTTP 503',
      respond: () => new Response('upstream connect error', { status: 503 }),
      error: StripeWebhookDedupUnavailableError,
    },
    {
      label: 'a thrown fetch',
      respond: (): Response => {
        throw new TypeError('fetch failed');
      },
      error: StripeWebhookDedupUnavailableError,
    },
    {
      label: 'invalid JSON',
      respond: () =>
        new Response('<html>gateway</html>', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      error: StripeWebhookDedupUnavailableError,
    },
  ])('raises $error.name on $label', async ({ respond, error }) => {
    const fetchMock = vi.fn<typeof fetch>(async () => respond());
    const port = createStripeWebhookDedupPort(bindings, 'req-stripe-dedup-failure', fetchMock);

    await expect(port.recordEvent(event)).rejects.toBeInstanceOf(error);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects forbidden privileged credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 403 }));
    const port = createStripeWebhookDedupPort(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'bad',
      } as never,
      'req-stripe-dedup-4',
      fetchMock,
    );
    await expect(
      port.recordEvent({
        eventId: 'evt_forbidden',
        eventType: 'invoice.paid',
        livemode: false,
        payloadHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(StripeWebhookDedupForbiddenError);
  });

  it('treats a 401 as forbidden', async () => {
    const port = createStripeWebhookDedupPort(
      bindings,
      'req-stripe-dedup-5',
      respondWithStatus(401, { code: 'PGRST301', message: 'JWT expired' }),
    );

    await expect(port.recordEvent(event)).rejects.toBeInstanceOf(StripeWebhookDedupForbiddenError);
  });

  it.each([
    ['blank input', 400, '22023', 'stripe_event_id is required'],
    ['a not-null violation', 400, '23502', 'null value in column "event_type"'],
    ['an unparseable request body', 400, 'PGRST102', 'Empty or invalid json'],
    ['a unique violation', 409, '23505', 'duplicate key value'],
    ['an HTTP 422', 422, '22P02', 'invalid input syntax'],
  ])(
    'reports %s as a permanent rejection, not an outage',
    async (_label, status, code, postgrestMessage) => {
      const port = createStripeWebhookDedupPort(
        bindings,
        'req-stripe-dedup-6',
        respondWithStatus(status, {
          code,
          message: postgrestMessage,
          details: 'Failing row contains (evt_1, abc123).',
          hint: null,
        }),
      );

      const error = await port.recordEvent(event).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StripeWebhookDedupRejectedError);
      expect(error).not.toBeInstanceOf(StripeWebhookDedupUnavailableError);
      const rejected = error as StripeWebhookDedupRejectedError;
      expect(rejected.name).toBe('StripeWebhookDedupRejectedError');
      expect(rejected.status).toBe(status);
      expect(rejected.code).toBe(code);
      // The message is handed to exception telemetry, so it carries only the status and the error
      // code, never PostgREST's message or details, which can echo row values.
      expect(rejected.message).toBe(
        `Stripe webhook dedup RPC rejected the event with HTTP ${status} (${code}).`,
      );
      expect(rejected.message).not.toContain(postgrestMessage);
      expect(rejected.message).not.toContain('evt_1');
    },
  );

  it.each([
    ['a non-JSON body', 'Bad Request'],
    ['a JSON body without a code', { message: 'bad' }],
    ['an event id in the code field', { code: 'evt_1' }],
    ['a lowercase code', { code: '22p02' }],
    ['an overlong code', { code: 'PGRST1234' }],
    ['a numeric code', { code: 22023 }],
    ['a null body', null],
    ['an array body', [{ code: '22023' }]],
  ])(
    'keeps a 400 with %s as unavailable: PostgREST always sends a well-formed code',
    async (_label, body) => {
      const port = createStripeWebhookDedupPort(
        bindings,
        'req-stripe-dedup-7',
        respondWithStatus(400, body),
      );

      const error = await port.recordEvent(event).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StripeWebhookDedupUnavailableError);
      expect(error).not.toBeInstanceOf(StripeWebhookDedupRejectedError);
    },
  );

  it.each([
    ['a retired RPC during a deploy', 400, { code: '0A000' }],
    ['a restricted project', 402, {}],
    ['a missing RPC after a deploy ahead of its migration', 404, { code: 'PGRST202' }],
    ['a read-only database with a nearly full disk', 405, { code: '25006' }],
    ['a schema that is not exposed', 406, { code: 'PGRST106' }],
    ['an undefined function', 404, { code: '42883' }],
    ['a request timeout', 408, {}],
    ['a too-early response', 425, {}],
    ['rate limiting', 429, {}],
    ['a server error', 500, { code: 'XX000' }],
    ['a bad gateway', 502, 'upstream error'],
    ['an unavailable service', 503, {}],
  ])('keeps %s as unavailable', async (_label, status, body) => {
    const port = createStripeWebhookDedupPort(
      bindings,
      'req-stripe-dedup-8',
      respondWithStatus(status, body),
    );

    const error = await port.recordEvent(event).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StripeWebhookDedupUnavailableError);
    expect(error).not.toBeInstanceOf(StripeWebhookDedupRejectedError);
  });
});
