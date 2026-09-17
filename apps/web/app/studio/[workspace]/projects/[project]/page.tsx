import { LegacyProject } from '../../../../../src/features/platform/legacy-project';

export default async function LegacyProjectPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string; project: string }> }>) {
  const { workspace, project } = await params;
  return <LegacyProject workspaceId={workspace} projectId={project} />;
}
