import { ReviewFlow } from '../review-flow';

export default async function ComparePage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ReviewFlow workspace={workspace} mode="compare" />;
}
