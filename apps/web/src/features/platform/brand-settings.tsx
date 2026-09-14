'use client';
import { useState, type FormEvent } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { PlatformHeading, PlatformLoading, PlatformRecovery } from './platform-frame';
import { platformMutationErrorMessage } from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { usePlatformMutation } from './platform-mutation';

export function BrandSettings({
  studioId,
  brand,
  workspaceOwner,
  canWrite,
  refresh,
}: Readonly<{
  studioId: string;
  brand: PlatformOutput<'get_brand'>['record'];
  workspaceOwner: boolean;
  canWrite: boolean;
  refresh: () => void;
}>) {
  const mutation = usePlatformMutation();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await mutation.mutate('update_brand', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      name: String(data.get('name')).trim(),
      slug: brand.slug,
      expected_version: brand.version,
    });
    if (result) refresh();
  }
  return (
    <>
      <PlatformHeading
        title="Brand settings."
        description="Keep this brand’s identity distinct from every other brand in the studio."
      />
      <div className="platform-stack">
        <form className="platform-card platform-pad platform-stack" onSubmit={(e) => void save(e)}>
          <h2>Brand identity</h2>
          <fieldset disabled={!canWrite || mutation.pending}>
            <label>
              Brand name
              <input name="name" defaultValue={brand.name} required maxLength={120} />
            </label>
            <button className="platform-primary" type="submit">
              {mutation.pending ? 'Saving…' : 'Save brand name'}
            </button>
          </fieldset>
          {mutation.error !== undefined && (
            <p role="alert" className="platform-error">
              {platformMutationErrorMessage(mutation.error)}
            </p>
          )}
          {canWrite && (
            <button
              type="button"
              disabled={mutation.pending}
              onClick={() => {
                if (
                  window.confirm(
                    `Archive ${brand.name}? Its saved records will remain available for reference.`,
                  )
                )
                  void mutation
                    .mutate('archive_brand', {
                      workspace_id: brand.workspace_id,
                      brand_id: brand.id,
                      expected_version: brand.version,
                    })
                    .then((result) => {
                      if (result) refresh();
                    });
              }}
            >
              Archive brand
            </button>
          )}
        </form>
        {workspaceOwner && (
          <>
            <WorkspaceSettings workspaceId={brand.workspace_id} />
            <BrandAccessGrants
              studioId={studioId}
              workspaceId={brand.workspace_id}
              brandId={brand.id}
              brandName={brand.name}
            />
          </>
        )}
      </div>
    </>
  );
}
function WorkspaceSettings({ workspaceId }: Readonly<{ workspaceId: string }>) {
  const query = usePlatformQuery('get_workspace_settings', { workspace_id: workspaceId });
  if (query.loading) return <PlatformLoading label="Loading workspace settings…" />;
  if (query.error !== undefined || !query.data)
    return <PlatformRecovery error={query.error} retry={query.refresh} />;
  return (
    <WorkspaceForm
      key={query.data.record.updated_at}
      record={query.data.record}
      refresh={query.refresh}
    />
  );
}
function WorkspaceForm({
  record,
  refresh,
}: Readonly<{ record: PlatformOutput<'get_workspace_settings'>['record']; refresh: () => void }>) {
  const mutation = usePlatformMutation();
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await mutation.mutate('update_workspace_settings', {
      workspace_id: record.id,
      name: String(data.get('name')).trim(),
      slug: record.slug,
      expected_updated_at: record.updated_at,
    });
    if (result) {
      setSaved(true);
      refresh();
    }
  }
  return (
    <form className="platform-card platform-pad platform-stack" onSubmit={(e) => void save(e)}>
      <h2>Workspace</h2>
      <p className="platform-muted">
        This workspace owns the brand records and ledger. Only its owner can edit these settings.
      </p>
      <fieldset disabled={mutation.pending || record.status !== 'active'}>
        <label>
          Workspace name
          <input name="name" defaultValue={record.name} required maxLength={120} />
        </label>
        <button type="submit" className="platform-primary">
          {mutation.pending ? 'Saving…' : 'Save workspace name'}
        </button>
      </fieldset>
      {saved && <p role="status">Workspace name saved.</p>}
      {mutation.error !== undefined && (
        <p role="alert" className="platform-error">
          {platformMutationErrorMessage(mutation.error)}
        </p>
      )}
    </form>
  );
}

function BrandAccessGrants({
  studioId,
  workspaceId,
  brandId,
  brandName,
}: Readonly<{
  studioId: string;
  workspaceId: string;
  brandId: string;
  brandName: string;
}>) {
  const studios = usePlatformQuery('list_studios', { limit: 100 });
  const grants = usePlatformQuery(
    'list_workspace_access_grants',
    { studio_id: studioId, workspace_id: workspaceId, limit: 100 },
    true,
    true,
  );
  const mutation = usePlatformMutation();
  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const selected = String(values.get('studio_id'));
    const write = values.get('write') === 'on';
    const locations = values.get('locations') === 'on';
    const actions: Array<'brand:read' | 'brand:write' | 'location:read' | 'location:write'> = [
      'brand:read',
    ];
    if (write) actions.push('brand:write');
    if (locations) actions.push('location:read', 'location:write');
    const result = await mutation.mutate('grant_workspace_access', {
      workspace_id: workspaceId,
      studio_id: selected,
      brand_id: brandId,
      actions,
    });
    if (result) grants.refresh();
  }
  return (
    <section className="platform-card platform-pad platform-stack">
      <h2>Studio access to this brand</h2>
      <p className="platform-muted">
        An invitation never creates workspace authority. Share this brand with a studio through an
        explicit grant, and revoke that grant to remove it.
      </p>
      <form className="platform-stack" onSubmit={(e) => void grant(e)}>
        <fieldset disabled={mutation.pending}>
          <label>
            Studio
            <select name="studio_id" required defaultValue={studioId}>
              {studios.data?.items.map((studio) => (
                <option key={studio.id} value={studio.id}>
                  {studio.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" name="write" defaultChecked /> Editors may update this brand’s
            saved details
          </label>
          <label>
            <input type="checkbox" name="locations" defaultChecked /> Include locations
          </label>
          <button type="submit" className="platform-primary">
            {mutation.pending ? 'Saving grant…' : `Share ${brandName} with this studio`}
          </button>
        </fieldset>
      </form>
      {mutation.error !== undefined && (
        <p role="alert" className="platform-error">
          {platformMutationErrorMessage(mutation.error)}
        </p>
      )}
      {grants.loading && <PlatformLoading label="Loading current grants…" />}
      {grants.error !== undefined && (
        <PlatformRecovery error={grants.error} retry={grants.refresh} />
      )}
      {grants.data?.items.length === 0 && (
        <p>
          No current grants for this studio and workspace. This studio cannot open the brand until
          one exists.
        </p>
      )}
      <div className="platform-stack">
        {grants.data?.items.map((grant) => (
          <article key={grant.id} className="platform-row platform-between">
            <div>
              <strong>{grant.brand_id ? 'This brand only' : 'All brands in the workspace'}</strong>
              <p className="platform-muted">{grant.actions.join(', ')}</p>
              <span className="platform-tag">{grant.status}</span>
            </div>
            {grant.status === 'active' && (
              <button
                type="button"
                disabled={mutation.pending}
                onClick={() => {
                  void mutation
                    .mutate('revoke_workspace_access', {
                      workspace_id: workspaceId,
                      grant_id: grant.id,
                      expected_version: grant.version,
                    })
                    .then((result) => {
                      if (result) grants.refresh();
                    });
                }}
              >
                Revoke grant
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
