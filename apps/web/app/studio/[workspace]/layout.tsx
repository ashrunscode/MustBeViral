import type { ReactNode } from 'react';

import { requireStudioSession } from '../../../src/lib/supabase/session-boundary';
import { StudioHeader } from './studio-header';

export default async function StudioWorkspaceLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ workspace: string }> }>) {
  const [{ workspace }] = await Promise.all([params, requireStudioSession()]);
  return (
    <div className="studio-app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <StudioHeader workspace={workspace} />
      {children}
    </div>
  );
}
