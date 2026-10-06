'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { Calendar, SCHEDULE_CONTRACT_MISSING } from './calendar';
import {
  PlatformEmptySection,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import { brandHref, studioHref } from './platform-navigation';
import { platformMutationErrorMessage } from './platform-client';
import { usePlatformMutation } from './platform-mutation';
import { usePlatformQuery } from './use-platform-query';
import {
  BRAND_REVIEW_LIMIT,
  draftIsApprovable,
  openQuestions,
  useBrandReviews,
  type BrandRecord,
  type BrandReview,
} from './use-brand-reviews';

type Studio = PlatformOutput<'get_studio'>['record'];

export function BrandCard({
  brand,
  studioId,
  status,
}: Readonly<{ brand: BrandRecord; studioId: string; status?: string | undefined }>) {
  return (
    <article className="platform-card">
      <div className="platform-brand-mark" aria-hidden="true">
        {brand.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="platform-pad platform-stack">
        <div className="platform-row platform-between">
          <h3>{brand.name}</h3>
          <span className="platform-tag">
            {brand.status === 'archived' ? 'Archived' : (status ?? 'Active brand')}
          </span>
        </div>
        <Link className="platform-button" href={brandHref(studioId, brand.workspace_id, brand.id)}>
          Open {brand.name}
        </Link>
      </div>
    </article>
  );
}

export function NewBrandForm({ studioId }: Readonly<{ studioId: string }>) {
  const [newSlug] = useState(() => `brand-${crypto.randomUUID()}`);
  const [created, setCreated] = useState(false);
  const mutation = usePlatformMutation();
  const router = useRouter();
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (created) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    // The slug is an identity, not a guess about another workspace with the same name.
    const result = await mutation.mutate('start_brand_draft', {
      studio_id: studioId,
      name,
      slug: newSlug,
    });
    if (result) {
      setCreated(true);
      router.push(brandHref(studioId, result.brand.workspace_id, result.brand.id, 'draft'));
    }
  }
  return (
    <form
      className="platform-card platform-pad platform-stack"
      id="new-brand"
      onSubmit={(e) => void create(e)}
    >
      <h2>Start with the essentials.</h2>
      <p>A new brand gets its own workspace. The draft is saved the moment you create it.</p>
      <fieldset disabled={mutation.pending || created}>
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
        <button
          className="platform-primary"
          type="submit"
          aria-busy={mutation.pending || undefined}
        >
          {mutation.pending
            ? 'Saving your new brand…'
            : created
              ? 'Opening your new brand…'
              : 'Create brand draft'}
        </button>
      </fieldset>
      {mutation.error !== undefined && (
        <p role="alert" className="platform-error">
          {platformMutationErrorMessage(mutation.error)}
        </p>
      )}
    </form>
  );
}

interface AttentionItem {
  readonly key: string;
  readonly kind: 'decision' | 'question' | 'draft' | 'invitation';
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly action: string;
}

/** Names the subset that was read when the studio has more brands than one pass covers. */
function readScope(count: number): string {
  return count === 1 ? 'the first brand' : `the first ${count} brands`;
}

/** Brands whose knowledge could not be read. Their questions and approvals are not counted. */
function BrandReadFailures({
  studioId,
  failures,
  retry,
}: Readonly<{ studioId: string; failures: readonly BrandReview[]; retry: () => void }>) {
  if (failures.length === 0) return null;
  return (
    <section className="platform-card platform-pad platform-stack" role="alert">
      <h2>
        {failures.length === 1
          ? 'One brand could not be read.'
          : `${failures.length} brands could not be read.`}
      </h2>
      <p>
        Their open questions and approvals are not counted on this page. Nothing changed. Try again,
        or open the brand directly.
      </p>
      <ul className="platform-attention" role="list">
        {failures.map(({ brand }) => (
          <li key={brand.id}>
            <div className="platform-attention__text">
              <strong>{brand.name}</strong>
            </div>
            <Link
              className="platform-button"
              href={brandHref(studioId, brand.workspace_id, brand.id)}
            >
              Open brand
            </Link>
          </li>
        ))}
      </ul>
      <div className="platform-row">
        <button type="button" className="platform-primary" onClick={retry}>
          Try again
        </button>
      </div>
    </section>
  );
}

function attentionItems(
  studioId: string,
  reviews: readonly BrandReview[] | undefined,
  invitations: PlatformOutput<'list_my_invitations'>['items'] | undefined,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const { brand, review, error } of reviews ?? []) {
    if (brand.status === 'archived') continue;
    const findings = brandHref(studioId, brand.workspace_id, brand.id, 'findings');
    if (error !== undefined) {
      items.push({
        key: `${brand.id}:unavailable`,
        kind: 'decision',
        title: `${brand.name}: findings could not be read`,
        detail: 'Open the brand to retry. Nothing was changed.',
        href: findings,
        action: 'Open findings',
      });
      continue;
    }
    const questions = openQuestions(review);
    if (questions.length > 0) {
      items.push({
        key: `${brand.id}:questions`,
        kind: 'question',
        title: `${brand.name}: ${questions.length} ${questions.length === 1 ? 'question needs' : 'questions need'} an answer`,
        detail: questions[0]?.prompt ?? '',
        href: findings,
        action: 'Answer',
      });
    }
    if (draftIsApprovable(review)) {
      items.push({
        key: `${brand.id}:approve`,
        kind: 'decision',
        title: `${brand.name}: a brand version is ready to approve`,
        detail: review?.approved_version
          ? `Approved version ${review.approved_version.version} is current until you approve the new draft.`
          : 'Nothing is approved for this brand yet. Campaigns pin an approved version.',
        href: findings,
        action: 'Review and approve',
      });
    }
    if (review !== null && review.record === null) {
      items.push({
        key: `${brand.id}:draft`,
        kind: 'draft',
        title: `${brand.name}: no knowledge draft yet`,
        detail: 'Capture the website or add facts by hand to start the brand’s knowledge.',
        href: findings,
        action: 'Start findings',
      });
    }
  }
  for (const { invitation, studio_name } of invitations ?? []) {
    items.push({
      key: `invitation:${invitation.id}`,
      kind: 'invitation',
      title: `Invitation to ${studio_name}`,
      detail: `Role ${invitation.role === 'editor' ? 'editor' : 'viewer'}. Accept it from your studios list.`,
      href: studioHref(),
      action: 'Open your studios',
    });
  }
  return items;
}

