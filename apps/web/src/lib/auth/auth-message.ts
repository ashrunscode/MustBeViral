export type AuthMessageKind = 'notice' | 'error';

/** Statuses that report something that worked or a neutral fact; everything else blocks the task. */
const NOTICE_STATUSES: ReadonlySet<string> = new Set([
  'sent',
  'signed_out',
  'password_updated',
  'verification_sent',
  'recovery_sent',
]);

export function authMessageKind(status: string): AuthMessageKind {
  return NOTICE_STATUSES.has(status) ? 'notice' : 'error';
}

export function authMessageClassName(status: string): string {
  return `auth-message auth-message--${authMessageKind(status)}`;
}

export function authMessageRole(status: string): 'status' | 'alert' {
  return authMessageKind(status) === 'notice' ? 'status' : 'alert';
}
