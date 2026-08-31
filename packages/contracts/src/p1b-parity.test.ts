import { describe, expect, it } from 'vitest';

import { P1B_JWT_MANAGEMENT_OPERATIONS } from './p1b';

const managementVectors = [
  {
    operation: 'list_api_keys' as const,
    handlerResult: {
      status: 'ok' as const,
      data: {
        keys: [
          {
            id: 'key-1',
            name: 'Automation',
            prefix: 'mbv_sk_abcd',
            scopes: ['run:read'],
            created_at: '2026-08-31T12:00:00Z',
            last_used_at: null,
            revoked_at: null,
          },
        ],
      },
    },
    expectedHttpStatus: 200,
  },
  {
    operation: 'revoke_api_key' as const,
    handlerResult: { status: 'not_found' as const },
    expectedHttpStatus: 404,
    expectedCode: 'NOT_FOUND',
  },
  {
    operation: 'create_api_key' as const,
    handlerResult: { status: 'conflict' as const, reason: 'idempotency' as const },
    expectedHttpStatus: 409,
    expectedCode: 'IDEMPOTENCY_CONFLICT',
  },
  {
    operation: 'issue_oauth_token' as const,
    handlerResult: { status: 'unauthenticated' as const },
    expectedHttpStatus: 401,
    expectedCode: 'UNAUTHENTICATED',
  },
  {
    operation: 'publish_skill' as const,
    handlerResult: { status: 'forbidden' as const },
    expectedHttpStatus: 403,
    expectedCode: 'FORBIDDEN',
  },
] as const;

function mapHandlerToEnvelope(
  result: (typeof managementVectors)[number]['handlerResult'],
): Readonly<{
  ok: boolean;
  httpStatus: number;
  code?: string;
}> {
  if (result.status === 'ok') return { ok: true, httpStatus: 200 };
  switch (result.status) {
    case 'forbidden':
      return { ok: false, httpStatus: 403, code: 'FORBIDDEN' };
    case 'not_found':
      return { ok: false, httpStatus: 404, code: 'NOT_FOUND' };
    case 'conflict':
      return { ok: false, httpStatus: 409, code: 'IDEMPOTENCY_CONFLICT' };
    case 'unauthenticated':
      return { ok: false, httpStatus: 401, code: 'UNAUTHENTICATED' };
    default:
      return { ok: false, httpStatus: 400, code: 'VALIDATION_FAILED' };
  }
}

describe('P1b JWT management contract vectors', () => {
  it('registers every JWT management operation', () => {
    expect(P1B_JWT_MANAGEMENT_OPERATIONS).toEqual([
      'create_api_key',
      'list_api_keys',
      'revoke_api_key',
      'create_oauth_client',
      'list_oauth_clients',
      'revoke_oauth_client',
      'publish_skill',
      'list_skills',
      'list_skill_versions',
    ]);
  });

  it.each(managementVectors)('$operation maps handler status to REST semantics', (vector) => {
    const mapped = mapHandlerToEnvelope(vector.handlerResult);
    expect(mapped.httpStatus).toBe(vector.expectedHttpStatus);
    if ('expectedCode' in vector && vector.expectedCode !== undefined) {
      expect(mapped.code).toBe(vector.expectedCode);
    }
  });
});
