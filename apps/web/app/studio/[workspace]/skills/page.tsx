import { SkillsAccessPanel } from '../../../../src/features/skills/skills-access-panel';

export default async function SkillsPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <SkillsAccessPanel workspaceId={workspace} />;
}
