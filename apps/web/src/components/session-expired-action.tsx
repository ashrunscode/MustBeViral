'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { studioLoginHref } from '../lib/auth/sign-in';

export function SessionExpiredAction({ className }: Readonly<{ className?: string | undefined }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginHref = studioLoginHref(pathname, searchParams.toString());

  return (
    <div className={className} role="alert" data-result="session_expired">
      <strong>Your Studio session expired.</strong>
      <span>Sign in again to continue from this exact screen. No pending action was replayed.</span>
      <a className="session-expired-link" href={loginHref}>
        Sign in to continue
      </a>
    </div>
  );
}
