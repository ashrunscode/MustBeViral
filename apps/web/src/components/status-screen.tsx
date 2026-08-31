import { MonoCaps } from '@mustbeviral/ui';
import type { ReactNode } from 'react';

export interface StatusScreenAction {
  readonly href: string;
  readonly label: string;
  readonly variant?: 'primary' | 'secondary';
}

export function StatusScreen({
  actions,
  children,
  eyebrow = 'MustBeViral Studio',
  title,
}: Readonly<{
  actions: readonly StatusScreenAction[];
  children: ReactNode;
  eyebrow?: string;
  title: string;
}>) {
  return (
    <main className="status-page">
      <a className="skip-link" href="#status-heading">
        Skip to page content
      </a>
      <section aria-labelledby="status-heading" className="status-card">
        <MonoCaps>{eyebrow}</MonoCaps>
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
  );
}
