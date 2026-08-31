import type { ReactNode } from 'react';

import { requireStudioSession } from '../../../src/lib/supabase/session-boundary';
import { StudioWorkflowNav } from '../../../src/components/studio-workflow-nav';
import { StudioHeader } from './studio-header';

export default async function StudioWorkspaceLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ workspace: string }> }>) {
  const [{ workspace }, session] = await Promise.all([params, requireStudioSession()]);
  return (
    <div className="studio-app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <StudioHeader
        presentation={session.mode === 'local-preview' ? 'preview' : 'authenticated'}
        workspace={workspace}
      />
      <StudioWorkflowNav workspace={workspace} />
      {children}
    </div>
  );
}
