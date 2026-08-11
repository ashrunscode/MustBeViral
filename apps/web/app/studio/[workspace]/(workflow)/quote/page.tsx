import { QuoteFlow } from './quote-flow';
import { requireStudioSession } from '../../../../../src/lib/supabase/session-boundary';

export default async function QuotePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{
    canvas?: string;
    revision?: string;
    state?: string;
    stage?: string;
    run?: string;
  }>;
}>) {
  const [{ workspace }, query, session] = await Promise.all([
    params,
    searchParams,
    requireStudioSession(),
  ]);
  const preview = session.mode === 'local-preview';
  const scenario =
    preview &&
    (query.state === 'expired_quote' ||
      query.state === 'cap_exceeded' ||
      query.state === 'conflict')
      ? query.state
      : 'ok';
  return (
    <QuoteFlow
      {...(query.canvas === undefined ? {} : { canvasId: query.canvas })}
      {...(query.revision === undefined ? {} : { revisionId: query.revision })}
      dataMode={preview ? 'preview' : 'worker'}
      workspace={workspace}
      scenario={scenario}
      startInRunStage={preview && query.stage === 'run'}
      runScenario={preview && query.run === 'failed' ? 'failed' : 'normal'}
    />
  );
}
