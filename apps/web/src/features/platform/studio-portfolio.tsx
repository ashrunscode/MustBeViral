'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import {
  PlatformFrame,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import { brandHref, isResourceId, studioHref } from './platform-navigation';
import { platformErrorMessage, PlatformRequestError } from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { usePlatformMutation } from './platform-mutation';
import { StudioTeam } from './studio-team';
import { StudioSettings } from './studio-settings';

export function StudioPortfolio({
  studioId,
  view,
}: Readonly<{ studioId?: string | undefined; view?: string | undefined }>) {
  if (studioId && !isResourceId(studioId))
    return (
      <PlatformFrame>
        <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'Invalid studio')} />
      </PlatformFrame>
    );
  return studioId ? (
    <SelectedStudio key={studioId} studioId={studioId} view={view} />
  ) : (
    <StudioChooser />
  );
}
function StudioChooser() {
  const [newSlug] = useState(() => `studio-${crypto.randomUUID()}`);
  const [cursor, setCursor] = useState<string | undefined>();
  const studios = usePlatformQuery(
    'list_studios',
    { limit: 20, ...(cursor ? { cursor } : {}) },
    true,
    true,
  );
  const invitations = usePlatformQuery('list_my_invitations', {});
  const mutation = usePlatformMutation();
  const router = useRouter();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get('name')).trim();
    const result = await mutation.mutate('create_studio', { name, slug: newSlug });
    if (result) router.push(studioHref(result.record.id));
  }
  return (
    <PlatformFrame>
      <PlatformHeading
        title="Good work starts with the right context."
        description="Choose your studio, then pick the brand you want to work on."
      />
      <div className="platform-split">
        <section className="platform-stack" aria-label="Your studios">
          {studios.loading && <PlatformLoading />}
          {studios.error !== undefined && (
            <PlatformRecovery error={studios.error} retry={studios.refresh} />
          )}
          {studios.data?.items.map((s) => (
            <Link
              className="platform-card platform-pad platform-row platform-between"
              href={studioHref(s.id)}
              key={s.id}
            >
              <h2>{s.name}</h2>
              <span>Open studio →</span>
            </Link>
          ))}
          {studios.data?.items.length === 0 && (
            <div className="platform-card platform-pad">
              <h2>Your first studio starts here.</h2>
              <p>Create a studio for one brand or a portfolio of brands.</p>
            </div>
          )}
          <div className="platform-row">
            {cursor && <button onClick={() => setCursor(undefined)}>First page</button>}
            {studios.data?.next_cursor && (
              <button onClick={() => setCursor(studios.data?.next_cursor ?? undefined)}>
                More studios
              </button>
            )}
          </div>
        </section>
        <form
          onSubmit={(e) => void create(e)}
          className="platform-card platform-pad platform-stack"
        >
          <h2>Create a studio</h2>
          <fieldset disabled={mutation.pending}>
            <label>
              Studio name
              <input
                name="name"
                autoComplete="organization"
                required
                maxLength={120}
                placeholder="Your studio or business"
              />
            </label>
            <button className="platform-primary" type="submit">
              {mutation.pending ? 'Creating…' : 'Create studio'}
            </button>
          </fieldset>
          {mutation.error !== undefined && (
            <p role="alert" className="platform-error">
              {platformErrorMessage(mutation.error)}
            </p>
          )}
        </form>
      </div>
      <div className="platform-section">
        <h2>Invitations</h2>
      </div>
      {invitations.loading && <PlatformLoading label="Checking your invitations…" />}
      {invitations.error !== undefined && (
        <PlatformRecovery error={invitations.error} retry={invitations.refresh} />
      )}
      {invitations.data?.items.length === 0 && (
        <p>No pending invitations for your verified email.</p>
      )}
      <div className="platform-stack">
        {invitations.data?.items.map(({ invitation, studio_name }) => (
          <div
            className="platform-card platform-pad platform-row platform-between"
            key={invitation.id}
          >
            <div>
              <h3>{studio_name}</h3>
              <p>
                {invitation.role} · Expires {new Date(invitation.expires_at).toLocaleDateString()}
              </p>
              <small>Access covers the workspaces explicitly shared with this studio.</small>
            </div>
            <button
              disabled={mutation.pending}
              onClick={() => {
                void mutation
                  .mutate('accept_studio_invitation', {
                    invitation_id: invitation.id,
                    expected_version: invitation.version,
                  })
                  .then((result) => {
                    if (result) router.push(studioHref(result.record.studio_id));
                  });
              }}
            >
              Accept invitation
            </button>
          </div>
        ))}
      </div>
    </PlatformFrame>
  );
}
function SelectedStudio({
  studioId,
  view,
}: Readonly<{ studioId: string; view?: string | undefined }>) {
  const access = usePlatformQuery('get_studio_access', { studio_id: studioId });
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [archives, setArchives] = useState(false);
  const brands = usePlatformQuery(
    'list_studio_brands',
    {
      studio_id: studioId,
      search,
      limit: 20,
      include_archived: archives,
      ...(cursor ? { cursor } : {}),
    },
    access.data !== undefined,
    true,
  );
  const [adding, setAdding] = useState(false);
  if (access.loading)
    return (
      <PlatformFrame>
        <PlatformLoading />
      </PlatformFrame>
    );
  if (access.error !== undefined || !access.data)
    return (
      <PlatformFrame>
        <PlatformRecovery error={access.error} retry={access.refresh} />
      </PlatformFrame>
    );
  const { studio, role } = access.data;
  const canWrite = role !== 'viewer' && studio.status === 'active';
  return (
    <PlatformFrame studioId={studio.id} studioName={studio.name} role={role}>
      {studio.status === 'archived' && (
        <div role="status" className="platform-note">
          This studio is archived. Its identity is retained; new work is unavailable.
        </div>
      )}
      {view === 'team' ? (
        <StudioTeam studio={studio} role={role} refresh={access.refresh} />
      ) : view === 'settings' ? (
        <StudioSettings studio={studio} role={role} refresh={access.refresh} />
      ) : (
        <>
          <PlatformHeading
            title="Good work starts with the right context."
            description="Choose a brand. Keep its voice, original assets and approvals together."
          >
            {canWrite && (
              <button className="platform-primary" onClick={() => setAdding((value) => !value)}>
                {adding ? 'Close new brand' : '+ Add a brand'}
              </button>
            )}
          </PlatformHeading>
          {adding && <NewBrand studioId={studio.id} />}
          <div className="platform-section">
            <h2>Your brands</h2>
            <div className="platform-row">
              <label className="platform-search">
                Find a brand
                <input
                  type="search"
                  value={search}
                  placeholder="Search this studio"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCursor(undefined);
                  }}
                />
              </label>
              <label>
                Show
                <select
                  value={archives ? 'all' : 'active'}
                  onChange={(e) => {
                    setArchives(e.target.value === 'all');
                    setCursor(undefined);
                  }}
                >
                  <option value="active">Active brands</option>
                  <option value="all">Include archived</option>
                </select>
              </label>
            </div>
          </div>
          {brands.loading && <PlatformLoading label="Finding your brands…" />}
          {brands.error !== undefined && (
            <PlatformRecovery error={brands.error} retry={brands.refresh} />
          )}
          {brands.data?.items.length === 0 && (
            <div className="platform-card platform-pad platform-stack">
              <h2>{search ? 'No brands match this search.' : 'Make room for your first brand.'}</h2>
              <p>
                {search
                  ? 'Try another name or clear the search.'
                  : canWrite
                    ? 'Start with a name. You can add the website and details as you go.'
                    : 'A workspace owner needs to share a brand with this studio.'}
              </p>
            </div>
          )}
          <div className="platform-grid">
            {brands.data?.items.map((b) => (
              <BrandCard key={b.id} brand={b} studioId={studio.id} />
            ))}
          </div>
          <div className="platform-section">
            {cursor && <button onClick={() => setCursor(undefined)}>First page</button>}
            {brands.data?.next_cursor && (
              <button onClick={() => setCursor(brands.data?.next_cursor ?? undefined)}>
                More brands
              </button>
            )}
          </div>
        </>
      )}
    </PlatformFrame>
  );
}
function BrandCard({
  brand,
  studioId,
}: Readonly<{ brand: PlatformOutput<'get_brand'>['record']; studioId: string }>) {
  return (
    <article className="platform-card">
      <div className="platform-brand-mark" aria-hidden="true">
        {brand.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="platform-pad platform-stack">
        <div className="platform-row platform-between">
          <h2>{brand.name}</h2>
          <span className="platform-tag">
            {brand.status === 'archived' ? 'Archived' : 'Brand workspace'}
          </span>
        </div>
        <p>Brand essentials, locations and saved setup.</p>
        <Link className="platform-button" href={brandHref(studioId, brand.workspace_id, brand.id)}>
          Open {brand.name} →
        </Link>
      </div>
    </article>
  );
}
function NewBrand({ studioId }: Readonly<{ studioId: string }>) {
  const [newSlug] = useState(() => `brand-${crypto.randomUUID()}`);
  const mutation = usePlatformMutation();
  const router = useRouter();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    // The slug is an identity, not a guess about another workspace with the same name.
    const result = await mutation.mutate('start_brand_draft', {
      studio_id: studioId,
      name,
      slug: newSlug,
    });
    if (result) router.push(brandHref(studioId, result.brand.workspace_id, result.brand.id));
  }
  return (
    <form className="platform-card platform-pad platform-stack" onSubmit={(e) => void create(e)}>
      <h2>Start with the essentials.</h2>
      <p>A new brand gets its own workspace. We save the draft as soon as you create it.</p>
      <fieldset disabled={mutation.pending}>
        <label>
          Brand name
          <input
            name="name"
            required
            maxLength={120}
            autoComplete="organization"
            placeholder="What is the brand called?"
          />
        </label>
        <button className="platform-primary" type="submit">
          {mutation.pending ? 'Saving your new brand…' : 'Create brand draft'}
        </button>
      </fieldset>
      {mutation.error !== undefined && (
        <p role="alert" className="platform-error">
          {platformErrorMessage(mutation.error)}
        </p>
      )}
    </form>
  );
}
