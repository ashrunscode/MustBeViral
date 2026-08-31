import { ContinueCampaignScreen } from '../../../src/features/campaign/continue-campaign-screen';
import { requireStudioSession } from '../../../src/lib/supabase/session-boundary';

export default async function StudioContinuePage() {
  const session = await requireStudioSession();
  const defaultWorkspace = session.mode === 'local-preview' ? 'lumen-skin' : 'campaign';
  return <ContinueCampaignScreen defaultWorkspace={defaultWorkspace} />;
}
