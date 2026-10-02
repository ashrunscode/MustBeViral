import type { ReactNode } from 'react';

import { PublicFooter } from './public-footer';

export interface StatusScreenAction {
  readonly href: string;
  readonly label: string;
  readonly variant?: 'primary' | 'secondary';
}

export function StatusScreen({
  actions,
  children,
  eyebrow = 'Must Be Viral',
  title,
}: Readonly<{
  actions: readonly StatusScreenAction[];
  children: ReactNode;
  eyebrow?: string;
  title: string;
}>) {
  return (
    <div className="auth-layout">
      <main className="status-page">
        <a className="skip-link" href="#status-heading">
          Skip to page content
        </a>
        <section aria-labelledby="status-heading" className="status-card">
          <span className="pub-wordmark" translate="no">
            {eyebrow}
          </span>
          <h1 id="status-heading">{title}</h1>
          <div className="status-body">{children}</div>
          <div className="status-actions">
            {actions.map((action) => (
              <a
                key={action.href}
                className={
                  action.variant === 'secondary'
                    ? 'auth-secondary status-action'
                    : 'auth-primary auth-primary--link status-action'
                }
                href={action.href}
              >
                {action.label}
              </a>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter compact surface="legal" />
    </div>
  );
}
