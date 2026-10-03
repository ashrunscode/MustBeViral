import { redirect } from 'next/navigation';

import { StudioPortfolio } from '../../../src/features/platform/studio-portfolio';
import { requireStudioSession } from '../../../src/lib/supabase/session-boundary';

export default async function StudioPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const [query, session] = await Promise.all([searchParams, requireStudioSession()]);
  // The local preview has no studios to list; its entry is the continue screen.
  if (session.mode === 'local-preview') redirect('/studio/continue');
  return (
    <StudioPortfolio
      studioId={typeof query.studio === 'string' ? query.studio : undefined}
      view={typeof query.view === 'string' ? query.view : undefined}
    />
  );
}
