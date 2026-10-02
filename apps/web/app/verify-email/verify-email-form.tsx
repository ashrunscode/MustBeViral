'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { authMessageClassName, authMessageRole } from '../../src/lib/auth/auth-message';
import { useFocusInvalid } from '../../src/lib/auth/use-focus-invalid';
import { INITIAL_VERIFY_EMAIL_STATE, resendVerificationEmail } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending || undefined}
      className="auth-primary"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Sending…' : 'Resend verification email'}
    </button>
  );
}

export function VerifyEmailForm({ email, next }: Readonly<{ email: string; next: string }>) {
  const [state, action] = useActionState(resendVerificationEmail, INITIAL_VERIFY_EMAIL_STATE);
  const formRef = useFocusInvalid<HTMLFormElement>(state);
  const hasMessage = state.status !== 'idle' && state.status !== 'sent' && 'message' in state;

  return (
    <form action={action} className="auth-form" ref={formRef}>
      <input name="next" type="hidden" value={next} />
      <label htmlFor="verify-email">Email awaiting verification</label>
      <input
        aria-describedby={hasMessage ? 'verify-message' : undefined}
        aria-invalid={state.status === 'invalid_email' || undefined}
        autoComplete="email"
        defaultValue={email}
        id="verify-email"
        name="email"
        required
        spellCheck={false}
        type="email"
      />
      {hasMessage ? (
        <p
          className={authMessageClassName(state.status)}
          id="verify-message"
          role={authMessageRole(state.status)}
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
