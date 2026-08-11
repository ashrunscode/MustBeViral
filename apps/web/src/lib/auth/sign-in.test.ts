import { describe, expect, it } from 'vitest';

import { classifySignInError, safeStudioRedirectPath } from './sign-in';

describe('sign-in boundary', () => {
  it('allows only same-origin Studio redirect targets', () => {
    expect(safeStudioRedirectPath('/studio/washbodega/brief?draft=1')).toBe(
      '/studio/washbodega/brief?draft=1',
    );
    expect(safeStudioRedirectPath('https://attacker.invalid/studio')).toBe('/studio');
    expect(safeStudioRedirectPath('//attacker.invalid/studio')).toBe('/studio');
    expect(safeStudioRedirectPath('/admin')).toBe('/studio');
  });

  it('maps provider errors to non-secret recovery states', () => {
    expect(classifySignInError({ code: 'invalid_credentials', status: 400 })).toEqual({
      status: 'invalid_credentials',
      message: 'Email or password is incorrect.',
    });
    expect(classifySignInError({ code: 'email_not_confirmed', status: 400 }).status).toBe(
      'verification_required',
    );
    expect(classifySignInError({ status: 429 }).status).toBe('rate_limited');
    expect(classifySignInError({ status: 503 }).status).toBe('unexpected');
  });
});
