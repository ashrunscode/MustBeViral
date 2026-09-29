import { ApiKeysAccessPanel } from '../../../../src/features/access/api-keys-access-panel';

export default async function AccessPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ApiKeysAccessPanel workspaceId={workspace} />;
}
