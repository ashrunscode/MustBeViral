'use client';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import {
  campaignProgressSnapshot,
  campaignResumeHref,
  subscribeCampaignProgress,
} from '../campaign/campaign-progress';
import { Calendar, SCHEDULE_CONTRACT_MISSING } from './calendar';
import {
  PlatformEmptySection,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import { brandHref, campaignHref } from './platform-navigation';
import { usePlatformQuery } from './use-platform-query';
import { draftIsApprovable, openQuestions, type BrandRecord } from './use-brand-reviews';

interface BrandScope {
  readonly studioId: string;
  readonly brand: BrandRecord;
  readonly canWrite: boolean;
}

function briefHref({ studioId, brand }: Pick<BrandScope, 'studioId' | 'brand'>) {
  return campaignHref(brand.workspace_id, 'brief', { studio: studioId, brand: brand.id });
}

export function BrandOverview({ studioId, brand, canWrite }: Readonly<BrandScope>) {
  const review = usePlatformQuery('get_knowledge_review', {
    workspace_id: brand.workspace_id,
    brand_id: brand.id,
  });
  const data = review.data ?? null;
  const questions = openQuestions(data);
  const approvable = draftIsApprovable(data);
  const findings = brandHref(studioId, brand.workspace_id, brand.id, 'findings');
  const knowledgeNext =
    data === null
      ? null
      : data.record === null
        ? { href: findings, label: 'Capture the first findings' }
        : questions.length > 0
          ? {
              href: findings,
              label: `Answer ${questions.length === 1 ? 'the open question' : `${questions.length} open questions`}`,
            }
          : approvable
            ? { href: findings, label: 'Review and approve this version' }
            : {
                href: brandHref(studioId, brand.workspace_id, brand.id, 'draft'),
                label: 'Open the brand draft',
              };
  return (
    <>
      <PlatformHeading
        title={brand.name}
        description="What this brand knows, what is approved, and the one step that moves it forward."
      >
        {canWrite && brand.status === 'active' ? (
          <Link className="platform-button platform-primary" href={briefHref({ studioId, brand })}>
            Start a campaign brief
          </Link>
        ) : null}
      </PlatformHeading>
      <div className="platform-grid">
        <section
          className="platform-card platform-pad platform-stack"
          aria-labelledby="bo-knowledge"
        >
          <h2 id="bo-knowledge">Brand knowledge</h2>
          {review.loading ? (
            <PlatformLoading label="Reading the brand’s knowledge…" rows={2} />
          ) : review.error !== undefined ? (
            <PlatformRecovery error={review.error} retry={review.refresh} />
          ) : data === null || data.record === null ? (
            <p>
              Nothing captured yet. Capture the website or add facts by hand; every finding keeps
              its source.
            </p>
          ) : (
            <dl className="platform-stack">
              <div className="platform-row platform-between">
                <dt>Approved version</dt>
                <dd>
                  {data.approved_version
                    ? `Version ${data.approved_version.version}`
                    : 'None yet. Campaigns pin an approved version.'}
                </dd>
              </div>
              <div className="platform-row platform-between">
                <dt>Draft</dt>
                <dd>
                  Version {data.record.version}
                  {data.extract_pending ? ', extraction running' : ''}
                  {approvable ? ', ready to approve' : ''}
                </dd>
              </div>
              <div className="platform-row platform-between">
                <dt>Findings</dt>
                <dd>
                  {data.current_assertions.length} confirmed, {data.current_proposals.length}{' '}
                  proposed
                </dd>
              </div>
              <div className="platform-row platform-between">
                <dt>Open questions</dt>
                <dd>{questions.length === 0 ? 'None' : questions.length}</dd>
              </div>
            </dl>
          )}
          {knowledgeNext ? (
            <Link className="platform-button" href={knowledgeNext.href}>
              {knowledgeNext.label}
            </Link>
          ) : null}
        </section>
        <section
          className="platform-card platform-pad platform-stack"
          aria-labelledby="bo-campaigns"
        >
          <h2 id="bo-campaigns">Campaigns</h2>
          <SavedCampaignStep brand={brand} compact />
          <p className="platform-muted">
            A campaign keeps its brand, brief, plan, budget and content in one link. The brief saves
            as you go.
          </p>
          <Link href={brandHref(studioId, brand.workspace_id, brand.id, 'campaigns')}>
            Open campaigns
          </Link>
        </section>
      </div>
      <p className="platform-muted">
        Nothing is scheduled and no channel is connected for this brand: neither is part of this
        release yet, so nothing publishes from here.
      </p>
    </>
  );
}

/** The step this browser last saved for this brand; session only, never a record. */
export function SavedCampaignStep({
  brand,
  compact = false,
}: Readonly<Pick<BrandScope, 'brand'> & { compact?: boolean }>) {
  const saved = useSyncExternalStore(
    subscribeCampaignProgress,
    campaignProgressSnapshot,
    () => null,
  );
  // The saved step must name this brand in this workspace. A step saved without a brand, or for
  // another brand of the same workspace, is not this brand's work and is not shown here.
  const progress =
    saved !== null &&
    saved.workspace === brand.workspace_id &&
    saved.context.brand === brand.id &&
    saved.context.studio !== undefined
      ? saved
      : null;
  if (progress === null) {
    return compact ? <p>No campaign step is saved in this browser.</p> : null;
  }
  // Resume exactly what was saved: the studio, brand, plan, revision and run of that step.
  const href = campaignResumeHref(progress.workspace, progress.step, progress.context);
  return (
    <p>
      This browser paused at <strong>{progress.stepLabel}</strong>.{' '}
      <Link href={href}>Resume {progress.stepLabel.toLowerCase()}</Link>
    </p>
  );
}

export function BrandCampaigns({ studioId, brand, canWrite }: Readonly<BrandScope>) {
  return (
    <>
      <PlatformHeading
        title="Campaigns"
        description="Each campaign moves from brief to plan to budget to content to results, pinned to this brand’s approved knowledge."
      >
        {canWrite && brand.status === 'active' ? (
          <Link className="platform-button platform-primary" href={briefHref({ studioId, brand })}>
            Start a campaign brief
          </Link>
        ) : null}
      </PlatformHeading>
      <section className="platform-card platform-pad platform-stack" role="status">
        <h2>No campaign list yet.</h2>
        <SavedCampaignStep brand={brand} compact />
        <p>
          A campaign is reachable from its own link, which carries the brand, plan and run it
          belongs to.
        </p>
        <p className="platform-muted">
          No command lists a workspace’s campaigns, plans or runs in this release, so nothing is
          listed here. Rows are never invented.
        </p>
      </section>
    </>
  );
}

export function BrandCalendar({ studioId, brand }: Readonly<BrandScope>) {
  return (
    <>
      <PlatformHeading
        title="Calendar"
        description={`Scheduled revisions for ${brand.name}, in the workspace time zone.`}
      />
      <Calendar
        scope={brand.name}
        items={[]}
        missing={SCHEDULE_CONTRACT_MISSING}
        action={{ href: briefHref({ studioId, brand }), label: 'Start a campaign brief' }}
      />
    </>
  );
}

export function BrandAssets({ studioId, brand }: Readonly<BrandScope>) {
  return (
    <>
      <PlatformHeading
        title="Assets"
        description="Original photos, video, logos and documents, with provenance and rights for each file."
      />
      <PlatformEmptySection
        title="No assets yet."
        body="Assets arrive through the brief’s source folder once Drive is connected. Nothing is uploaded from this screen."
        missing="Uploads and Drive connections are not part of this release yet."
        action={{
          href: brandHref(studioId, brand.workspace_id, brand.id, 'findings'),
          label: 'Capture brand findings instead',
        }}
      />
    </>
  );
}

export function BrandChannels({ studioId, brand }: Readonly<BrandScope>) {
  return (
    <>
      <PlatformHeading
        title="Channels"
        description="Connected accounts, their health and the window to reconnect before anything fails."
      />
      <PlatformEmptySection
        title="No channels connected."
        body="Nothing publishes from this brand until an account is connected and a revision is approved."
        missing="Account connections are not part of this release yet."
        action={{
          href: brandHref(studioId, brand.workspace_id, brand.id, 'draft'),
          label: 'Work on the brand draft',
        }}
      />
    </>
  );
}

export function BrandContent({ studioId, brand }: Readonly<BrandScope>) {
  return (
    <>
      <PlatformHeading
        title="Content"
        description="Every revision in one place with its status, approvals and the exact brand version it used."
      />
      <PlatformEmptySection
        title="No content library yet."
        body="Content you review today lives on each campaign’s Content step, with its approvals and receipt."
        missing="A brand-wide list of revisions is not part of this release yet."
        action={{ href: briefHref({ studioId, brand }), label: 'Start a campaign brief' }}
      />
    </>
  );
}

export function BrandInbox({ studioId, brand }: Readonly<BrandScope>) {
  return (
    <>
      <PlatformHeading
        title="Inbox"
        description="Comments and messages from connected accounts, grouped by thread."
      />
      <PlatformEmptySection
        title="No messages."
        body="Messages arrive only from connected channels, and none is connected."
        missing="An inbox and account connections are not part of this release yet."
        action={{
          href: brandHref(studioId, brand.workspace_id, brand.id, 'channels'),
          label: 'About channels',
        }}
      />
    </>
  );
}

export function BrandResults({ studioId, brand }: Readonly<BrandScope>) {
  return (
    <>
      <PlatformHeading
        title="Results"
        description="What performed, what is uncertain, and what to change next."
      />
      <PlatformEmptySection
        title="No results yet."
        body="Nothing has published from this brand. Run receipts, the only measured records today, live on each campaign’s Results step."
        missing="Measurements are not part of this release yet. Unknown numbers are never shown as zero."
        action={{ href: briefHref({ studioId, brand }), label: 'Start a campaign brief' }}
      />
    </>
  );
}
