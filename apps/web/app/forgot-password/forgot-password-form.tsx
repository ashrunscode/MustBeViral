'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { authMessageClassName, authMessageRole } from '../../src/lib/auth/auth-message';
import { INITIAL_RECOVERY_REQUEST_STATE } from '../../src/lib/auth/recovery';
import { useFocusInvalid } from '../../src/lib/auth/use-focus-invalid';
import { requestPasswordRecovery } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending || undefined}
      className="auth-primary"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Sending…' : 'Send recovery link'}
    </button>
  );
}

export function ForgotPasswordForm({ next }: Readonly<{ next: string }>) {
  const [state, action] = useActionState(requestPasswordRecovery, INITIAL_RECOVERY_REQUEST_STATE);
  const formRef = useFocusInvalid<HTMLFormElement>(state);
  const hasMessage = 'message' in state;
  const invalid = state.status === 'invalid_email';
  return (
    <form action={action} className="auth-form" ref={formRef}>
      <input name="next" type="hidden" value={next} />
      <label htmlFor="email">Email</label>
      <input
        aria-describedby={hasMessage ? 'recovery-message' : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="email"
        id="email"
        name="email"
        required
        spellCheck={false}
        type="email"
      />
      {hasMessage ? (
        <p
          className={authMessageClassName(state.status)}
          id="recovery-message"
          role={authMessageRole(state.status)}
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
