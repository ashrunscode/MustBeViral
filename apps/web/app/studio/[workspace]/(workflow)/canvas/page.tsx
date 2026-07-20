import { CanvasFlow } from './canvas-flow';

export default async function CanvasPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ fixture?: string; state?: string }>;
}>) {
  const [{ workspace }, query] = await Promise.all([params, searchParams]);
  const scenario =
    query.state === 'conflict' || query.state === 'graph_invalid' ? query.state : 'ok';
  return (
    <CanvasFlow
      workspace={workspace}
      fixtureNodeCount={query.fixture === '500' ? 500 : query.fixture === '100' ? 100 : 12}
      scenario={scenario}
    />
  );
}
