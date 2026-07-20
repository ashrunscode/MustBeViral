import { ReceiptFlow } from './receipt-flow';

export default async function ReceiptPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ state?: string }>;
}>) {
  const [{ workspace }, query] = await Promise.all([params, searchParams]);
  const scenario =
    query.state === 'review_incomplete' || query.state === 'conflict' ? query.state : 'ok';
  return <ReceiptFlow workspace={workspace} scenario={scenario} />;
}
