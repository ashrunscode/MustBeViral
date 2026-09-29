'use server';

import {
  RECOVERY_SENT_STATE,
  buildRecoveryRedirectUrl,
  classifyRecoveryRequestError,
  normalizedRecoveryEmail,
  type RecoveryRequestState,
} from '../../src/lib/auth/recovery';
import { safeStudioRedirectPath } from '../../src/lib/auth/sign-in';
import { createServerSupabaseClient } from '../../src/lib/supabase/server';
import { readWebPublicEnvironment } from '../../src/config/public-environment';

export async function requestPasswordRecovery(
  _previousState: RecoveryRequestState,
  formData: FormData,
): Promise<RecoveryRequestState> {
  const email = normalizedRecoveryEmail(formData.get('email'));
  if (email === null) {
    return { status: 'invalid_email', message: 'Enter a valid email address.' };
  }

  const next = safeStudioRedirectPath(formData.get('next'));
  const environment = readWebPublicEnvironment();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildRecoveryRedirectUrl(environment.NEXT_PUBLIC_APP_ORIGIN, next),
  });
  return error === null ? RECOVERY_SENT_STATE : classifyRecoveryRequestError(error);
}
