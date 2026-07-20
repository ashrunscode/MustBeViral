import { CampaignBrief } from './campaign-brief';

export default async function CampaignBriefPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <CampaignBrief workspace={workspace} />;
}
