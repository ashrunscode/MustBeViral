import { createHash, generateKeyPairSync, sign } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFalJwksCacheForTests } from '../../../../packages/provider/src/webhook';
import type { CoreBindings } from '../../src/bindings';
import { createFalWebhookVerifierPort } from '../../src/composition/fal-webhook';

describe('fal webhook composition', () => {
  afterEach(() => {
    clearFalJwksCacheForTests();
    vi.unstubAllGlobals();
  });

  it('binds workerd global fetch and durably claims before accepting a signed event', async () => {
    clearFalJwksCacheForTests();
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x?: string };
    const rawBody = Buffer.from(
      JSON.stringify({
        request_id: 'fal-composition-job-001',
        status: 'IN_PROGRESS',
      }),
    );
    const providerEventId = `fal-composition-event-${crypto.randomUUID()}`;
    const providerUserId = 'fal-composition-user';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const message = [
      providerEventId,
      providerUserId,
      timestamp,
      createHash('sha256').update(rawBody).digest('hex'),
    ].join('\n');
    const signature = sign(null, Buffer.from(message), privateKey).toString('hex');
    const privilegedKey = 'fixture-privileged-webhook-key';
    const requestId = 'request-fal-composition-001';
    const calls: Array<Readonly<{ url: string; headers: Headers; body: string }>> = [];
    const receiverSensitiveFetch = vi.fn(function (
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit,
    ) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, headers, body: String(init?.body ?? '') });
      if (url === 'https://rest.fal.ai/.well-known/jwks.json') {
        return Promise.resolve(Response.json({ keys: [{ kty: 'OKP', crv: 'Ed25519', x: jwk.x }] }));
      }
      if (url === 'https://project.supabase.co/rest/v1/rpc/claim_provider_webhook_event') {
        return Promise.resolve(Response.json({ claim: 'claimed' }));
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', receiverSensitiveFetch);
    const secretBindingName = ['SUPABASE', 'SECRET', 'KEY'].join('_');
    const bindings = {
      SUPABASE_URL: 'https://project.supabase.co',
      [secretBindingName]: privilegedKey,
    } as unknown as CoreBindings;
    const verifier = createFalWebhookVerifierPort(bindings, requestId);
    const request = {
      rawBody,
      headers: {
        'x-fal-webhook-request-id': providerEventId,
        'x-fal-webhook-user-id': providerUserId,
        'x-fal-webhook-timestamp': timestamp,
        'x-fal-webhook-signature': signature,
      },
    };

    await expect(verifier.verifyAndMap(request)).resolves.toMatchObject({
      provider: 'fal',
      eventId: providerEventId,
    });
    await expect(verifier.verifyAndMap(request)).rejects.toMatchObject({
      details: { reason: 'webhook_replayed' },
    });

    expect(receiverSensitiveFetch).toHaveBeenCalledTimes(2);
    const claimCall = calls.find((call) => call.url.includes('claim_provider_webhook_event'));
    expect(claimCall).toBeDefined();
    expect(claimCall?.headers.get('apikey')).toBe(privilegedKey);
    expect(claimCall?.headers.get('authorization')).toBeNull();
    expect(JSON.parse(claimCall?.body ?? '{}')).toEqual({
      p_provider: 'fal',
      p_event_id: providerEventId,
      p_request_id: requestId,
    });
  });

  it('rejects a refused privileged credential non-retryably', async () => {
    clearFalJwksCacheForTests();
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x?: string };
    const rawBody = Buffer.from(
      JSON.stringify({ request_id: 'fal-composition-job-002', status: 'IN_PROGRESS' }),
    );
    const providerEventId = `fal-composition-event-${crypto.randomUUID()}`;
    const providerUserId = 'fal-composition-user';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(
      null,
      Buffer.from(
        [
          providerEventId,
          providerUserId,
          timestamp,
          createHash('sha256').update(rawBody).digest('hex'),
        ].join('\n'),
      ),
      privateKey,
    ).toString('hex');
    // A legacy service-role JWT is refused by this RPC with HTTP 401 on the real project, so the
    // deployment fault must never be reported as a retryable outage.
    const refusingFetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://rest.fal.ai/.well-known/jwks.json') {
        return Promise.resolve(Response.json({ keys: [{ kty: 'OKP', crv: 'Ed25519', x: jwk.x }] }));
      }
      return Promise.resolve(
        Response.json(
          { code: '42501', message: 'permission denied for function' },
          { status: 401 },
        ),
      );
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', refusingFetch);
    const secretBindingName = ['SUPABASE', 'SECRET', 'KEY'].join('_');
    const bindings = {
      SUPABASE_URL: 'https://project.supabase.co',
      [secretBindingName]: 'fixture-privileged-webhook-key',
    } as unknown as CoreBindings;
    const verifier = createFalWebhookVerifierPort(bindings, 'request-fal-composition-002');

    await expect(
      verifier.verifyAndMap({
        rawBody,
        headers: {
          'x-fal-webhook-request-id': providerEventId,
          'x-fal-webhook-user-id': providerUserId,
          'x-fal-webhook-timestamp': timestamp,
          'x-fal-webhook-signature': signature,
        },
      }),
    ).rejects.toMatchObject({
      retryable: false,
      details: { reason: 'webhook_dedup_forbidden' },
    });
  });
});
