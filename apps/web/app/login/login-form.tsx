'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { INITIAL_SIGN_IN_STATE, type SignInStatus } from '../../src/lib/auth/sign-in';
import { signInWithPassword } from './actions';

function authMessageClass(status: SignInStatus): string {
  if (status === 'idle') return 'auth-message';
  if (status === 'verification_required' || status === 'rate_limited') {
    return 'auth-message auth-message--notice';
  }
  return 'auth-message';
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="auth-primary" disabled={pending} type="submit">
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm({ next }: Readonly<{ next: string }>) {
  const [state, action] = useActionState(signInWithPassword, INITIAL_SIGN_IN_STATE);
  return (
    <form action={action} className="auth-form">
      <input name="next" type="hidden" value={next} />
      <label htmlFor="email">Email</label>
      <input autoComplete="email" id="email" name="email" required type="email" />
      <label htmlFor="password">Password</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        required
        type="password"
      />
      {state.message === undefined ? null : (
        <p className={authMessageClass(state.status)} role="alert">
          {state.message}
          {state.status === 'verification_required' ? (
            <>
              {' '}
              <a
                className="auth-link"
                href={`/verify-email?${new URLSearchParams({ next }).toString()}`}
              >
                Resend verification email
              </a>
            </>
          ) : null}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
