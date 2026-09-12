import { ContinueCampaignScreen } from '../../../src/features/campaign/continue-campaign-screen';
import { requireStudioSession } from '../../../src/lib/supabase/session-boundary';
import { redirect } from 'next/navigation';

export default async function StudioContinuePage() {
  const session = await requireStudioSession();
  if (session.mode === 'authenticated') redirect('/studio');
  return <ContinueCampaignScreen defaultWorkspace="lumen-skin" />;
}
