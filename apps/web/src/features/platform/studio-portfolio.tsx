'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  PlatformFrame,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import {
  isResourceId,
  isStudioSection,
  studioHref,
  type StudioSection,
} from './platform-navigation';
import { platformMutationErrorMessage, PlatformRequestError } from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { usePlatformMutation } from './platform-mutation';
import { StudioTeam } from './studio-team';
import { StudioSettings } from './studio-settings';
import {
  StudioApprovals,
  StudioBrands,
  StudioCalendar,
  StudioCreators,
  StudioOverview,
  StudioReports,
  StudioTasks,
} from './studio-sections';

export function StudioPortfolio({
  studioId,
  view,
}: Readonly<{ studioId?: string | undefined; view?: string | undefined }>) {
  if (studioId && !isResourceId(studioId))
    return (
      <PlatformFrame>
        <PlatformRecovery
          error={
            new PlatformRequestError(
              'NOT_FOUND',
              'That studio link is not valid. Choose a studio from the list.',
            )
          }
        />
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
          {studios.data?.items.map((studio) => (
            <Link
              className="platform-card platform-pad platform-row platform-between"
              href={studioHref(studio.id)}
              key={studio.id}
            >
              <h2>{studio.name}</h2>
              <span className="platform-tag">
                {studio.status === 'archived' ? 'Archived' : 'Open studio'}
              </span>
            </Link>
          ))}
          {studios.data?.items.length === 0 && (
            <div className="platform-card platform-pad">
              <h2>Your first studio starts here.</h2>
              <p>Create a studio for one brand or a portfolio of brands.</p>
            </div>
          )}
          <div className="platform-row">
            {cursor && (
              <button type="button" onClick={() => setCursor(undefined)}>
                First page
              </button>
            )}
            {studios.data?.next_cursor && (
              <button
                type="button"
                onClick={() => setCursor(studios.data?.next_cursor ?? undefined)}
              >
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
            <button
              className="platform-primary"
              type="submit"
              aria-busy={mutation.pending || undefined}
            >
              {mutation.pending ? 'Creating…' : 'Create studio'}
            </button>
          </fieldset>
          {mutation.error !== undefined && (
            <p role="alert" className="platform-error">
              {platformMutationErrorMessage(mutation.error)}
            </p>
          )}
        </form>
      </div>
      <div className="platform-section">
        <h2>Invitations</h2>
      </div>
      {invitations.loading && <PlatformLoading label="Checking your invitations…" rows={1} />}
      {invitations.error !== undefined && (
        <PlatformRecovery error={invitations.error} retry={invitations.refresh} />
      )}
      {invitations.data?.items.length === 0 && (
        <p>No pending invitations for your verified email.</p>
      )}
      <ul className="platform-stack" style={undefined}>
        {invitations.data?.items.map(({ invitation, studio_name }) => (
          <li
            className="platform-card platform-pad platform-row platform-between"
            key={invitation.id}
          >
            <div>
              <h3>{studio_name}</h3>
              <p>
                {invitation.role === 'editor' ? 'Editor' : 'Viewer'}. Expires{' '}
                <time dateTime={invitation.expires_at}>
                  {new Date(invitation.expires_at).toLocaleDateString()}
                </time>
                .
              </p>
              <small>Access covers the workspaces explicitly shared with this studio.</small>
            </div>
            <button
              type="button"
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
          </li>
        ))}
      </ul>
    </PlatformFrame>
  );
}

function SelectedStudio({
  studioId,
  view,
}: Readonly<{ studioId: string; view?: string | undefined }>) {
  const access = usePlatformQuery('get_studio_access', { studio_id: studioId }, true, true);
  const [teamNotice, setTeamNotice] = useState('');
  const section: StudioSection = isStudioSection(view) ? view : 'overview';
  const unknownView = view !== undefined && view !== '' && !isStudioSection(view);
  if (access.loading)
    return (
      <PlatformFrame section={section}>
        <PlatformLoading />
      </PlatformFrame>
    );
  if (access.error !== undefined || !access.data)
    return (
      <PlatformFrame section={section}>
        <PlatformRecovery error={access.error} retry={access.refresh} />
      </PlatformFrame>
    );
  const { studio, role } = access.data;
  const canWrite = role !== 'viewer' && studio.status === 'active';
  const context = { id: studio.id, name: studio.name, role };
  return (
    <PlatformFrame studio={context} section={section}>
      {studio.status === 'archived' && (
        <p role="status" className="platform-note">
          This studio is archived. Its identity is retained; new work is unavailable.
        </p>
      )}
      {unknownView && (
        <p role="status" className="platform-note">
          There is no “{view}” section. Showing the overview.
        </p>
      )}
      {section === 'team' ? (
        <StudioTeam
          studio={studio}
          role={role}
          refresh={access.refresh}
          notice={teamNotice}
          onNotice={setTeamNotice}
        />
      ) : section === 'settings' ? (
        <StudioSettings studio={studio} role={role} refresh={access.refresh} />
      ) : section === 'brands' ? (
        <StudioBrands studio={studio} canWrite={canWrite} />
      ) : section === 'calendar' ? (
        <StudioCalendar studio={studio} />
      ) : section === 'approvals' ? (
        <StudioApprovals studio={studio} />
      ) : section === 'tasks' ? (
        <StudioTasks studio={studio} />
      ) : section === 'creators' ? (
        <StudioCreators studio={studio} />
      ) : section === 'reports' ? (
        <StudioReports studio={studio} />
      ) : (
        <StudioOverview studio={studio} canWrite={canWrite} />
      )}
    </PlatformFrame>
  );
}
