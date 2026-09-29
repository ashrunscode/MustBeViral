import { MustBeViralClientError } from '@mustbeviral/contracts';

export type SessionExpiredResult = { readonly type: 'session_expired' };

export const SESSION_EXPIRED_RESULT: SessionExpiredResult = { type: 'session_expired' };

export function isSessionExpiredFailure(value: unknown): boolean {
  if (value instanceof MustBeViralClientError) return value.code === 'AUTH_REQUIRED';
  if (typeof value !== 'object' || value === null) return false;
  return (value as Readonly<{ code?: unknown }>).code === 'UNAUTHENTICATED';
}
