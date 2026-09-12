import { StudioPortfolio } from '../../src/features/platform/studio-portfolio';
import { requireStudioSession } from '../../src/lib/supabase/session-boundary';

export default async function StudioPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const [query] = await Promise.all([searchParams, requireStudioSession()]);
  return (
    <StudioPortfolio
      studioId={typeof query.studio === 'string' ? query.studio : undefined}
      view={typeof query.view === 'string' ? query.view : undefined}
    />
  );
}
