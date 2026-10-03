'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { authMessageClassName, authMessageRole } from '../../../src/lib/auth/auth-message';
import { INITIAL_SIGN_IN_STATE } from '../../../src/lib/auth/sign-in';
import { useFocusInvalid } from '../../../src/lib/auth/use-focus-invalid';
import { signInWithPassword } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending || undefined}
      className="auth-primary"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm({ next }: Readonly<{ next: string }>) {
  const [state, action] = useActionState(signInWithPassword, INITIAL_SIGN_IN_STATE);
  const formRef = useFocusInvalid<HTMLFormElement>(state);
  const hasMessage = state.message !== undefined;
  const describedBy = hasMessage ? 'sign-in-message' : undefined;
  return (
    <form action={action} className="auth-form" ref={formRef}>
      <input name="next" type="hidden" value={next} />
      <label htmlFor="email">Email</label>
      <input
        aria-describedby={describedBy}
        aria-invalid={state.status === 'invalid_credentials' || undefined}
        autoComplete="email"
        id="email"
        name="email"
        required
        spellCheck={false}
        type="email"
      />
      <label htmlFor="password">Password</label>
      <input
        aria-describedby={describedBy}
        aria-invalid={state.status === 'invalid_credentials' || undefined}
        autoComplete="current-password"
        id="password"
        name="password"
        required
        type="password"
      />
      {hasMessage ? (
        <p
          className={authMessageClassName(state.status)}
          id="sign-in-message"
          role={authMessageRole(state.status)}
        >
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
      ) : null}
      <SubmitButton />
    </form>
  );
}
