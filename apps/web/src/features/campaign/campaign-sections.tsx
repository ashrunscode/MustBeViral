'use client';
import Link from 'next/link';
import { Calendar, SCHEDULE_CONTRACT_MISSING } from '../platform/calendar';
import {
  PlatformEmptySection,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from '../platform/platform-frame';
import { PlatformRequestError } from '../platform/platform-client';
import { campaignHref, isResourceId, studioHref } from '../platform/platform-navigation';
import { useCampaignContext } from '../platform/campaign-context';
import { usePlatformQuery } from '../platform/use-platform-query';

export function CampaignCalendar({ workspace }: Readonly<{ workspace: string }>) {
  const context = useCampaignContext();
  return (
    <>
      <PlatformHeading
        title="Campaign calendar"
        description="When each approved revision of this campaign is due to publish."
      />
      <Calendar
        scope="this campaign"
        items={[]}
        missing={SCHEDULE_CONTRACT_MISSING}
        action={{
          href: campaignHref(workspace, context.run ? 'content' : 'brief', context),
          label: context.run ? 'Open the content step' : 'Open the brief',
        }}
      />
    </>
  );
}

export function CampaignApprovals({ workspace }: Readonly<{ workspace: string }>) {
  const context = useCampaignContext();
  return (
    <>
      <PlatformHeading
        title="Approvals"
        description="Who approved what, and what still waits. Approval never publishes anything."
      />
      {context.run ? (
        <section className="platform-card platform-pad platform-stack" role="status">
          <h2>Approvals for this run happen on the Content step.</h2>
          <p>
            Each piece is approved or sent back with a reason there. The receipt records every
            decision with the brand version it used.
          </p>
          <Link
            className="platform-button platform-primary"
            href={campaignHref(workspace, 'content', context)}
          >
            Open the content step
          </Link>
        </section>
      ) : (
        <PlatformEmptySection
          title="Nothing to approve yet."
          body="Content to approve appears after the budget is confirmed and the run completes."
          missing="Approval policies, delegated approvers and approval history across campaigns arrive with the content contract, which is not registered in this release."
          action={{ href: campaignHref(workspace, 'brief', context), label: 'Open the brief' }}
        />
      )}
    </>
  );
}

export function CampaignCollaborators({
  workspace,
  presentation,
}: Readonly<{ workspace: string; presentation: 'authenticated' | 'preview' }>) {
  const context = useCampaignContext();
  const studioId = isResourceId(context.studio) ? context.studio : undefined;
  const members = usePlatformQuery(
    'list_studio_team',
    { studio_id: studioId ?? '', limit: 50 },
    presentation === 'authenticated' && studioId !== undefined,
  );
  return (
    <>
      <PlatformHeading
        title="Collaborators"
        description="Who can see and act on this campaign. Access follows the studio’s team and the brand’s grants."
      />
      {studioId === undefined ? (
        <PlatformEmptySection
          title="Open this campaign from its brand to see collaborators."
          body="Collaborators are the studio team members who can open this brand. Without a studio in the link, nothing can be listed."
          missing="Per-campaign assignments and reviewers arrive with the collaborator contract, which is not registered in this release."
          action={{ href: studioHref(), label: 'Choose a studio' }}
        />
      ) : members.loading ? (
        <PlatformLoading label="Reading the studio team…" />
      ) : members.error !== undefined ? (
        <PlatformRecovery
          error={members.error ?? new PlatformRequestError('INTERNAL_ERROR', 'Unavailable')}
          retry={members.refresh}
        />
      ) : (
        <section className="platform-card platform-pad platform-stack">
          <h2>Studio team</h2>
          <p className="platform-muted">
            Every active member below can open this brand with their studio role. Per-campaign
            assignments are not registered in this release.
          </p>
          <ul className="platform-list">
            {members.data?.items.map((member) => (
              <li key={member.id} className="platform-row platform-between">
                <span>{member.display_label}</span>
                <span className="platform-tag">
                  {member.role === 'owner'
                    ? 'Owner'
                    : member.role === 'editor'
                      ? 'Editor'
                      : 'Viewer'}
                </span>
              </li>
            ))}
          </ul>
          <Link href={studioHref(studioId, 'team')}>Manage the team</Link>
        </section>
      )}
      <p className="platform-muted">
        <Link href={campaignHref(workspace, 'brief', context)}>Back to the brief</Link>
      </p>
    </>
  );
}
