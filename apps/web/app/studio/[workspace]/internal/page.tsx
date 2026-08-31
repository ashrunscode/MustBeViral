import { InternalOperationsPanel } from '../../../../src/features/internal/internal-operations-panel';

export default async function InternalOperationsPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <InternalOperationsPanel workspace={workspace} />;
}
