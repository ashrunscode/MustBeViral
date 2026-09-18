'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { PlatformHeading, PlatformLoading, PlatformRecovery } from './platform-frame';
import { platformMutationErrorMessage, PlatformRequestError } from './platform-client';
import { brandHref, isResourceId } from './platform-navigation';
import { usePlatformQuery } from './use-platform-query';
import { usePlatformMutation } from './platform-mutation';

export function BrandLocations({
  studioId,
  workspaceId,
  brandId,
  locationId,
  canRead,
  canWrite,
}: Readonly<{
  studioId: string;
  workspaceId: string;
  brandId: string;
  locationId?: string | undefined;
  canRead: boolean;
  canWrite: boolean;
}>) {
  const [cursor, setCursor] = useState<string | undefined>();
  const query = usePlatformQuery(
    'list_brand_locations',
    {
      workspace_id: workspaceId,
      brand_id: brandId,
      limit: 20,
      include_archived: true,
      ...(cursor ? { cursor } : {}),
    },
    canRead,
  );
  if (!canRead)
    return (
      <PlatformRecovery
        error={new PlatformRequestError('FORBIDDEN', 'Location read grant required')}
      />
    );
  return (
    <>
      <PlatformHeading
        title="Keep every location in context."
        description="Name the locations this brand uses and keep their time zones explicit."
      />
      {locationId ? (
        isResourceId(locationId) ? (
          <LocationDetail
            key={locationId}
            workspaceId={workspaceId}
            brandId={brandId}
            locationId={locationId}
            canWrite={canWrite}
          />
        ) : (
          <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'Invalid location')} />
        )
      ) : (
        <>
          {canWrite && (
            <LocationForm workspaceId={workspaceId} brandId={brandId} onSaved={query.refresh} />
          )}
          <div className="platform-section">
            <h2>Saved locations</h2>
          </div>
          {query.loading && <PlatformLoading label="Loading locations…" />}
          {query.error !== undefined && (
            <PlatformRecovery error={query.error} retry={query.refresh} />
          )}
          {query.data?.items.length === 0 && (
            <div className="platform-note">
              No locations yet. Add only the places that belong to this brand.
            </div>
          )}
          <div className="platform-grid">
            {query.data?.items.map((location) => (
              <article key={location.id} className="platform-card platform-pad platform-stack">
                <div className="platform-row platform-between">
                  <h2>{location.name}</h2>
                  <span className="platform-tag">{location.status}</span>
                </div>
                <p>{location.time_zone}</p>
                <Link
                  className="platform-button"
                  href={brandHref(studioId, workspaceId, brandId, 'locations', location.id)}
                >
                  Open location
                </Link>
              </article>
            ))}
          </div>
          <div className="platform-section">
            {cursor && <button onClick={() => setCursor(undefined)}>First locations</button>}
            {query.data?.next_cursor && (
              <button onClick={() => setCursor(query.data?.next_cursor ?? undefined)}>
                More locations
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
function LocationDetail({
  workspaceId,
  brandId,
  locationId,
  canWrite,
}: Readonly<{ workspaceId: string; brandId: string; locationId: string; canWrite: boolean }>) {
  const query = usePlatformQuery('get_brand_location', {
    workspace_id: workspaceId,
    brand_id: brandId,
    location_id: locationId,
  });
  if (query.loading) return <PlatformLoading label="Opening this location…" />;
  if (query.error !== undefined || !query.data)
    return <PlatformRecovery error={query.error} retry={query.refresh} />;
  const record = query.data.record;
  return (
    <LocationForm
      key={`${record.id}:${record.version}`}
      workspaceId={workspaceId}
      brandId={brandId}
      record={record}
      onSaved={query.refresh}
      readOnly={!canWrite || record.status === 'archived'}
    />
  );
}
function LocationForm({
  workspaceId,
  brandId,
  record,
  onSaved,
  readOnly = false,
}: Readonly<{
  workspaceId: string;
  brandId: string;
  record?: PlatformOutput<'get_brand_location'>['record'];
  onSaved: () => void;
  readOnly?: boolean;
}>) {
  const mutation = usePlatformMutation();
  const [newSlug, setNewSlug] = useState(() => `location-${crypto.randomUUID()}`);
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const input = {
      workspace_id: workspaceId,
      brand_id: brandId,
      name: String(values.get('name')).trim(),
      slug: record?.slug ?? newSlug,
      time_zone: String(values.get('time_zone')).trim(),
    };
    const result = record
      ? await mutation.mutate('update_brand_location', {
          ...input,
          location_id: record.id,
          expected_version: record.version,
        })
      : await mutation.mutate('create_brand_location', input);
    if (result) {
      setSaved(true);
      if (!record) {
        form.reset();
        setNewSlug(`location-${crypto.randomUUID()}`);
      }
      onSaved();
    }
  }
  return (
    <form className="platform-card platform-pad platform-stack" onSubmit={(e) => void save(e)}>
      <h2>{record ? record.name : 'Add a location'}</h2>
      <fieldset disabled={mutation.pending || readOnly}>
        <label>
          Location name
          <input name="name" required maxLength={120} defaultValue={record?.name ?? ''} />
        </label>
        <label>
          Time zone
          <input
            name="time_zone"
            required
            maxLength={100}
            defaultValue={record?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
            placeholder="America/Chicago"
          />
        </label>
        <p className="platform-muted">
          Check the time zone for this location. Opening hours, service hours and delivery coverage
          are separate details.
        </p>
        <button type="submit" className="platform-primary">
          {mutation.pending ? 'Saving…' : record ? 'Save location' : 'Add location'}
        </button>
      </fieldset>
      {saved && (
        <p role="status" className="platform-success">
          Location saved.
        </p>
      )}
      {mutation.error !== undefined && (
        <p role="alert" className="platform-error">
          {platformMutationErrorMessage(mutation.error)}
        </p>
      )}
      {record && !readOnly && (
        <button
          type="button"
          disabled={mutation.pending}
          onClick={() => {
            void mutation
              .mutate('archive_brand_location', {
                workspace_id: workspaceId,
                brand_id: brandId,
                location_id: record.id,
                expected_version: record.version,
              })
              .then((result) => {
                if (result) onSaved();
              });
          }}
        >
          Archive location
        </button>
      )}
      {readOnly && (
        <p className="platform-note">
          This location is available for reference. Editing is unavailable.
        </p>
      )}
    </form>
  );
}
