import { describe, expect, it, vi } from 'vitest';

import { ApiErrorEnvelopeSchema } from '@mustbeviral/contracts';

import { createCoreApp, defaultV1Dependencies } from '../../src/app';

// Synthetic retained origin: this fixture does not alter any deployed binding.
const retainedOrigin = 'https://retained-production.example';
const approvedOrigins = ['https://mustbeviral.com', 'https://www.mustbeviral.com', retainedOrigin];

async function unauthenticatedRequest(origin: string | undefined, configured?: string) {
  const verify = vi.fn();
  const resolve = vi.fn();
  const app = createCoreApp({
    ...defaultV1Dependencies,
    jwt: { verify },
    workspaces: { resolve },
  });
  const response = await app.request(
    'http://core.test/mcp',
    {
      headers: {
        accept: 'application/json, text/event-stream',
        ...(origin === undefined ? {} : { origin }),
      },
    },
    (configured === undefined ? {} : { CORS_ALLOWED_ORIGINS: configured }) as PlatformBindings,
  );
  const body = ApiErrorEnvelopeSchema.parse(await response.json());
  expect(verify).not.toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
  return { response, body };
}

describe('MCP origin and authentication boundary', () => {
  it.each(approvedOrigins)('requires authentication after admitting %s', async (origin) => {
    const { response, body } = await unauthenticatedRequest(origin, approvedOrigins.join(','));
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    'https://attacker.invalid',
    'http://mustbeviral.com',
    'https://mustbeviral.com:444',
    'https://mustbeviral.com/',
    'https://mustbeviral.com.attacker.invalid',
    'https://www.mustbeviral.com.attacker.invalid',
    'https://mustbeviral.com@attacker.invalid',
    'https://mustbeviral.com,https://attacker.invalid',
    'null',
  ])('refuses unapproved or malformed browser origin %s', async (origin) => {
    const { response, body } = await unauthenticatedRequest(origin, approvedOrigins.join(','));
    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('fails closed for a browser caller when the binding is missing', async () => {
    const { response, body } = await unauthenticatedRequest('https://mustbeviral.com');
    expect(response.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('still requires authentication for a non-browser caller without an Origin header', async () => {
    const { response, body } = await unauthenticatedRequest(undefined);
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });
});
