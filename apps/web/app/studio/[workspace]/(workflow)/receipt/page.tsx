import { ReceiptFlow } from './receipt-flow';
import { requireStudioSession } from '../../../../../src/lib/supabase/session-boundary';

export default async function ReceiptPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ run?: string; state?: string }>;
}>) {
  const [{ workspace }, query, session] = await Promise.all([
    params,
    searchParams,
    requireStudioSession(),
  ]);
  const preview = session.mode === 'local-preview';
  const scenario =
    preview && (query.state === 'review_incomplete' || query.state === 'conflict')
      ? query.state
      : 'ok';
  return (
    <ReceiptFlow
      {...(query.run === undefined ? {} : { runId: query.run })}
      dataMode={preview ? 'preview' : 'worker'}
      workspace={workspace}
      scenario={scenario}
    />
  );
}
