import type { Metadata } from 'next';
import { CampaignCalendar } from '../../../../../src/features/campaign/campaign-sections';
import { requireStudioSession } from '../../../../../src/lib/supabase/session-boundary';

export const metadata: Metadata = { title: 'Campaign calendar' };

export default async function CampaignCalendarPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const [{ workspace }] = await Promise.all([params, requireStudioSession()]);
  return <CampaignCalendar workspace={workspace} />;
}
