import { CanvasFlow } from './canvas-flow';
import { requireStudioSession } from '../../../../../src/lib/supabase/session-boundary';

export default async function CanvasPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ canvas?: string; fixture?: string; state?: string }>;
}>) {
  const [{ workspace }, query, session] = await Promise.all([
    params,
    searchParams,
    requireStudioSession(),
  ]);
  const preview = session.mode === 'local-preview';
  const scenario =
    preview && (query.state === 'conflict' || query.state === 'graph_invalid') ? query.state : 'ok';
  return (
    <CanvasFlow
      {...(query.canvas === undefined ? {} : { canvasId: query.canvas })}
      dataMode={preview ? 'preview' : 'worker'}
      workspace={workspace}
      fixtureNodeCount={
        preview && query.fixture === '500' ? 500 : preview && query.fixture === '100' ? 100 : 12
      }
      scenario={scenario}
    />
  );
}
