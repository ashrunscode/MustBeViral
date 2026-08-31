'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  INITIAL_VERIFY_EMAIL_STATE,
  resendVerificationEmail,
  type VerifyEmailState,
} from './actions';

function verifyMessageClass(status: VerifyEmailState['status']): string {
  if (status === 'sent' || status === 'rate_limited') {
    return 'auth-message auth-message--notice';
  }
  return 'auth-message';
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="auth-primary" disabled={pending} type="submit">
      {pending ? 'Sending.' : 'Resend verification email'}
    </button>
  );
}

export function VerifyEmailForm({ email, next }: Readonly<{ email: string; next: string }>) {
  const [state, action] = useActionState(resendVerificationEmail, INITIAL_VERIFY_EMAIL_STATE);

  return (
    <form action={action} className="auth-form">
      <input name="next" type="hidden" value={next} />
      <label htmlFor="verify-email">Email awaiting verification</label>
      <input
        autoComplete="email"
        defaultValue={email}
        id="verify-email"
        name="email"
        required
        type="email"
      />
      {state.status !== 'idle' && state.status !== 'sent' && 'message' in state ? (
        <p className={verifyMessageClass(state.status)} role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
