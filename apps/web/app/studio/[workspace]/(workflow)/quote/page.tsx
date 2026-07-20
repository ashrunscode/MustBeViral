import { QuoteFlow } from './quote-flow';

export default async function QuotePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ state?: string }>;
}>) {
  const [{ workspace }, query] = await Promise.all([params, searchParams]);
  const scenario =
    query.state === 'expired_quote' || query.state === 'cap_exceeded' || query.state === 'conflict'
      ? query.state
      : 'ok';
  return <QuoteFlow workspace={workspace} scenario={scenario} />;
}
