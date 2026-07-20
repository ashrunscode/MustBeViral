'use client';

import { MonoCaps } from '@mustbeviral/ui';
import { usePathname } from 'next/navigation';

const routeLabels: Readonly<Record<string, string>> = {
  brief: 'Brief',
  canvas: 'Canvas',
  quote: 'Quote',
  review: 'Review',
  receipt: 'Receipt',
};

function titleCaseWorkspace(workspace: string) {
  return workspace
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function StudioHeader({ workspace }: Readonly<{ workspace: string }>) {
  const pathname = usePathname();
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'brief';
  const routeLabel = routeLabels[segment] ?? 'Studio';

  return (
    <header className="studio-header">
      <div className="studio-brand-row">
        <span className="studio-wordmark">MustBeViral Studio</span>
        <nav aria-label="Project breadcrumb" className="studio-breadcrumb">
          <MonoCaps>
            Campaigns / {titleCaseWorkspace(workspace)} / <strong>{routeLabel}</strong>
          </MonoCaps>
        </nav>
      </div>
      <div className="studio-system-row" aria-label="System status">
        <MonoCaps>Network ready</MonoCaps>
        <span className="studio-status-dot" aria-hidden="true" />
        <MonoCaps>Budget consumed $0.00 / $8.00</MonoCaps>
      </div>
    </header>
  );
}
