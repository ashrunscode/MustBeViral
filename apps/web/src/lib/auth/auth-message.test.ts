import { describe, expect, it } from 'vitest';

import { authMessageClassName, authMessageKind, authMessageRole } from './auth-message';

describe('authMessageKind', () => {
  it('treats confirmations as notices', () => {
    for (const status of [
      'sent',
      'signed_out',
      'password_updated',
      'verification_sent',
      'recovery_sent',
    ]) {
      expect(authMessageKind(status)).toBe('notice');
      expect(authMessageRole(status)).toBe('status');
      expect(authMessageClassName(status)).toBe('auth-message auth-message--notice');
    }
  });

  it('treats every blocked or failed state as an error, including rate limits and expired links', () => {
    for (const status of [
      'invalid_credentials',
      'verification_required',
      'rate_limited',
      'expired_link',
      'auth_link_failed',
      'sign_out_failed',
      'mismatch',
      'invalid_password',
      'expired',
      'unexpected',
      'invalid_email',
    ]) {
      expect(authMessageKind(status)).toBe('error');
      expect(authMessageRole(status)).toBe('alert');
      expect(authMessageClassName(status)).toBe('auth-message auth-message--error');
    }
  });
});
