import type { Metadata } from 'next';
import { CampaignApprovals } from '../../../../src/features/campaign/campaign-sections';
import { requireStudioSession } from '../../../../src/lib/supabase/session-boundary';

export const metadata: Metadata = { title: 'Approvals' };

export default async function CampaignApprovalsPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const [{ workspace }] = await Promise.all([params, requireStudioSession()]);
  return <CampaignApprovals workspace={workspace} />;
}
