'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { StudioHeader } from '../../../app/studio/[workspace]/studio-header';
import { StudioWorkflowNav } from '../../components/studio-workflow-nav';

export function WorkspaceFrame({
  children,
  workspace,
  presentation,
}: Readonly<{
  children: ReactNode;
  workspace: string;
  presentation: 'preview' | 'authenticated';
}>) {
  const pathname = usePathname();
  if (
    pathname.startsWith(`/studio/${workspace}/brands/`) ||
    pathname.startsWith(`/studio/${workspace}/projects/`)
  )
    return children;
  return (
    <div className="studio-app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <StudioHeader presentation={presentation} workspace={workspace} />
      <StudioWorkflowNav workspace={workspace} />
      {children}
    </div>
  );
}
