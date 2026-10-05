'use client';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  STUDIO_SECTIONS,
  studioHref,
  workspaceBillingHref,
  type StudioSection,
} from './platform-navigation';
import { PlatformRequestError, platformErrorMessage } from './platform-client';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';
import { studioLoginHref } from '../../lib/auth/sign-in';
import './platform.css';

function focusPlatformMain(event: { preventDefault: () => void }) {
  const main = document.getElementById('platform-main');
  if (!(main instanceof HTMLElement)) return;
  event.preventDefault();
  main.focus();
}

export interface PlatformStudioContext {
  readonly id: string;
  readonly name: string;
  readonly role?: 'owner' | 'editor' | 'viewer' | string | undefined;
}

export interface PlatformBrandContext {
  readonly id: string;
  readonly name: string;
  readonly workspaceId: string;
  readonly workspaceName?: string | undefined;
}

export type PlatformPresentation = 'authenticated' | 'preview';

/**
 * The one signed-in shell: a rail with the studio navigation, a top bar that always says which
 * studio, workspace and brand the screen belongs to, and a main region that the skip link reaches.
 */
export function PlatformFrame({
  children,
  studio,
  brand,
  campaignLabel,
  section,
  presentation = 'authenticated',
  contextControls,
  brandContextPending = false,
  flush = false,
  showBilling = false,
  billingCurrent = false,
}: Readonly<{
  children: ReactNode;
  studio?: PlatformStudioContext | undefined;
  brand?: PlatformBrandContext | undefined;
  campaignLabel?: string | undefined;
  section?: StudioSection | undefined;
  presentation?: PlatformPresentation;
  /** Context controls that belong beside the breadcrumb, such as the brand switcher. */
  contextControls?: ReactNode;
  /** Reserve the brand header without exposing an unconfirmed identity or permission. */
  brandContextPending?: boolean;
  /** Full-bleed main for the campaign canvas and other app-height surfaces. */
  flush?: boolean;
  showBilling?: boolean;
  billingCurrent?: boolean;
}>) {
  const [signingOut, setSigningOut] = useState(false);
  // Below 768px the rail collapses behind one button; wider screens ignore this state.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [signOutError, setSignOutError] = useState(false);
  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signOut();
      if (error) throw error;
      window.location.assign('/login?notice=signed_out');
    } catch {
      setSigningOut(false);
      setSignOutError(true);
    }
  }
  const roleLabel = studio?.role ? roleName(studio.role) : null;
  const brandHeader = brandContextPending || (!!brand && !campaignLabel && !!contextControls);
  const mainLabel =
    campaignLabel ??
    (brand ? brand.name : undefined) ??
    STUDIO_SECTIONS.find((entry) => entry.key === section)?.label ??
    'Your studios';
  return (
    <div className={flush ? 'platform-app platform-app--flush' : 'platform-app'}>
      <a className="skip-link" href="#platform-main" onClick={focusPlatformMain}>
        Skip to content
      </a>
      <aside
        className={menuOpen ? 'platform-rail' : 'platform-rail platform-rail--collapsed'}
        aria-label="Studio"
        onKeyDown={(event) => {
          if (
            event.key !== 'Escape' ||
            event.defaultPrevented ||
            !menuOpen ||
            !window.matchMedia('(max-width: 767px)').matches
          )
            return;
          event.preventDefault();
          setMenuOpen(false);
          menuButton.current?.focus();
        }}
      >
        <div className="platform-rail__head">
          <Link className="platform-wordmark" href="/studio" translate="no">
            {'Must Be Viral'}
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="platform-rail-toggle"
            aria-expanded={menuOpen}
            aria-controls="platform-rail-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close menu' : 'Menu'}
          </button>
        </div>
        <div className="platform-rail__menu" id="platform-rail-menu">
          <div className="platform-studio-switch">
            <span className="platform-eyebrow">Studio</span>
            <span className="platform-studio-switch__name">{studio?.name ?? 'Your studios'}</span>
            <Link className="platform-studio-switch__link" href="/studio">
              Switch studio
            </Link>
          </div>
          {studio ? (
            <nav aria-label="Studio navigation" className="platform-rail-nav">
              {STUDIO_SECTIONS.filter(
                (entry) =>
                  studio.role === 'owner' || (entry.key !== 'team' && entry.key !== 'settings'),
              ).map((entry) => (
                <Link
                  key={entry.key}
                  aria-current={section === entry.key ? 'page' : undefined}
                  href={studioHref(studio.id, entry.key)}
                >
                  {entry.label}
                </Link>
              ))}
              {showBilling && brand ? (
                <Link
                  aria-current={billingCurrent ? 'page' : undefined}
                  href={workspaceBillingHref(brand.workspaceId, studio.id, brand.id)}
                >
                  Billing
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </aside>
      <div className="platform-shell">
        <header
          className={brandHeader ? 'platform-topbar platform-topbar--brand' : 'platform-topbar'}
        >
          <nav aria-label="Breadcrumb" className="platform-breadcrumb">
            <ol>
              <li>
                {studio ? (
                  <Link href={studioHref(studio.id)}>{studio.name}</Link>
                ) : (
                  <span>Your studios</span>
                )}
              </li>
              {brand?.workspaceName ? (
                <li>
                  <span className="platform-breadcrumb__workspace">{brand.workspaceName}</span>
                </li>
              ) : null}
              {brand ? (
                <li
                  className="platform-breadcrumb__brand"
                  aria-current={campaignLabel ? undefined : 'page'}
                >
                  <strong>{brand.name}</strong>
                </li>
              ) : brandContextPending ? (
                <li className="platform-breadcrumb__brand" aria-hidden="true">
                  <span className="platform-context-skeleton" />
                </li>
              ) : null}
              {campaignLabel ? (
                <li aria-current="page">
                  <strong>{campaignLabel}</strong>
                </li>
              ) : null}
            </ol>
          </nav>
          <div
            className={
              brandHeader ? 'platform-context platform-context--brand' : 'platform-context'
            }
          >
            {brandContextPending ? (
              <div className="platform-brand-switcher" aria-hidden="true">
                <span className="platform-context-skeleton" />
                <span className="platform-brand-switcher__skeleton" />
              </div>
            ) : (
              contextControls
            )}
            {roleLabel ? (
              <span className="platform-tag">{roleLabel}</span>
            ) : brandHeader ? (
              <span
                className="platform-context-skeleton platform-context-skeleton--role"
                aria-hidden="true"
              />
            ) : null}
            {presentation === 'authenticated' ? (
              <button
                type="button"
                className="platform-signout"
                aria-busy={signingOut || undefined}
                onClick={() => void signOut()}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            ) : null}
          </div>
        </header>
        {presentation === 'preview' ? (
          <p className="platform-preview-banner" role="status">
            Preview. Sample work only. No connected accounts, approvals or publication.
          </p>
        ) : null}
        {signOutError ? (
          <p role="alert" className="platform-note platform-note--error">
            Sign out did not complete. Your session is still active. Try again.
          </p>
        ) : null}
        <main
          id="platform-main"
          aria-label={mainLabel}
          className={flush ? 'platform-main platform-main--flush' : 'platform-main'}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function roleName(role: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'editor') return 'Editor';
  if (role === 'viewer') return 'Viewer';
  return role;
}

/** Reserves the geometry of the surface it stands in for; never a percentage the system lacks. */
export function PlatformLoading({
  label = 'Loading your studio…',
  rows = 3,
}: Readonly<{ label?: string; rows?: number }>) {
  return (
    <div className="platform-card platform-pad platform-loading" role="status" aria-live="polite">
      <p>{label}</p>
      {Array.from({ length: rows }, (_, index) => (
        <span className="platform-skeleton" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}

export function PlatformRecovery({
  error,
  retry,
}: Readonly<{ error: unknown; retry?: () => void }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const code = error instanceof PlatformRequestError ? error.code : null;
  if (code === 'UNAUTHENTICATED') {
    return (
      <section className="platform-card platform-pad platform-stack" role="alert">
        <h2>Your session ended.</h2>
        <p>
          Nothing changed after it ended. Saved work stays saved. Sign in to return to this exact
          screen.
        </p>
        <div className="platform-row">
          <Link
            className="platform-button platform-primary"
            href={studioLoginHref(pathname, searchParams.toString())}
          >
            Sign in to continue
          </Link>
        </div>
      </section>
    );
  }
  if (code === 'FORBIDDEN') {
    return (
      <section className="platform-card platform-pad platform-stack" role="alert">
        <h2>You do not have access.</h2>
        <p>
          Your session is valid, but this studio, brand or action is outside your permissions.
          Nothing changed.
        </p>
        <div className="platform-row">
          <Link className="platform-button platform-primary" href="/studio">
            Choose a permitted studio
          </Link>
          <Link className="platform-button" href="/login">
            Sign in with another account
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="platform-card platform-pad platform-stack" role="alert">
      <h2>This request did not complete. Nothing changed.</h2>
      <p>{platformErrorMessage(error)}</p>
      <div className="platform-row">
        {retry ? (
          <button type="button" className="platform-primary" onClick={retry}>
            Try again
          </button>
        ) : null}
        <Link className="platform-button" href="/studio">
          Choose a studio
        </Link>
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

/**
 * An honest empty section: real scope, the one legal action, and the contract that is not in this
 * release. It never shows a mock row or a zero that the system does not know.
 */
export function PlatformEmptySection({
  title,
  body,
  missing,
  action,
}: Readonly<{
  title: string;
  body: string;
  /** The capability that has no registered command yet, stated plainly. */
  missing: string;
  action?: { readonly href: string; readonly label: string } | undefined;
}>) {
  return (
    <section className="platform-card platform-pad platform-stack platform-empty" role="status">
      <h2>{title}</h2>
      <p>{body}</p>
      <p className="platform-muted">{missing}</p>
      {action ? (
        <Link className="platform-button platform-primary" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}
