'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { PlatformHeading, PlatformLoading, PlatformRecovery } from './platform-frame';
import { platformMutationErrorMessage, PlatformRequestError } from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { usePlatformMutation } from './platform-mutation';

export function StudioTeam({
  studio,
  role,
  refresh,
  notice,
  onNotice,
}: Readonly<{
  studio: PlatformOutput<'get_studio'>['record'];
  role: string;
  refresh: () => void;
  notice: string;
  onNotice: (message: string) => void;
}>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const [memberCursor, setMemberCursor] = useState<string | undefined>();
  const [inviteCursor, setInviteCursor] = useState<string | undefined>();
  const members = usePlatformQuery(
    'list_studio_team',
    { studio_id: studio.id, limit: 20, ...(memberCursor ? { cursor: memberCursor } : {}) },
    role === 'owner',
  );
  const invitations = usePlatformQuery(
    'list_studio_invitations',
    { studio_id: studio.id, limit: 20, ...(inviteCursor ? { cursor: inviteCursor } : {}) },
    role === 'owner',
  );
  const mutation = usePlatformMutation();
  if (role !== 'owner')
    return (
      <PlatformRecovery error={new PlatformRequestError('FORBIDDEN', 'Owner access required')} />
    );
  function changed(message: string) {
    onNotice(message);
    members.refresh();
    invitations.refresh();
    refresh();
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = await mutation.mutate('create_studio_invitation', {
      studio_id: studio.id,
      expected_version: studio.version,
      recipient_email: String(values.get('email')).trim().toLowerCase(),
      role: values.get('role') === 'editor' ? 'editor' : 'viewer',
    });
    if (result) {
      form.reset();
      changed(
        'Invitation saved. The recipient can accept it after signing in with that verified email.',
      );
    }
  }
  return (
    <>
      <PlatformHeading
        title="Your studio team."
        description="Invite the people who work across this studio’s shared brands."
      />
      <div className="platform-note">
        Editors can update brand details and locations where the workspace grant permits it. Viewers
        can read shared brand context. These roles do not authorize billing, provider spending or
        publication.
      </div>
      <div className="platform-section">
        <h2>Invite a teammate</h2>
      </div>
      <form className="platform-card platform-pad platform-stack" onSubmit={(e) => void invite(e)}>
        <fieldset disabled={mutation.pending || studio.status !== 'active'}>
          <div className="platform-row">
            <label className="platform-inline-input">
              Verified email
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
            <label>
              Studio role
              <select name="role" defaultValue="viewer">
                <option value="viewer">Viewer — shared brand context</option>
                <option value="editor">Editor — permitted brand edits</option>
              </select>
            </label>
            <button className="platform-primary" type="submit">
              {mutation.pending ? 'Saving…' : 'Save invitation'}
            </button>
          </div>
        </fieldset>
        <small>This saves an in-app invitation for seven days. No email is sent.</small>
      </form>
      {notice && (
        <p className="platform-note" role="status">
          {notice}
        </p>
      )}
      {mutation.error !== undefined && (
        <div role="alert" className="platform-note platform-error">
          {platformMutationErrorMessage(mutation.error)}{' '}
          <button onClick={refresh}>Refresh team</button>
        </div>
      )}
      <div className="platform-section">
        <h2>Members</h2>
      </div>
      {members.loading && <PlatformLoading label="Loading team members…" />}
      {members.error !== undefined && (
        <PlatformRecovery error={members.error} retry={members.refresh} />
      )}
      <div className="platform-stack">
        {members.data?.items.map((member) => (
          <article key={member.id} className="platform-card platform-pad platform-stack">
            <div className="platform-row platform-between">
              <div>
                <h3>{member.display_label}</h3>
                <small>{member.role === 'owner' ? 'Studio owner' : 'Studio teammate'}</small>
              </div>
              <span className="platform-tag">{member.role}</span>
            </div>
            {member.role !== 'owner' && (
              <div className="platform-row">
                <button
                  disabled={mutation.pending || studio.status !== 'active'}
                  onClick={() => {
                    void mutation
                      .mutate('set_studio_member', {
                        studio_id: studio.id,
                        user_id: member.user_id,
                        role: member.role === 'editor' ? 'viewer' : 'editor',
                        expected_version: studio.version,
                      })
                      .then((result) => {
                        if (result) changed('Role updated.');
                      });
                  }}
                >
                  Change to {member.role === 'editor' ? 'viewer' : 'editor'}
                </button>
                <button
                  disabled={mutation.pending || studio.status !== 'active'}
                  onClick={() => {
                    void mutation
                      .mutate('revoke_studio_member', {
                        studio_id: studio.id,
                        user_id: member.user_id,
                        expected_version: studio.version,
                      })
                      .then((result) => {
                        if (result) changed('Studio access revoked.');
                      });
                  }}
                >
                  Revoke access
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="platform-row">
        {memberCursor && <button onClick={() => setMemberCursor(undefined)}>First members</button>}
        {members.data?.next_cursor && (
          <button onClick={() => setMemberCursor(members.data?.next_cursor ?? undefined)}>
            More members
          </button>
        )}
      </div>
      <div className="platform-section">
        <h2>Invitations</h2>
      </div>
      {invitations.loading && <PlatformLoading label="Loading invitations…" />}
      {invitations.error !== undefined && (
        <PlatformRecovery error={invitations.error} retry={invitations.refresh} />
      )}
      {invitations.data?.items.length === 0 && <p>No invitations yet.</p>}
      <div className="platform-stack">
        {invitations.data?.items.map((invitation) => (
          <article
            key={invitation.id}
            className="platform-card platform-pad platform-row platform-between"
          >
            <div>
              <h3>{invitation.recipient_email}</h3>
              <p>
                {invitation.role} ·{' '}
                {invitation.status === 'pending' && new Date(invitation.expires_at).getTime() <= now
                  ? 'expired'
                  : invitation.status}
              </p>
              <small>Expires {new Date(invitation.expires_at).toLocaleString()}</small>
            </div>
            {invitation.status === 'pending' && (
              <button
                disabled={mutation.pending || studio.status !== 'active'}
                onClick={() => {
                  void mutation
                    .mutate('revoke_studio_invitation', {
                      studio_id: studio.id,
                      invitation_id: invitation.id,
                      expected_version: invitation.version,
                    })
                    .then((result) => {
                      if (result) changed('Invitation revoked.');
                    });
                }}
              >
                Revoke invitation
              </button>
            )}
          </article>
        ))}
      </div>
      <div className="platform-row">
        {inviteCursor && (
          <button onClick={() => setInviteCursor(undefined)}>First invitations</button>
        )}
        {invitations.data?.next_cursor && (
          <button onClick={() => setInviteCursor(invitations.data?.next_cursor ?? undefined)}>
            More invitations
          </button>
        )}
      </div>
    </>
  );
}
