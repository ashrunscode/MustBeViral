import { ReviewFlow } from './review-flow';

export default async function ReviewPage({
  params,
}: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ReviewFlow workspace={workspace} />;
}
