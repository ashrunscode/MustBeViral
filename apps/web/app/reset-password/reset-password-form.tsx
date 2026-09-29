'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { INITIAL_PASSWORD_RESET_STATE, PASSWORD_POLICY_MESSAGE } from '../../src/lib/auth/recovery';
import { resetPassword, signOutAfterPasswordReset } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="auth-primary" disabled={pending} type="submit">
      {pending ? 'Updating…' : 'Update password'}
    </button>
  );
}

export function ResetPasswordForm({ next }: Readonly<{ next: string }>) {
  const [state, action] = useActionState(resetPassword, INITIAL_PASSWORD_RESET_STATE);
  if (state.status === 'sign_out_failed') {
    return (
      <div className="auth-form">
        <p className="auth-message auth-message--sign_out_failed" role="alert">
          {state.message}
        </p>
        <form action={signOutAfterPasswordReset}>
          <input name="next" type="hidden" value={next} />
          <button className="auth-primary" type="submit">
            Sign out now
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="auth-form">
      <input name="next" type="hidden" value={next} />
      <label htmlFor="password">New password</label>
      <input
        autoComplete="new-password"
        id="password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <label htmlFor="confirmation">Confirm new password</label>
      <input
        autoComplete="new-password"
        id="confirmation"
        minLength={8}
        name="confirmation"
        required
        type="password"
      />
      <p className="auth-policy">{PASSWORD_POLICY_MESSAGE}</p>
      {'message' in state ? (
        <p className={`auth-message auth-message--${state.status}`} role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
