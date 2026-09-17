import { BrandWorkspace } from '../../../../../src/features/platform/brand-workspace';

export default async function BrandPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ workspace: string; brand: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [ids, query] = await Promise.all([params, searchParams]);
  return (
    <BrandWorkspace
      workspaceId={ids.workspace}
      brandId={ids.brand}
      studioId={typeof query.studio === 'string' ? query.studio : undefined}
      view={typeof query.view === 'string' ? query.view : undefined}
      locationId={typeof query.location === 'string' ? query.location : undefined}
    />
  );
}
