import { BillingUsagePanel } from '../../../../src/features/billing/billing-usage-panel';
import { WorkspaceBilling } from '../../../../src/features/platform/workspace-billing';
import { requireStudioSession } from '../../../../src/lib/supabase/session-boundary';
import { isWorkspaceUuid } from '../../../../src/lib/core/workspace-ref';
import { PlatformRecovery } from '../../../../src/features/platform/platform-frame';
import { PlatformRequestError } from '../../../../src/features/platform/platform-client';

export default async function BillingPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const [{ workspace }, session] = await Promise.all([params, requireStudioSession()]);
  if (session.mode === 'local-preview') return <BillingUsagePanel />;
  if (!isWorkspaceUuid(workspace)) {
    return <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'Invalid workspace')} />;
  }
  return <WorkspaceBilling workspaceId={workspace} />;
}
