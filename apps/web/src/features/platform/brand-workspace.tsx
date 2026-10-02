'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { PlatformFrame, PlatformLoading, PlatformRecovery } from './platform-frame';
import {
  BRAND_SECTIONS,
  brandHref,
  isResourceId,
  resolveBrandSection,
  studioHref,
  workspaceBillingHref,
} from './platform-navigation';
import { PlatformRequestError } from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { BrandDraftEditor } from './brand-draft-editor';
import { BrandFindings } from './brand-findings';
import { BrandLocations } from './brand-locations';
import { BrandSettings } from './brand-settings';
import {
  BrandAssets,
  BrandCalendar,
  BrandCampaigns,
  BrandChannels,
  BrandContent,
  BrandInbox,
  BrandOverview,
  BrandResults,
} from './brand-sections';
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
  view,
  locationId,
}: Readonly<{
  studioId: string;
  workspaceId: string;
  brandId: string;
  view?: string | undefined;
  locationId?: string | undefined;
}>) {
  const studio = usePlatformQuery('get_studio_access', { studio_id: studioId }, true, true);
  const access = usePlatformQuery(
    'get_brand_access',
    {
      studio_id: studioId,
      workspace_id: workspaceId,
      brand_id: brandId,
    },
    true,
    true,
  );
  const [dirty, setDirty] = useState(false);
  const [switchCursor, setSwitchCursor] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState<{
    studio: PlatformOutput<'get_studio_access'>;
    access: PlatformOutput<'get_brand_access'>;
  } | null>(null);
  // Preserve component state only within this keyed resource. Fresh query results own permissions.
  if (studio.error !== undefined || access.error !== undefined) {
    if (confirmed !== null) setConfirmed(null);
  } else if (
    studio.data &&
    access.data &&
    (confirmed?.studio !== studio.data || confirmed?.access !== access.data)
  ) {
    setConfirmed({ studio: studio.data, access: access.data });
  }
  const brands = usePlatformQuery(
    'list_studio_brands',
    { studio_id: studioId, limit: 100, ...(switchCursor ? { cursor: switchCursor } : {}) },
    confirmed !== null,
  );
  const refreshAccess = access.refresh;
  const refreshStudio = studio.refresh;
  const onAuthorityLost = useCallback(() => {
    refreshAccess();
    refreshStudio();
  }, [refreshAccess, refreshStudio]);
  const router = useRouter();
  const { section, unknown } = resolveBrandSection(view);
  if (studio.error !== undefined || access.error !== undefined)
    return (
      <PlatformFrame section="brands">
        <PlatformRecovery
          error={access.error ?? studio.error}
          retry={() => {
            access.refresh();
            studio.refresh();
          }}
        />
      </PlatformFrame>
    );
  if (!confirmed)
    return (
      <PlatformFrame section="brands">
        <PlatformLoading label="Opening the selected brand…" />
      </PlatformFrame>
    );
  const current = access.data ?? confirmed.access;
  const currentStudio = studio.data ?? confirmed.studio;
  const waiting = studio.loading || access.loading || !studio.data || !access.data;
  const canWrite = !waiting && current.actions.includes('brand:write');
  const confirmLeave = () => !dirty || window.confirm(UNSAVED_LEAVE_MESSAGE);
  const scope = { studioId, brand: current.brand, canWrite };
  const switcher = (
    <>
      <label>
        Switch brand
        <select
          value={brandId}
          disabled={waiting}
          onChange={(event) => {
            const next = brands.data?.items.find((b) => b.id === event.target.value);
            if (next && confirmLeave())
              router.push(brandHref(studioId, next.workspace_id, next.id, section));
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
      {brands.data?.next_cursor ? (
        <button
          type="button"
          onClick={() => setSwitchCursor(brands.data?.next_cursor ?? undefined)}
        >
          More brands
        </button>
      ) : null}
    </>
  );
  return (
    <PlatformFrame
      studio={{
        id: studioId,
        name: currentStudio.studio.name,
        ...(waiting ? {} : { role: currentStudio.role }),
      }}
      brand={{ id: brandId, name: current.brand.name, workspaceId }}
      section="brands"
      contextControls={switcher}
      showBilling={!waiting && current.workspace_owner}
    >
      {waiting ? (
        <p role="status" aria-live="polite" className="platform-note">
          Confirming your access…
        </p>
      ) : null}
      <div hidden={waiting} inert={waiting}>
        <div className="platform-row platform-between" style={{ marginBottom: 16 }}>
          <Link href={studioHref(studioId, 'brands')}>All brands</Link>
        </div>
        {brands.error !== undefined ? (
          <p role="status" className="platform-note">
            Brand switching is temporarily unavailable.{' '}
            <Link href={studioHref(studioId, 'brands')}>Return to all brands.</Link>
          </p>
        ) : null}
        {current.brand.status === 'archived' ? (
          <p role="status" className="platform-note">
            This brand is archived. Its saved details remain available for reference.
          </p>
        ) : null}
        {unknown !== null ? (
          <p role="status" className="platform-note">
            There is no “{unknown}” section for a brand. Showing the overview.
          </p>
        ) : null}
        <nav className="platform-tabs" aria-label="Brand navigation">
          {BRAND_SECTIONS.map((tab) => (
            <Link
              key={tab.key}
              href={brandHref(studioId, workspaceId, brandId, tab.key)}
              aria-current={section === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
          {current.workspace_owner ? (
            <Link href={workspaceBillingHref(workspaceId, studioId, brandId)}>Billing</Link>
          ) : null}
        </nav>
        {section === 'findings' ? (
          <BrandFindings
            studioId={studioId}
            brand={current.brand}
            canWrite={canWrite}
            onAuthorityLost={onAuthorityLost}
          />
        ) : section === 'locations' ? (
          <BrandLocations
            workspaceId={workspaceId}
            brandId={brandId}
            studioId={studioId}
            locationId={locationId}
            canRead={!waiting && current.actions.includes('location:read')}
            canWrite={!waiting && current.actions.includes('location:write')}
          />
        ) : section === 'settings' ? (
          <BrandSettings
            studioId={studioId}
            brand={current.brand}
            workspaceOwner={current.workspace_owner}
            canWrite={canWrite}
            refresh={access.refresh}
          />
        ) : section === 'draft' ? (
          <BrandDraftEditor
            studioId={studioId}
            brand={current.brand}
            canWrite={canWrite}
            onDirty={setDirty}
          />
        ) : section === 'campaigns' ? (
          <BrandCampaigns {...scope} />
        ) : section === 'calendar' ? (
          <BrandCalendar {...scope} />
        ) : section === 'assets' ? (
          <BrandAssets {...scope} />
        ) : section === 'channels' ? (
          <BrandChannels {...scope} />
        ) : section === 'content' ? (
          <BrandContent {...scope} />
        ) : section === 'inbox' ? (
          <BrandInbox {...scope} />
        ) : section === 'results' ? (
          <BrandResults {...scope} />
        ) : (
          <BrandOverview {...scope} />
        )}
      </div>
    </PlatformFrame>
  );
}
