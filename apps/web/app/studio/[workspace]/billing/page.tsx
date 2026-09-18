import { BillingUsagePanel } from '../../../../src/features/billing/billing-usage-panel';
import { WorkspaceBilling } from '../../../../src/features/platform/workspace-billing';
import { requireStudioSession } from '../../../../src/lib/supabase/session-boundary';
import { isWorkspaceUuid } from '../../../../src/lib/core/workspace-ref';
import { PlatformFrame, PlatformRecovery } from '../../../../src/features/platform/platform-frame';
import { PlatformRequestError } from '../../../../src/features/platform/platform-client';

export default async function BillingPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ workspace }, query, session] = await Promise.all([
    params,
    searchParams,
    requireStudioSession(),
  ]);
  if (session.mode === 'local-preview') return <BillingUsagePanel />;
  const studioId = typeof query.studio === 'string' ? query.studio : undefined;
  if (!isWorkspaceUuid(workspace)) {
    return (
      <PlatformFrame>
        <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'Invalid workspace')} />
      </PlatformFrame>
    );
  }
  return <WorkspaceBilling workspaceId={workspace} {...(studioId ? { studioId } : {})} />;
}
