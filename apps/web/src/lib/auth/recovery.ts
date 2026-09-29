import { z } from 'zod';

import { safeStudioRedirectPath } from './sign-in';

export interface AuthErrorLike {
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

export type RecoveryRequestState =
  | { readonly status: 'idle' }
  | { readonly status: 'invalid_email'; readonly message: string }
  | { readonly status: 'sent'; readonly message: string }
  | { readonly status: 'rate_limited'; readonly message: string }
  | { readonly status: 'unexpected'; readonly message: string };

export type PasswordResetState =
  | { readonly status: 'idle' }
  | { readonly status: 'invalid_password'; readonly message: string }
  | { readonly status: 'mismatch'; readonly message: string }
  | { readonly status: 'expired'; readonly message: string }
  | { readonly status: 'rate_limited'; readonly message: string }
  | { readonly status: 'sign_out_failed'; readonly message: string }
  | { readonly status: 'unexpected'; readonly message: string };

export const INITIAL_RECOVERY_REQUEST_STATE: RecoveryRequestState = { status: 'idle' };
export const INITIAL_PASSWORD_RESET_STATE: PasswordResetState = { status: 'idle' };
export const RECOVERY_SENT_STATE: RecoveryRequestState = {
  status: 'sent',
  message: 'If the account exists, recovery instructions are on the way.',
};

export const PASSWORD_POLICY_MESSAGE =
  'Use at least 8 characters with an uppercase letter, a lowercase letter, and a number.';

const EmailSchema = z.email();

const EXPIRED_AUTH_CODES = new Set([
  'bad_code_verifier',
  'flow_state_expired',
  'flow_state_not_found',
  'invite_not_found',
  'otp_expired',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_expired',
  'session_not_found',
]);

const RATE_LIMIT_AUTH_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);

export function normalizedRecoveryEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return EmailSchema.safeParse(email).success ? email : null;
}

export function classifyRecoveryRequestError(error: AuthErrorLike): RecoveryRequestState {
  if (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit'
  ) {
    return {
      status: 'rate_limited',
      message: 'Too many recovery requests. Wait a moment, then try again.',
    };
  }
  if (error.code === 'email_address_invalid') {
    return { status: 'invalid_email', message: 'Enter a valid email address.' };
  }
  if (error.code === 'user_not_found' || error.code === 'email_not_found') {
    return RECOVERY_SENT_STATE;
  }
  return {
    status: 'unexpected',
    message: 'Password recovery is unavailable right now. Try again in a moment.',
  };
}

export function validateNewPassword(password: unknown, confirmation: unknown): PasswordResetState {
  if (typeof password !== 'string' || typeof confirmation !== 'string') {
    return { status: 'invalid_password', message: PASSWORD_POLICY_MESSAGE };
  }
  if (password !== confirmation) {
    return { status: 'mismatch', message: 'The passwords do not match.' };
  }
  if (
    password.length < 8 ||
    !/[a-z]/u.test(password) ||
    !/[A-Z]/u.test(password) ||
    !/[0-9]/u.test(password)
  ) {
    return { status: 'invalid_password', message: PASSWORD_POLICY_MESSAGE };
  }
  return { status: 'idle' };
}

export function classifyPasswordUpdateError(error: AuthErrorLike): PasswordResetState {
  if (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit'
  ) {
    return {
      status: 'rate_limited',
      message: 'Too many password attempts. Wait a moment, then try again.',
    };
  }
  if (error.code === 'weak_password') {
    return { status: 'invalid_password', message: PASSWORD_POLICY_MESSAGE };
  }
  if (error.code === 'same_password') {
    return {
      status: 'invalid_password',
      message: 'Choose a new password that is different from your current password.',
    };
  }
  if (
    error.code !== undefined &&
    (EXPIRED_AUTH_CODES.has(error.code) || error.code === 'reauthentication_needed')
  ) {
    return {
      status: 'expired',
      message: 'That recovery session expired. Request a new recovery link.',
    };
  }
  return {
    status: 'unexpected',
    message: 'Your password could not be changed right now. Request a new link before retrying.',
  };
}

export function buildRecoveryRedirectUrl(appOrigin: string, next: unknown): string {
  const url = new URL('/auth/callback', appOrigin);
  url.searchParams.set('recovery', '1');
  url.searchParams.set('next', safeStudioRedirectPath(next));
  return url.toString();
}

export interface AuthCallbackInput {
  readonly code: string | null;
  readonly next: unknown;
  readonly providerErrorCode?: string | null | undefined;
  readonly recovery: boolean;
}

export type AuthCallbackResult =
  | { readonly type: 'ok'; readonly destination: string }
  | { readonly type: 'expired'; readonly destination: string }
  | { readonly type: 'rate_limited'; readonly destination: string }
  | { readonly type: 'error'; readonly destination: string };

function pathWithNext(pathname: string, next: string, notice?: string): string {
  const params = new URLSearchParams({ next });
  if (notice !== undefined) params.set('notice', notice);
  return `${pathname}?${params.toString()}`;
}

function callbackFailureDestination(
  recovery: boolean,
  next: string,
  notice: 'auth_link_failed' | 'expired_link' | 'rate_limited',
): string {
  return pathWithNext(recovery ? '/forgot-password' : '/login', next, notice);
}

export async function resolveAuthCallback(
  input: AuthCallbackInput,
  exchangeCode: (code: string) => Promise<Readonly<{ error: AuthErrorLike | null }>>,
): Promise<AuthCallbackResult> {
  const next = safeStudioRedirectPath(input.next);
  const providerErrorCode = input.providerErrorCode ?? undefined;
  if (providerErrorCode !== undefined || input.code === null || input.code.length === 0) {
    const expired = providerErrorCode !== undefined && EXPIRED_AUTH_CODES.has(providerErrorCode);
    const rateLimited =
      providerErrorCode !== undefined && RATE_LIMIT_AUTH_CODES.has(providerErrorCode);
    return {
      type: expired ? 'expired' : rateLimited ? 'rate_limited' : 'error',
      destination: callbackFailureDestination(
        input.recovery,
        next,
        expired ? 'expired_link' : rateLimited ? 'rate_limited' : 'auth_link_failed',
      ),
    };
  }

  const { error } = await exchangeCode(input.code);
  if (error !== null) {
    const expired = error.code !== undefined && EXPIRED_AUTH_CODES.has(error.code);
    const rateLimited =
      error.status === 429 || (error.code !== undefined && RATE_LIMIT_AUTH_CODES.has(error.code));
    return {
      type: expired ? 'expired' : rateLimited ? 'rate_limited' : 'error',
      destination: callbackFailureDestination(
        input.recovery,
        next,
        expired ? 'expired_link' : rateLimited ? 'rate_limited' : 'auth_link_failed',
      ),
    };
  }

  return {
    type: 'ok',
    destination: input.recovery ? pathWithNext('/reset-password', next) : next,
  };
}
