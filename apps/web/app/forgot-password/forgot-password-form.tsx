'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { INITIAL_RECOVERY_REQUEST_STATE } from '../../src/lib/auth/recovery';
import { requestPasswordRecovery } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="auth-primary" disabled={pending} type="submit">
      {pending ? 'Sending…' : 'Send recovery link'}
    </button>
  );
}

export function ForgotPasswordForm({ next }: Readonly<{ next: string }>) {
  const [state, action] = useActionState(requestPasswordRecovery, INITIAL_RECOVERY_REQUEST_STATE);
  return (
    <form action={action} className="auth-form">
      <input name="next" type="hidden" value={next} />
      <label htmlFor="email">Email</label>
      <input autoComplete="email" id="email" name="email" required type="email" />
      {'message' in state ? (
        <p
          className={`auth-message auth-message--${state.status}`}
          role={state.status === 'sent' ? 'status' : 'alert'}
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
