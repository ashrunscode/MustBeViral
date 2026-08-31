import { safeStudioRedirectPath } from './sign-in';

export function readVerifyEmailPrefill(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
) {
  const email = typeof searchParams.email === 'string' ? searchParams.email : '';
  const next = safeStudioRedirectPath(searchParams.next);
  return { email, next };
}