/** Brand, knowledge-review, and invitation reads. An error is settled; unset data is not success. */
function overviewReadsPending(
  brands: { loading: boolean; data: unknown; error: unknown },
  invitations: { loading: boolean; data: unknown; error: unknown },
  reviewing: boolean,
  reviews: unknown,
): boolean {
  if (brands.loading || invitations.loading) return true;
  if (invitations.data === undefined && invitations.error === undefined) return true;
  // useBrandReviews stays undefined, with loading false, until the brand list exists.
  if (brands.error !== undefined) return false;
  if (brands.data === undefined) return true;
  return reviewing || reviews === undefined;
}

export function StudioOverview({
  studio,
  canWrite,
}: Readonly<{ studio: Studio; canWrite: boolean }>) {
  return <StudioOverviewForStudio key={studio.id} studio={studio} canWrite={canWrite} />;
}

function StudioOverviewForStudio({
  studio,
  canWrite,
}: Readonly<{ studio: Studio; canWrite: boolean }>) {
  const brands = usePlatformQuery('list_studio_brands', { studio_id: studio.id, limit: 20 });
  const invitations = usePlatformQuery('list_my_invitations', {});
  const { reviews, loading: reviewing, truncated } = useBrandReviews(brands.data?.items);
  const pending = overviewReadsPending(brands, invitations, reviewing, reviews);
  // The first settled pass paints the sections below the decision card. A later refresh of this
  // same mounted studio hides stale query data without unmounting the new-brand form. The studio
  // key above discards that pass, the draft, and the creation slug together.
  const [lowerReady, setLowerReady] = useState(false);
  if (!pending && !lowerReady) setLowerReady(true);
  const items = attentionItems(studio.id, reviews, invitations.data?.items);
  const invitationsFailed = invitations.error !== undefined;
  const approvable = (reviews ?? []).filter((entry) => draftIsApprovable(entry.review)).length;
  const unread = (reviews ?? []).filter((entry) => entry.error !== undefined).length;
  // A studio with more brands than one pass reads gets statements about the brands read, never
  // about the studio as a whole.
  const inspected = Math.min(brands.data?.items.length ?? 0, BRAND_REVIEW_LIMIT);
  const partial = truncated || Boolean(brands.data?.next_cursor);
  return (
    <>
      <PlatformHeading
        title="Studio overview"
        description="What needs a decision across this studio, then the brands themselves."
      >
        {canWrite ? (
          lowerReady ? (
            <Link
              className="platform-button platform-primary platform-heading-action"
              href="#new-brand"
            >
              Add a brand
            </Link>
          ) : (
            <button
              type="button"
              className="platform-button platform-primary platform-heading-action"
              disabled
            >
              Add a brand
            </button>
          )
        ) : null}
      </PlatformHeading>
      <section className="platform-card platform-pad platform-stack" aria-labelledby="attention">
        <div className="platform-row platform-between">
          <h2 id="attention">Needs a decision</h2>
          {partial ? (
            <span className="platform-muted">
              Only {readScope(inspected)} were read. Open Brands for the rest.
            </span>
          ) : null}
        </div>
        {pending ? (
          <PlatformLoading label="Reading what is open across your brands…" rows={2} />
        ) : brands.error !== undefined ? (
          <PlatformRecovery error={brands.error} retry={brands.refresh} />
        ) : items.length === 0 ? (
          invitationsFailed ? null : (
            <p>
              {partial
                ? `Nothing needs a decision in ${readScope(inspected)}. `
                : 'Nothing needs a decision right now. '}
              {brands.data?.items.length === 0
                ? 'Add a brand to begin.'
                : 'Open a brand to capture sources or start a campaign brief.'}
            </p>
          )
        ) : (
          <ol className="platform-attention" role="list">
            {items.map((item) => (
              <li key={item.key}>
                <div className="platform-attention__text">
                  <span
                    className={`platform-status ${item.kind === 'question' || item.kind === 'decision' ? 'platform-status--attention' : ''}`}
                  >
                    {item.kind === 'question'
                      ? 'Open question'
                      : item.kind === 'decision'
                        ? 'Needs a decision'
                        : item.kind === 'invitation'
                          ? 'Invitation'
                          : 'Not started'}
                  </span>
                  <strong>{item.title}</strong>
                  <span className="platform-muted">{item.detail}</span>
                </div>
                <Link className="platform-button" href={item.href}>
                  {item.action}
                </Link>
              </li>
            ))}
          </ol>
        )}
        {invitationsFailed && !invitations.loading ? (
          <PlatformRecovery error={invitations.error} retry={invitations.refresh} />
        ) : null}
      </section>
      {lowerReady ? (
        <>
          <section
            className="platform-card platform-pad platform-stack platform-overview-approvals"
            aria-labelledby="approvals-now"
          >
            <div className="platform-row platform-between">
              <h2 id="approvals-now">
                {brands.loading || reviewing
                  ? 'Checking approvals…'
                  : brands.error !== undefined || reviews === undefined
                    ? 'Approvals could not be read'
                    : unread > 0
                      ? `${approvable} ready to approve, ${unread} ${unread === 1 ? 'brand' : 'brands'} not read`
                      : partial
                        ? `${approvable} ready to approve in ${readScope(inspected)}`
                        : `${approvable} brand ${approvable === 1 ? 'version' : 'versions'} ready to approve`}
              </h2>
              <Link href={studioHref(studio.id, 'approvals')}>Open approvals</Link>
            </div>
            <p className="platform-muted">
              Approving pins the exact draft campaigns will use. Nothing is scheduled and no channel
              is connected: neither is part of this release yet.
            </p>
          </section>
          <div className="platform-section">
            <h2>Your brands</h2>
            <Link href={studioHref(studio.id, 'brands')}>All brands and search</Link>
          </div>
          {brands.loading ? <PlatformLoading label="Finding your brands…" /> : null}
          {brands.data?.items.length === 0 ? (
            <div className="platform-card platform-pad platform-stack">
              <h3>Make room for your first brand.</h3>
              <p>
                {canWrite
                  ? 'Start with a name. Add the website and details as you go.'
                  : 'A workspace owner needs to share a brand with this studio.'}
              </p>
            </div>
          ) : null}
          <div className="platform-grid platform-grid--three">
            {brands.data?.items.slice(0, 6).map((brand) => {
              const entry = reviews?.find((candidate) => candidate.brand.id === brand.id);
              const status =
                entry?.review?.approved_version !== null &&
                entry?.review?.approved_version !== undefined
                  ? `Approved version ${entry.review.approved_version.version}`
                  : entry?.review?.record
                    ? 'Draft in review'
                    : undefined;
              return (
                <BrandCard key={brand.id} brand={brand} studioId={studio.id} status={status} />
              );
            })}
          </div>
          {canWrite ? (
            <div className="platform-section">
              <NewBrandForm studioId={studio.id} />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function StudioBrands({
  studio,
  canWrite,
}: Readonly<{ studio: Studio; canWrite: boolean }>) {
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [archives, setArchives] = useState(false);
  const brands = usePlatformQuery(
    'list_studio_brands',
    {
      studio_id: studio.id,
      search,
      limit: 20,
      include_archived: archives,
      ...(cursor ? { cursor } : {}),
    },
    true,
    true,
  );
  const count = brands.data?.items.length;
  return (
    <>
      <PlatformHeading
        title="Brands"
        description="Each brand keeps its own voice, original assets and approvals. Switching never touches another account."
      >
        {canWrite ? (
          <Link
            className="platform-button platform-primary platform-heading-action"
            href="#new-brand"
          >
            Add a brand
          </Link>
        ) : null}
      </PlatformHeading>
      <div className="platform-row" style={undefined}>
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
      <p className="platform-muted" role="status" aria-live="polite">
        {brands.loading
          ? 'Finding brands…'
          : count === undefined
            ? ''
            : `${count} ${count === 1 ? 'brand' : 'brands'}${search ? ` match “${search}”` : ' on this page'}.`}
      </p>
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
                ? 'Start with a name. Add the website and details as you go.'
                : 'A workspace owner needs to share a brand with this studio.'}
          </p>
        </div>
      )}
      <div className="platform-grid platform-grid--three">
        {brands.data?.items.map((brand) => (
          <BrandCard key={brand.id} brand={brand} studioId={studio.id} />
        ))}
      </div>
      <div className="platform-section">
        <div className="platform-row">
          {cursor && (
            <button type="button" onClick={() => setCursor(undefined)}>
              First page
            </button>
          )}
          {brands.data?.next_cursor && (
            <button type="button" onClick={() => setCursor(brands.data?.next_cursor ?? undefined)}>
              More brands
            </button>
          )}
        </div>
      </div>
      {canWrite ? <NewBrandForm studioId={studio.id} /> : null}
    </>
  );
}

export function StudioApprovals({ studio }: Readonly<{ studio: Studio }>) {
  const brands = usePlatformQuery('list_studio_brands', { studio_id: studio.id, limit: 20 });
  const { reviews, loading, truncated, refresh } = useBrandReviews(brands.data?.items);
  const ready = (reviews ?? []).filter((entry) => draftIsApprovable(entry.review));
  const failed = (reviews ?? []).filter((entry) => entry.error !== undefined);
  const inspected = Math.min(brands.data?.items.length ?? 0, BRAND_REVIEW_LIMIT);
  const partial = truncated || Boolean(brands.data?.next_cursor);
  const waiting = (reviews ?? []).filter(
    (entry) =>
      !draftIsApprovable(entry.review) &&
      entry.review?.record !== null &&
      entry.review !== null &&
      entry.error === undefined,
  );
  return (
    <>
      <PlatformHeading
        title="Approvals"
        description="Brand versions waiting for a decision. Approving pins the exact draft, with its hash, that campaigns reuse."
      />
      {brands.loading || loading ? <PlatformLoading label="Reading each brand’s draft…" /> : null}
      {brands.error !== undefined ? (
        <PlatformRecovery error={brands.error} retry={brands.refresh} />
      ) : null}
      {partial ? (
        <p className="platform-note" role="status">
          Only {readScope(inspected)} were read. Brands beyond them are not counted here; open them
          directly.
        </p>
      ) : null}
      <BrandReadFailures studioId={studio.id} failures={failed} retry={refresh} />
      {reviews && ready.length === 0 && failed.length === 0 && !loading ? (
        <PlatformEmptySection
          title={
            partial
              ? `No brand version is waiting for approval in ${readScope(inspected)}.`
              : 'No brand version is waiting for approval.'
          }
          body="A version becomes approvable once its draft has findings, no open questions and no pending extraction."
          missing="Content approvals happen on each campaign’s Content step. A studio-wide list of them is not part of this release yet."
          action={{ href: studioHref(studio.id, 'brands'), label: 'Open a brand' }}
        />
      ) : null}
      {ready.length > 0 ? (
        <ol className="platform-attention platform-card platform-pad" role="list">
          {ready.map(({ brand, review }) => (
            <li key={brand.id}>
              <div className="platform-attention__text">
                <span className="platform-status platform-status--attention">Ready to approve</span>
                <strong>{brand.name}</strong>
                <span className="platform-muted">
                  Draft version {review?.record?.version}
                  {review?.approved_version
                    ? `, replaces approved version ${review.approved_version.version}`
                    : ', first approval'}
                  . {review?.current_assertions.length ?? 0} findings,{' '}
                  {review?.current_proposals.length ?? 0} proposals.
                </span>
              </div>
              <Link
                className="platform-button platform-primary"
                href={brandHref(studio.id, brand.workspace_id, brand.id, 'findings')}
              >
                Review and approve {brand.name}
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      {waiting.length > 0 ? (
        <>
          <div className="platform-section">
            <h2>Not ready yet</h2>
          </div>
          <ul className="platform-attention platform-card platform-pad" role="list">
            {waiting.map(({ brand, review }) => {
              const questions = openQuestions(review).length;
              const reason = review?.extract_pending
                ? 'Extraction is still running.'
                : questions > 0
                  ? `${questions} open ${questions === 1 ? 'question' : 'questions'}.`
                  : review?.approved_version?.draft_hash === review?.draft_hash
                    ? `Approved version ${review?.approved_version?.version} already matches the draft.`
                    : 'No findings captured yet.';
              return (
                <li key={brand.id}>
                  <div className="platform-attention__text">
                    <strong>{brand.name}</strong>
                    <span className="platform-muted">{reason}</span>
                  </div>
                  <Link
                    className="platform-button"
                    href={brandHref(studio.id, brand.workspace_id, brand.id, 'findings')}
                  >
                    Open findings
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </>
  );
}

export function StudioTasks({ studio }: Readonly<{ studio: Studio }>) {
  const brands = usePlatformQuery('list_studio_brands', { studio_id: studio.id, limit: 20 });
  const invitations = usePlatformQuery('list_my_invitations', {});
  const { reviews, loading, truncated, refresh } = useBrandReviews(brands.data?.items);
  const questions = (reviews ?? []).flatMap(({ brand, review }) =>
    openQuestions(review).map((question) => ({ brand, question })),
  );
  const failed = (reviews ?? []).filter((entry) => entry.error !== undefined);
  const inspected = Math.min(brands.data?.items.length ?? 0, BRAND_REVIEW_LIMIT);
  const partial = truncated || Boolean(brands.data?.next_cursor);
  const busy = brands.loading || loading || invitations.loading;
  const empty =
    !busy &&
    brands.error === undefined &&
    invitations.error === undefined &&
    failed.length === 0 &&
    questions.length === 0 &&
    (invitations.data?.items.length ?? 0) === 0;
  return (
    <>
      <PlatformHeading
        title="Tasks"
        description="Open questions a brand is waiting on, and invitations waiting on you."
      />
      {busy ? <PlatformLoading label="Collecting open questions…" /> : null}
      {brands.error !== undefined ? (
        <PlatformRecovery error={brands.error} retry={brands.refresh} />
      ) : null}
      {invitations.error !== undefined ? (
        <PlatformRecovery error={invitations.error} retry={invitations.refresh} />
      ) : null}
      <BrandReadFailures studioId={studio.id} failures={failed} retry={refresh} />
      {partial ? (
        <p className="platform-note" role="status">
          Only {readScope(inspected)} were read. Brands beyond them are not counted here; open them
          directly.
        </p>
      ) : null}
      {empty ? (
        <PlatformEmptySection
          title={partial ? `No open tasks in ${readScope(inspected)}.` : 'No open tasks.'}
          body={
            partial
              ? `Every question in ${readScope(inspected)} is answered and no invitation is waiting.`
              : 'Every brand question is answered and no invitation is waiting.'
          }
          missing="Assignments and reminders are not part of this release yet."
          action={{ href: studioHref(studio.id, 'brands'), label: 'Open a brand' }}
        />
      ) : null}
      {questions.length > 0 ? (
        <ol className="platform-attention platform-card platform-pad" role="list">
          {questions.map(({ brand, question }) => (
            <li key={question.id}>
              <div className="platform-attention__text">
                <span className="platform-status platform-status--attention">Open question</span>
                <strong>{brand.name}</strong>
                <span>{question.prompt}</span>
              </div>
              <Link
                className="platform-button"
                href={brandHref(studio.id, brand.workspace_id, brand.id, 'findings')}
              >
                Answer
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      {(invitations.data?.items.length ?? 0) > 0 ? (
        <>
          <div className="platform-section">
            <h2>Invitations</h2>
          </div>
          <ul className="platform-attention platform-card platform-pad" role="list">
            {invitations.data?.items.map(({ invitation, studio_name }) => (
              <li key={invitation.id}>
                <div className="platform-attention__text">
                  <strong>{studio_name}</strong>
                  <span className="platform-muted">
                    {invitation.role === 'editor' ? 'Editor' : 'Viewer'}, expires{' '}
                    {new Date(invitation.expires_at).toLocaleDateString()}
                  </span>
                </div>
                <Link className="platform-button" href={studioHref()}>
                  Accept from your studios
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

export function StudioCalendar({ studio }: Readonly<{ studio: Studio }>) {
  return (
    <>
      <PlatformHeading
        title="Calendar"
        description="Scheduled revisions across every brand in this studio."
      />
      <Calendar
        scope={studio.name}
        items={[]}
        missing={SCHEDULE_CONTRACT_MISSING}
        action={{ href: studioHref(studio.id, 'brands'), label: 'Open a brand' }}
      />
    </>
  );
}

export function StudioCreators({ studio }: Readonly<{ studio: Studio }>) {
  return (
    <>
      <PlatformHeading
        title="Creators and partners"
        description="People and brands you work with, with the evidence for each fit."
      />
      <PlatformEmptySection
        title="No creators or partners yet."
        body="Creator discovery, outreach and partnership agreements are later roadmap waves."
        missing="Creator and partner lists are not part of this release yet."
        action={{ href: studioHref(studio.id, 'brands'), label: 'Back to brands' }}
      />
    </>
  );
}

export function StudioReports({ studio }: Readonly<{ studio: Studio }>) {
  return (
    <>
      <PlatformHeading
        title="Reports"
        description="What performed, what is uncertain, and what to change next."
      />
      <PlatformEmptySection
        title="No results to report."
        body="Nothing has published, so there are no metrics. The only measured records are run receipts, which live on each campaign’s results page."
        missing="Reports and measurements are not part of this release yet. Unknown numbers are never shown as zero."
        action={{ href: studioHref(studio.id, 'brands'), label: 'Open a brand' }}
      />
    </>
  );
}
