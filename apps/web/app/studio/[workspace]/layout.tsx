import type { ReactNode } from 'react';

import { requireStudioSession } from '../../../src/lib/supabase/session-boundary';
import { WorkspaceFrame } from '../../../src/features/platform/workspace-frame';
import { isWorkspaceUuid } from '../../../src/lib/core/workspace-ref';
import { redirect } from 'next/navigation';

export default async function StudioWorkspaceLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ workspace: string }> }>) {
  const [{ workspace }, session] = await Promise.all([params, requireStudioSession()]);
  if (session.mode === 'authenticated' && !isWorkspaceUuid(workspace)) redirect('/studio');
  return (
    <WorkspaceFrame
      presentation={session.mode === 'local-preview' ? 'preview' : 'authenticated'}
      workspace={workspace}
    >
      {children}
    </WorkspaceFrame>
  );
}
