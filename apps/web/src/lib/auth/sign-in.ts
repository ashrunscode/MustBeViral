export type SignInStatus =
  'idle' | 'invalid_credentials' | 'verification_required' | 'rate_limited' | 'unexpected';

export interface SignInState {
  readonly status: SignInStatus;
  readonly message?: string;
}

export const INITIAL_SIGN_IN_STATE: SignInState = { status: 'idle' };

export function safeStudioRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/studio';
  }
  try {
    const url = new URL(value, 'https://mustbeviral.invalid');
    const isStudioPath = url.pathname === '/studio' || url.pathname.startsWith('/studio/');
    if (url.origin !== 'https://mustbeviral.invalid' || !isStudioPath) {
      return '/studio';
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/studio';
  }
}

export function studioLoginHref(pathname: string, search: string): string {
  const pathAndQuery = `${pathname}${search.length === 0 ? '' : `?${search}`}`;
  return `/login?${new URLSearchParams({ next: safeStudioRedirectPath(pathAndQuery) }).toString()}`;
}

export function classifySignInError(
  error: Readonly<{
    code?: string | undefined;
    message?: string | undefined;
    status?: number | undefined;
  }>,
): SignInState {
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return {
      status: 'rate_limited',
      message: 'Too many sign-in attempts. Wait a moment, then try again.',
    };
  }
  if (error.code === 'email_not_confirmed') {
    return {
      status: 'verification_required',
      message: 'Verify your email before signing in. Open the newest verification email.',
    };
  }
  if (error.code === 'invalid_credentials' || error.status === 400 || error.status === 401) {
    return {
      status: 'invalid_credentials',
      message: 'Email or password is incorrect.',
    };
  }
  return {
    status: 'unexpected',
    message: 'Sign-in is unavailable right now. Try again without changing your password.',
  };
}
