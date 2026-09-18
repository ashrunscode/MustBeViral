'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { studioHref, workspaceBillingHref } from './platform-navigation';
import { PlatformRequestError, platformErrorMessage } from './platform-client';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';
import './platform.css';

function focusPlatformMain(event: { preventDefault: () => void }) {
  const main = document.getElementById('platform-main');
  if (!(main instanceof HTMLElement)) return;
  event.preventDefault();
  main.focus();
}

export function PlatformFrame({
  children,
  studioId,
  studioName,
  brandName,
  role,
  workspaceId,
  showBilling = false,
  billingCurrent = false,
}: Readonly<{
  children: ReactNode;
  studioId?: string;
  studioName?: string;
  brandName?: string;
  role?: string;
  workspaceId?: string;
  showBilling?: boolean;
  billingCurrent?: boolean;
}>) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signOut();
      if (error) throw error;
      window.location.assign('/login');
    } catch {
      setSigningOut(false);
      setSignOutError(true);
    }
  }
  return (
    <div className="platform-app">
      <a className="skip-link" href="#platform-main" onClick={focusPlatformMain}>
        Skip to content
      </a>
      <header className="platform-topbar">
        <Link className="platform-wordmark" href="/studio">
          <span aria-hidden="true">▦</span> MustBeViral <span>Studio</span>
        </Link>
        <div className="platform-breadcrumb">
          <span>{studioName ?? 'Your studios'}</span>
          {brandName ? (
            <>
              <span aria-hidden="true">/</span>
              <strong>{brandName}</strong>
            </>
          ) : null}
        </div>
        <span className="platform-tag">
          {role ? `${role[0]?.toUpperCase()}${role.slice(1)}` : 'Your portfolio'}
        </span>
        <button type="button" disabled={signingOut} onClick={() => void signOut()}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </header>
      {signOutError && (
        <p role="alert" className="platform-note">
          Sign out could not be confirmed. Please retry.
        </p>
      )}
      <div className="platform-layout">
        <aside className="platform-sidebar" aria-label="Workspace">
          <span className="platform-eyebrow">Workspace</span>
          <nav aria-label="Studio navigation">
            <Link href={studioHref(studioId)}>Overview</Link>
            <Link href="/studio">Switch studio</Link>
            {studioId && role === 'owner' && (
              <>
                <Link href={studioHref(studioId, 'team')}>Studio team</Link>
                <Link href={studioHref(studioId, 'settings')}>Studio settings</Link>
              </>
            )}
            {showBilling && studioId && workspaceId && (
              <Link
                href={workspaceBillingHref(workspaceId, studioId)}
                aria-current={billingCurrent ? 'page' : undefined}
              >
                Billing
              </Link>
            )}
          </nav>
          <div className="platform-sidebar-note">
            One studio.
            <br />
            Each brand, its own context.
          </div>
        </aside>
        <main id="platform-main" className="platform-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
export function PlatformLoading({ label = 'Loading your studio…' }: Readonly<{ label?: string }>) {
  return (
    <div className="platform-card platform-pad" role="status" aria-live="polite">
      <span className="platform-eyebrow">Just a moment</span>
      <p>{label}</p>
    </div>
  );
}
export function PlatformRecovery({
  error,
  retry,
}: Readonly<{ error: unknown; retry?: () => void }>) {
  return (
    <section className="platform-card platform-pad platform-stack" role="alert">
      <h1>Let’s get you back to your work.</h1>
      <p>{platformErrorMessage(error)}</p>
      <div className="platform-row">
        {retry && (
          <button type="button" onClick={retry}>
            Try again
          </button>
        )}
        <Link className="platform-button" href="/studio">
          Choose a studio
        </Link>
        {error instanceof PlatformRequestError && error.code === 'UNAUTHENTICATED' && (
          <Link className="platform-button platform-primary" href="/login">
            Sign in
          </Link>
        )}
      </div>
    </section>
  );
}
export function PlatformHeading({
  title,
  description,
  children,
}: Readonly<{ title: string; description: string; children?: ReactNode }>) {
  return (
    <div className="platform-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
