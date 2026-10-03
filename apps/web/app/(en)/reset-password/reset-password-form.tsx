'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { authMessageClassName, authMessageRole } from '../../../src/lib/auth/auth-message';
import {
  INITIAL_PASSWORD_RESET_STATE,
  PASSWORD_POLICY_MESSAGE,
} from '../../../src/lib/auth/recovery';
import { PendingSubmit } from '../../../src/components/pending-submit';
import { useFocusInvalid } from '../../../src/lib/auth/use-focus-invalid';
import { resetPassword, signOutAfterPasswordReset } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending || undefined}
      className="auth-primary"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Updating…' : 'Update password'}
    </button>
  );
}

export function ResetPasswordForm({ next }: Readonly<{ next: string }>) {
  const [state, action] = useActionState(resetPassword, INITIAL_PASSWORD_RESET_STATE);
  const formRef = useFocusInvalid<HTMLFormElement>(state);
  if (state.status === 'sign_out_failed') {
    return (
      <div className="auth-form">
        <p className={authMessageClassName(state.status)} role={authMessageRole(state.status)}>
          {state.message}
        </p>
        <form action={signOutAfterPasswordReset}>
          <input name="next" type="hidden" value={next} />
          <PendingSubmit
            className="auth-primary"
            label="Sign out now"
            pendingLabel="Signing out…"
          />
        </form>
      </div>
    );
  }

  const hasMessage = 'message' in state;
  const passwordInvalid = state.status === 'invalid_password';
  const mismatch = state.status === 'mismatch';
  const describedBy = ['password-policy', hasMessage ? 'password-message' : null]
    .filter((value): value is string => value !== null)
    .join(' ');

  return (
    <form action={action} className="auth-form" ref={formRef}>
      <input name="next" type="hidden" value={next} />
      <label htmlFor="password">New password</label>
      <input
        aria-describedby={describedBy}
        aria-invalid={passwordInvalid || undefined}
        autoComplete="new-password"
        id="password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <label htmlFor="confirmation">Confirm new password</label>
      <input
        aria-describedby={describedBy}
        aria-invalid={mismatch || undefined}
        autoComplete="new-password"
        id="confirmation"
        minLength={8}
        name="confirmation"
        required
        type="password"
      />
      <p className="auth-policy" id="password-policy">
        {PASSWORD_POLICY_MESSAGE}
      </p>
      {hasMessage ? (
        <p
          className={authMessageClassName(state.status)}
          id="password-message"
          role={authMessageRole(state.status)}
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
