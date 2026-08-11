import { CampaignBrief } from './campaign-brief';
import { requireStudioSession } from '../../../../../src/lib/supabase/session-boundary';

export default async function CampaignBriefPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const [{ workspace }, session] = await Promise.all([params, requireStudioSession()]);
  return (
    <CampaignBrief
      dataMode={session.mode === 'local-preview' ? 'preview' : 'worker'}
      workspace={workspace}
    />
  );
}
