'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PlatformFrame,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import { brandHref, isResourceId, studioHref } from './platform-navigation';
import { PlatformRequestError } from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { BrandDraftEditor } from './brand-draft-editor';
import { BrandLocations } from './brand-locations';
import { BrandSettings } from './brand-settings';
import { BrandStudioChoices } from './legacy-project';
import { UNSAVED_LEAVE_MESSAGE } from './unsaved-navigation';

export function BrandWorkspace({
  studioId,
  workspaceId,
  brandId,
  view,
  locationId,
}: Readonly<{
  studioId?: string | undefined;
  workspaceId: string;
  brandId: string;
  view?: string | undefined;
  locationId?: string | undefined;
}>) {
  if (!studioId && isResourceId(workspaceId) && isResourceId(brandId))
    return (
      <PlatformFrame>
        <BrandStudioChoices workspaceId={workspaceId} brandId={brandId} />
      </PlatformFrame>
    );
  if (!isResourceId(studioId) || !isResourceId(workspaceId) || !isResourceId(brandId))
    return (
      <PlatformFrame>
        <PlatformRecovery
          error={new PlatformRequestError('NOT_FOUND', 'Choose a permitted studio and brand.')}
        />
      </PlatformFrame>
    );
  return (
    <BrandResource
      key={`${studioId}:${workspaceId}:${brandId}`}
      studioId={studioId}
      workspaceId={workspaceId}
      brandId={brandId}
      view={view}
      locationId={locationId}
    />
  );
}
function BrandResource({
  studioId,
  workspaceId,
  brandId,
  view = 'draft',
  locationId,
}: Readonly<{
  studioId: string;
  workspaceId: string;
  brandId: string;
  view?: string | undefined;
  locationId?: string | undefined;
}>) {
  const studio = usePlatformQuery('get_studio_access', { studio_id: studioId });
  const access = usePlatformQuery('get_brand_access', {
    studio_id: studioId,
    workspace_id: workspaceId,
    brand_id: brandId,
  });
  const [dirty, setDirty] = useState(false);
  const [switchCursor, setSwitchCursor] = useState<string | undefined>();
  const brands = usePlatformQuery(
    'list_studio_brands',
    { studio_id: studioId, limit: 100, ...(switchCursor ? { cursor: switchCursor } : {}) },
    access.data !== undefined,
  );
  const router = useRouter();
  if (studio.loading || access.loading)
    return (
      <PlatformFrame>
        <PlatformLoading label="Opening the selected brand…" />
      </PlatformFrame>
    );
  if (studio.error !== undefined || access.error !== undefined || !studio.data || !access.data)
    return (
      <PlatformFrame>
        <PlatformRecovery
          error={access.error ?? studio.error}
          retry={() => {
            access.refresh();
            studio.refresh();
          }}
        />
      </PlatformFrame>
    );
  const current = access.data;
  const canWrite = current.actions.includes('brand:write');
  const confirmLeave = () => !dirty || window.confirm(UNSAVED_LEAVE_MESSAGE);
  return (
    <PlatformFrame
      studioId={studioId}
      studioName={studio.data.studio.name}
      brandName={current.brand.name}
      role={studio.data.role}
    >
      <div className="platform-row platform-between" style={{ marginBottom: 24 }}>
        <Link href={studioHref(studioId)}>← All brands</Link>
        <label>
          Switch brand
          <select
            value={brandId}
            onChange={(event) => {
              const next = brands.data?.items.find((b) => b.id === event.target.value);
              if (next && confirmLeave())
                router.push(brandHref(studioId, next.workspace_id, next.id));
            }}
          >
            <option value={brandId}>{current.brand.name}</option>
            {brands.data?.items
              .filter((b) => b.id !== brandId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
        {brands.data?.next_cursor && (
          <button onClick={() => setSwitchCursor(brands.data?.next_cursor ?? undefined)}>
            More brands
          </button>
        )}
      </div>
      {brands.error !== undefined && (
        <p role="status">
          Brand switching is temporarily unavailable.{' '}
          <Link href={studioHref(studioId)}>Return to the portfolio.</Link>
        </p>
      )}
      {current.brand.status === 'archived' && (
        <p role="status" className="platform-note">
          This brand is archived. Its saved details remain available for reference.
        </p>
      )}
      <nav className="platform-tabs" aria-label="Brand navigation">
        {(['draft', 'locations', 'settings'] as const).map((tab) => (
          <Link
            key={tab}
            href={brandHref(studioId, workspaceId, brandId, tab)}
            aria-current={view === tab ? 'page' : undefined}
          >
            {{ draft: 'Brand draft', locations: 'Locations', settings: 'Settings' }[tab]}
          </Link>
        ))}
        {current.workspace_owner && (
          <Link
            href={brandHref(studioId, workspaceId, brandId, 'billing')}
            aria-current={view === 'billing' ? 'page' : undefined}
          >
            Billing & usage
          </Link>
        )}
      </nav>
      {view === 'locations' ? (
        <BrandLocations
          workspaceId={workspaceId}
          brandId={brandId}
          studioId={studioId}
          locationId={locationId}
          canRead={current.actions.includes('location:read')}
          canWrite={current.actions.includes('location:write')}
        />
      ) : view === 'settings' ? (
        <BrandSettings
          studioId={studioId}
          brand={current.brand}
          workspaceOwner={current.workspace_owner}
          canWrite={canWrite}
          refresh={access.refresh}
        />
      ) : view === 'billing' ? (
        <>
          <PlatformHeading
            title="Workspace billing."
            description="Billing belongs to this workspace and is available to its owner."
          />
          <Link className="platform-button" href={`/studio/${workspaceId}/billing`}>
            Open workspace billing
          </Link>
        </>
      ) : (
        <BrandDraftEditor
          studioId={studioId}
          brand={current.brand}
          canWrite={canWrite}
          onDirty={setDirty}
        />
      )}
    </PlatformFrame>
  );
}
