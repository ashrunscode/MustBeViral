import { describe, expect, it } from 'vitest';

import { classifySignInError, safeStudioRedirectPath, studioLoginHref } from './sign-in';

describe('sign-in boundary', () => {
  it('allows only same-origin Studio redirect targets', () => {
    expect(safeStudioRedirectPath('/studio/washbodega/brief?draft=1')).toBe(
      '/studio/washbodega/brief?draft=1',
    );
    expect(safeStudioRedirectPath('https://attacker.invalid/studio')).toBe('/studio');
    expect(safeStudioRedirectPath('//attacker.invalid/studio')).toBe('/studio');
    expect(safeStudioRedirectPath('/admin')).toBe('/studio');
    expect(safeStudioRedirectPath('/studio-attacker')).toBe('/studio');
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

  it('preserves the exact Studio path and query as one encoded login continuation', () => {
    expect(
      studioLoginHref(
        '/studio/workspace-1/review/compare',
        'run=run-1&left=artifact-a&right=artifact-b',
      ),
    ).toBe(
      '/login?next=%2Fstudio%2Fworkspace-1%2Freview%2Fcompare%3Frun%3Drun-1%26left%3Dartifact-a%26right%3Dartifact-b',
    );
    expect(studioLoginHref('//attacker.invalid', 'next=/studio')).toBe('/login?next=%2Fstudio');
  });
});
