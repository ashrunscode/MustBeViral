import { describe, expect, it } from 'vitest';

import { requiredScopesForOperation, scopesAuthorizeOperation } from '@mustbeviral/contracts';

describe('api key scopes', () => {
  it('requires run:write for quote and start operations', () => {
    expect(requiredScopesForOperation('quote_run')).toContain('run:write');
    expect(requiredScopesForOperation('start_run')).toContain('run:write');
  });

  it('denies operations when required scopes are missing', () => {
    expect(scopesAuthorizeOperation(['run:read'], 'start_run')).toBe(false);
    expect(scopesAuthorizeOperation(['run:write', 'run:read'], 'start_run')).toBe(true);
  });
});
