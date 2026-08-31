'use client';

import { MonoCaps } from '@mustbeviral/ui';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createBrowserCoreClient } from '../../../src/lib/core/browser-client';
import { shouldLookupWorkspace } from '../../../src/lib/core/workspace-ref';

const routeLabels: Readonly<Record<string, string>> = {
  brief: 'Brief',
  canvas: 'Canvas',
  quote: 'Quote',
  review: 'Review',
  compare: 'Compare',
  receipt: 'Receipt',
  billing: 'Billing',
  access: 'Access',
  internal: 'Internal',
};

function titleCaseWorkspace(workspace: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(workspace)) {
    return 'Campaign';
  }
  return workspace
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function StudioHeader({
  presentation = 'preview',
  workspace,
}: Readonly<{ presentation?: 'preview' | 'authenticated'; workspace: string }>) {
  const pathname = usePathname();
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'brief';
  const routeLabel = routeLabels[segment] ?? 'Studio';
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    if (presentation !== 'authenticated' || !shouldLookupWorkspace(workspace)) return;
    let active = true;
    void createBrowserCoreClient()
      .request('get_workspace', { id: workspace })
      .then((result) => {
        if (!active || 'error' in result) return;
        setWorkspaceName(result.data.workspace.name);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [presentation, workspace]);

  return (
    <header className="studio-header">
      <div className="studio-brand-row">
        <span className="studio-wordmark">MustBeViral Studio</span>
        <nav aria-label="Project breadcrumb" className="studio-breadcrumb">
          <MonoCaps>
            Campaigns / {workspaceName ?? titleCaseWorkspace(workspace)} /{' '}
            <strong>{routeLabel}</strong>
          </MonoCaps>
        </nav>
      </div>
      <div className="studio-system-row" aria-label="System status">
        <MonoCaps>{presentation === 'preview' ? 'Network ready' : 'Signed in'}</MonoCaps>
        <span className="studio-status-dot" aria-hidden="true" />
        <MonoCaps>
          {presentation === 'preview'
            ? 'Budget consumed $0.00 / $8.00'
            : 'Spend caps appear on the quote'}
        </MonoCaps>
      </div>
    </header>
  );
}
