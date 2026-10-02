import type { Metadata } from 'next';
import { CampaignCollaborators } from '../../../../src/features/campaign/campaign-sections';
import { requireStudioSession } from '../../../../src/lib/supabase/session-boundary';

export const metadata: Metadata = { title: 'Collaborators' };

export default async function CampaignCollaboratorsPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const [{ workspace }, session] = await Promise.all([params, requireStudioSession()]);
  return (
    <CampaignCollaborators
      workspace={workspace}
      presentation={session.mode === 'local-preview' ? 'preview' : 'authenticated'}
    />
  );
}
