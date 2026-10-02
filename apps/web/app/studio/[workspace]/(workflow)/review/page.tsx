import { ReviewFlow } from './review-flow';
import { requireStudioSession } from '../../../../../src/lib/supabase/session-boundary';

export default async function ReviewPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ run?: string }>;
}>) {
  const [{ workspace }, query, session] = await Promise.all([
    params,
    searchParams,
    requireStudioSession(),
  ]);
  return (
    <ReviewFlow
      {...(query.run === undefined ? {} : { runId: query.run })}
      dataMode={session.mode === 'local-preview' ? 'preview' : 'worker'}
      reviewer={session.mode === 'local-preview' ? 'Maya Chen' : session.subject}
      workspace={workspace}
    />
  );
}
