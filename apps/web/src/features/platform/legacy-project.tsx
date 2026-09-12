'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  PlatformFrame,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import { PlatformRequestError } from './platform-client';
import { brandHref, isResourceId } from './platform-navigation';
import { usePlatformQuery } from './use-platform-query';

export function LegacyProject({
  workspaceId,
  projectId,
}: Readonly<{ workspaceId: string; projectId: string }>) {
  const valid = isResourceId(workspaceId) && isResourceId(projectId);
  const query = usePlatformQuery(
    'resolve_project_brand',
    { workspace_id: workspaceId, project_id: projectId },
    valid,
  );
  return (
    <PlatformFrame>
      <PlatformHeading
        title="Pick up this campaign in the right brand."
        description="Your original project stays attached to its saved workspace and history."
      />
      {!valid ? (
        <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'Invalid project')} />
      ) : query.loading ? (
        <PlatformLoading label="Resolving the original project…" />
      ) : query.error !== undefined || !query.data ? (
        <PlatformRecovery error={query.error} retry={query.refresh} />
      ) : query.data.state === 'mapping_required' || !query.data.brand_id ? (
        <div className="platform-card platform-pad platform-stack">
          <h2>This project needs a brand mapping.</h2>
          <p>
            The project is available, but its brand has not been mapped yet. Ask the workspace owner
            to have the original project mapping reviewed.
          </p>
          <Link className="platform-button" href="/studio">
            Return to your studios
          </Link>
        </div>
      ) : (
        <BrandStudioChoices workspaceId={workspaceId} brandId={query.data.brand_id} />
      )}
    </PlatformFrame>
  );
}
export function BrandStudioChoices({
  workspaceId,
  brandId,
}: Readonly<{ workspaceId: string; brandId: string }>) {
  const [cursor, setCursor] = useState<string | undefined>();
  const query = usePlatformQuery('list_brand_studios', {
    workspace_id: workspaceId,
    brand_id: brandId,
    limit: 20,
    ...(cursor ? { cursor } : {}),
  });
  if (query.loading)
    return <PlatformLoading label="Finding the studios permitted to open this brand…" />;
  if (query.error !== undefined || !query.data)
    return <PlatformRecovery error={query.error} retry={query.refresh} />;
  return (
    <div className="platform-stack">
      <h2>Choose a studio</h2>
      {query.data.items.length === 0 && (
        <p>
          No current studio grant can open this brand. Ask the workspace owner to review access.
        </p>
      )}
      {query.data.items.map((studio) => (
        <Link
          key={studio.id}
          className="platform-card platform-pad platform-row platform-between"
          href={brandHref(studio.id, workspaceId, brandId)}
        >
          <h3>{studio.name}</h3>
          <span>Open brand →</span>
        </Link>
      ))}
      <div className="platform-row">
        {cursor && <button onClick={() => setCursor(undefined)}>First studios</button>}
        {query.data.next_cursor && (
          <button onClick={() => setCursor(query.data?.next_cursor ?? undefined)}>
            More studios
          </button>
        )}
      </div>
    </div>
  );
}
