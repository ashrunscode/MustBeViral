import { describe, expect, it } from 'vitest';

import { readPermanentRejection } from '../../src/composition/postgrest-rejection';

function response(status: number, body: unknown): Response {
  return typeof body === 'string'
    ? new Response(body, { status })
    : Response.json(body, { status });
}

describe('PostgREST permanent rejection', () => {
  it.each([
    [
      'invalid input',
      400,
      { code: '22023', message: 'request_id is required' },
      { code: '22023', reason: undefined },
    ],
    [
      'a raised reason token',
      400,
      { code: 'P0001', message: 'STRIPE_EVENT_WORKSPACE_MISMATCH', details: null },
      { code: 'P0001', reason: 'STRIPE_EVENT_WORKSPACE_MISMATCH' },
    ],
    [
      'a request error',
      400,
      { code: 'PGRST100', message: 'failed to parse filter' },
      { code: 'PGRST100', reason: undefined },
    ],
    [
      'a unique violation',
      409,
      { code: '23505', message: 'duplicate key value' },
      { code: '23505', reason: undefined },
    ],
    [
      'a foreign-key violation',
      409,
      { code: '23503', message: 'violates foreign key' },
      { code: '23503', reason: undefined },
    ],
    [
      'an HTTP 422',
      422,
      { code: 'P0001', message: 'VALIDATION_FAILED' },
      { code: 'P0001', reason: 'VALIDATION_FAILED' },
    ],
    [
      'a token followed by row values',
      400,
      { code: 'P0001', message: 'STRIPE_CUSTOMER_AMBIGUOUS: cus_1' },
      { code: 'P0001', reason: undefined },
    ],
    [
      'an overlong token',
      400,
      { code: 'P0001', message: `STRIPE_${'X'.repeat(60)}` },
      { code: 'P0001', reason: undefined },
    ],
    [
      'a lowercase token',
      400,
      { code: 'P0001', message: 'workspace_not_found' },
      { code: 'P0001', reason: undefined },
    ],
  ])('reports %s as permanent', async (_label, status, body, expected) => {
    await expect(readPermanentRejection(response(status, body))).resolves.toStrictEqual(expected);
  });

  it('treats SQLSTATE 0A000 as not permanent: a retired RPC clears once the matching Worker deploys', async () => {
    await expect(
      readPermanentRejection(
        response(400, {
          code: '0A000',
          message: 'apply_stripe_wallet_credit is retired; use apply_stripe_wallet_top_up',
        }),
      ),
    ).resolves.toBeNull();
  });

  it.each([
    ['a non-JSON proxy error page', 'Bad Request'],
    ['a JSON body without a code', { message: 'STRIPE_CUSTOMER_AMBIGUOUS' }],
    ['a null body', null],
    ['an array body', [{ code: '22023', message: 'STRIPE_CUSTOMER_AMBIGUOUS' }]],
    ['a lowercase code', { code: '22p02', message: 'invalid input syntax' }],
    ['an event id in the code field', { code: 'evt_1', message: 'evt_1' }],
    ['an overlong code', { code: 'PGRST1234', message: 'x' }],
    ['a numeric code', { code: 22023, message: 'STRIPE_CUSTOMER_AMBIGUOUS' }],
  ])(
    'does not treat %s as permanent: PostgREST always sends a well-formed code',
    async (_label, body) => {
      await expect(readPermanentRejection(response(400, body))).resolves.toBeNull();
    },
  );

  it.each([
    ['a restricted project', 402],
    ['a missing RPC', 404],
    ['a read-only database', 405],
    ['a schema that is not exposed', 406],
    ['a request timeout', 408],
    ['a too-early response', 425],
    ['rate limiting', 429],
    ['a raised no-data error such as WORKSPACE_NOT_FOUND', 500],
    ['a bad gateway', 502],
    ['too many connections', 503],
    ['a serialization retry that timed out', 504],
  ])('does not treat %s as permanent and leaves the body unread', async (_label, status) => {
    const failure = response(status, { code: 'P0002', message: 'WORKSPACE_NOT_FOUND' });

    await expect(readPermanentRejection(failure)).resolves.toBeNull();
    expect(failure.bodyUsed).toBe(false);
  });
});
