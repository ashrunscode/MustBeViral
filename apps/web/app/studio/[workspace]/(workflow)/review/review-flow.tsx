'use client';

import { Button, Card, Chip, Drawer, MonoCaps, formatUsdMicros } from '@mustbeviral/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { SessionExpiredAction } from '../../../../../src/components/session-expired-action';
import {
  composeReviewConcepts,
  InMemoryReviewPort,
  WorkerReviewPort,
  type ArtifactGroupReview,
  type ReviewConcept,
  type ReviewDecision,
  type ReviewPlacement,
  type ReviewPort,
  type ReviewReadPort,
  type ReviewPortResult,
  type ReviewQaFinding,
  type ReviewSummary,
  type ReviewVariant,
} from '../../../../../src/features/review/review-port';
import { createBrowserCoreClient } from '../../../../../src/lib/core/browser-client';
import { createMutationIdempotencyKey } from '../../../../../src/lib/core/idempotency';
import { CollaborationSidebar } from '../../../../../src/features/collaboration/collaboration-panel';
import {
  collaborationActorForReviewer,
  commentsForAnchor,
  useCollaborationSession,
} from '../../../../../src/features/collaboration/use-collaboration-session';
import styles from './review-flow.module.css';

const decisionChip = {
  pending: { status: 'running', label: 'Pending' },
  approved: { status: 'verified', label: 'Approved' },
  rejected: { status: 'failed', label: 'Rejected' },
} as const satisfies Record<
  ReviewDecision,
  { status: 'running' | 'verified' | 'failed'; label: string }
>;

export function offersLocalRejectAction(dataMode: 'preview' | 'worker'): boolean {
  return dataMode === 'preview';
}

export function ReviewResultNotice({
  onRetryRead,
  result,
}: Readonly<{ onRetryRead?: () => void; result: ReviewPortResult | null }>) {
  if (result === null || result.type === 'ok') return null;
  if (result.type === 'reason_required') {
    return (
      <div className={styles.reviewError} role="alert" data-result="reason_required">
        A rejection reason is required for {result.variant_id}.
      </div>
    );
  }
  if (result.type === 'conflict') {
    return (
      <div className={styles.reviewError} role="alert" data-result="conflict">
        Review revision changed. Current revision is {result.actual_revision_id}.
      </div>
    );
  }
  if (result.type === 'session_expired') {
    return <SessionExpiredAction className={styles.reviewError} />;
  }
  const message =
    result.type === 'not_found'
      ? `Artifact ${result.artifact_id} was not found.`
      : result.type === 'description_required'
        ? `Artifact ${result.artifact_id} needs an accessibility description before approval.`
        : result.type === 'forbidden'
          ? 'Your session is not permitted to review this run.'
          : result.message;
  return (
    <div className={styles.reviewError} role="alert" data-result={result.type}>
      <span>{message}</span>
      {result.type === 'error' && result.retryable && onRetryRead !== undefined ? (
        <Button variant="ghost" onClick={onRetryRead}>
          Try loading review again
        </Button>
      ) : null}
    </div>
  );
}

export function ReviewRecoveryNotice({
  runId,
  summary,
  workspace,
}: Readonly<{ runId: string | undefined; summary: ReviewSummary; workspace: string }>) {
  if (summary.recovery === null) return null;
  return (
    <div
      className={styles.recoveryBanner}
      role="alert"
      data-review-recovery={summary.recovery.kind}
    >
      <div>
        <MonoCaps>Run recovery</MonoCaps>
        <strong>{summary.recovery.title}</strong>
      </div>
      <p>{summary.recovery.whatFailed}</p>
      <p data-review-settlement="true">
        Run settlement: {formatUsdMicros(summary.authorizedMicros)} authorized ·{' '}
        {formatUsdMicros(summary.capturedMicros)} captured ·{' '}
        {formatUsdMicros(summary.releasedMicros)} released ·{' '}
        {formatUsdMicros(summary.refundedMicros)} refunded · {formatUsdMicros(summary.netMicros)}{' '}
        net · {summary.settlementStatus} · {formatUsdMicros(summary.pendingMicros)} pending.
      </p>
      <p>
        {summary.recovery.retained}{' '}
        {summary.recovery.retainedRunNodeIds.length > 0
          ? `${String(summary.recovery.retainedRunNodeIds.length)} completed branch${summary.recovery.retainedRunNodeIds.length === 1 ? ' is' : 'es are'} available below.`
          : 'No completed branch was retained.'}
      </p>
      <p>{summary.recovery.nextAction}</p>
      <div className={styles.recoveryActions}>
        <Link href={`/studio/${workspace}/brief`}>Edit campaign brief</Link>
        <Link
          href={
            runId === undefined
              ? `/studio/${workspace}/receipt`
              : `/studio/${workspace}/receipt?run=${encodeURIComponent(runId)}`
          }
        >
          Open receipt
        </Link>
      </div>
    </div>
  );
}

function mediaForPlacement(
  concept: ReviewConcept,
  placement: ReviewPlacement,
): ReviewVariant | null {
  if (placement === 'reels') return concept.motion ?? concept.placements['9:16'] ?? concept.master;
  return concept.placements[placement] ?? concept.master;
}

export function ComposedReview({
  campaignName,
  concepts,
  onApprove,
  onDescribe,
  onInspect,
}: Readonly<{
  campaignName: string;
  concepts: readonly ReviewConcept[];
  onApprove: (concept: ReviewConcept) => void;
  onDescribe: (variantId: string, description: string) => void;
  onInspect: (variant: ReviewVariant) => void;
}>) {
  const [selectedId, setSelectedId] = useState(concepts[0]?.id ?? 'concept-1');
  const [placement, setPlacement] = useState<ReviewPlacement>('4:5');
  const [safeZone, setSafeZone] = useState(true);
  const [descriptionDrafts, setDescriptionDrafts] = useState<Readonly<Record<string, string>>>({});
  const concept = concepts.find((candidate) => candidate.id === selectedId) ?? concepts[0];
  if (concept === undefined) return null;
  const media = mediaForPlacement(concept, placement);
  const copy = concept.copy;
  const stageClass =
    placement === '1:1'
      ? styles.phoneSquare
      : placement === '9:16' || placement === 'reels'
        ? styles.phoneStory
        : styles.phoneFeed;
  return (
    <section className={styles.composed} aria-label="Composed review">
      <div className={styles.conceptRail} role="tablist" aria-label="Concepts">
        {concepts.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={styles.conceptTab}
            role="tab"
            aria-selected={candidate.id === concept.id}
            onClick={() => setSelectedId(candidate.id)}
          >
            <MonoCaps>
              Concept {String(candidate.index)} · {candidate.title}
            </MonoCaps>
            <span>{candidate.angle}</span>
          </button>
        ))}
      </div>
      <div className={styles.stageWrap}>
        <div className={styles.placementRow} role="tablist" aria-label="Placement">
          {(['4:5', '1:1', '9:16', 'reels'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={styles.placementTab}
              role="tab"
              aria-selected={placement === option}
              onClick={() => setPlacement(option)}
            >
              {option === 'reels' ? 'Reels' : `Feed ${option}`}
            </button>
          ))}
          <label className={styles.safeToggle}>
            <input
              type="checkbox"
              checked={safeZone}
              onChange={(event) => setSafeZone(event.target.checked)}
            />
            Safe zone
          </label>
        </div>
        <article className={`${styles.phone} ${stageClass}`} id={concept.id}>
          <div className={styles.adHead}>
            <span>{campaignName} · Sponsored</span>
            <MonoCaps>{placement === 'reels' ? 'Reels 9:16' : placement}</MonoCaps>
          </div>
          {copy ? <p className={styles.adPrimary}>{copy.primaryText}</p> : null}
          <div className={styles.adStill}>
            {media?.previewUrl ? (
              media.groupId === 'motion' ? (
                <video
                  className={styles.adMedia}
                  src={media.previewUrl}
                  controls
                  playsInline
                  autoPlay
                  muted
                />
              ) : (
                // Private capability URLs expire; next/image cannot cache or optimize them.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.adMedia}
                  src={media.previewUrl}
                  alt={media.accessibilityDescription ?? concept.title}
                  onClick={() => onInspect(media)}
                />
              )
            ) : (
              <MonoCaps>No private preview for this placement</MonoCaps>
            )}
            {safeZone ? <div className={styles.safeZone} aria-hidden="true" /> : null}
          </div>
          <div className={styles.adFoot}>
            <strong>{copy?.headline ?? concept.title}</strong>
            {copy?.description ? <p>{copy.description}</p> : null}
            <span className={styles.adCta}>Shop now</span>
          </div>
        </article>
        <div className={styles.conceptActions}>
          {concept.decision === 'approved' ? (
            <MonoCaps>Concept approved</MonoCaps>
          ) : (
            <>
              <label className={styles.descriptionField}>
                <span>Accessibility description required before approval</span>
                <textarea
                  value={
                    descriptionDrafts[concept.id] ??
                    concept.members.find((member) => member.accessibilityDescription?.trim())
                      ?.accessibilityDescription ??
                    ''
                  }
                  onChange={(event) => {
                    const next = event.target.value;
                    setDescriptionDrafts((current) => ({ ...current, [concept.id]: next }));
                    for (const member of concept.members) {
                      onDescribe(member.id, next);
                    }
                  }}
                  placeholder="Describe this concept before approval"
                />
              </label>
              <Button variant="primary" onClick={() => onApprove(concept)}>
                Approve this concept
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function ReviewCopyPreview({
  copy,
}: Readonly<{ copy: NonNullable<ReviewVariant['copy']> }>) {
  return (
    <div className={styles.copyPreview}>
      <span className={styles.copyKicker}>Headline</span>
      <strong>{copy.headline}</strong>
      <span className={styles.copyKicker}>Primary text</span>
      <p>{copy.primaryText}</p>
      {copy.description.length > 0 ? (
        <>
          <span className={styles.copyKicker}>Description</span>
          <p>{copy.description}</p>
        </>
      ) : null}
    </div>
  );
}

function VariantCard({
  dataMode,
  index,
  mode,
  onDecide,
  onDescribe,
  onInspect,
  onNavigate,
  register,
  rejecting,
  rejectionReason,
  setRejectionReason,
  variant,
}: Readonly<{
  dataMode: 'preview' | 'worker';
  index: number;
  mode: 'compare' | 'approval';
  onDecide: (variant: ReviewVariant, decision: 'approved' | 'rejected') => void;
  onDescribe: (variantId: string, description: string) => void;
  onInspect: (variant: ReviewVariant) => void;
  onNavigate: (event: KeyboardEvent<HTMLElement>, index: number) => void;
  register: (element: HTMLElement | null, index: number) => void;
  rejecting: boolean;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  variant: ReviewVariant;
}>) {
  const chip = decisionChip[variant.decision];
  return (
    <Card
      className={styles.artifactCard}
      feedback={
        variant.decision === 'rejected'
          ? 'error'
          : variant.decision === 'approved'
            ? 'success'
            : 'default'
      }
      tabIndex={0}
      ref={(element) => register(element, index)}
      onKeyDown={(event) => onNavigate(event, index)}
      data-variant-id={variant.id}
      id={`variant-${variant.id}`}
    >
      <div className={styles.artifactHead}>
        <h2>{variant.label}</h2>
        <Chip status={chip.status}>{chip.label}</Chip>
      </div>
      {mode === 'compare' ? (
        <div className={`${styles.comparePair} compare-pair`}>
          <div className={styles.version}>
            <div
              className={`${styles.thumb} ${dataMode === 'worker' ? styles.workerThumb : ''} ${variant.copy ? styles.thumbCopy : ''}`}
            >
              {dataMode === 'worker' && variant.previewUrl && variant.groupId !== 'copy' ? (
                variant.groupId === 'motion' ? (
                  <video
                    className={styles.media}
                    src={variant.previewUrl}
                    controls
                    playsInline
                    muted
                  />
                ) : (
                  <>
                    {/* Private capability URLs expire; next/image cannot cache or optimize them. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.media}
                      src={variant.previewUrl}
                      alt={variant.accessibilityDescription ?? variant.label}
                      onClick={() => onInspect(variant)}
                    />
                  </>
                )
              ) : dataMode === 'worker' && variant.copy ? (
                <ReviewCopyPreview copy={variant.copy} />
              ) : (
                <MonoCaps>
                  {dataMode === 'preview' ? 'Current output · v2' : 'Artifact · private preview'}
                </MonoCaps>
              )}
            </div>
            <div className={styles.versionCaption}>
              <MonoCaps>{variant.model}</MonoCaps>
              <MonoCaps>{variant.format}</MonoCaps>
            </div>
          </div>
          <div className={styles.version}>
            <div className={`${styles.thumb} ${styles.prior}`}>
              <MonoCaps>
                {variant.hasPrior ? 'Prior pinned · v1' : 'No prior pinned output'}
              </MonoCaps>
            </div>
            <div className={styles.versionCaption}>
              <MonoCaps>Prior</MonoCaps>
              <MonoCaps>{variant.format}</MonoCaps>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`${styles.mobileThumb} ${dataMode === 'worker' ? styles.workerThumb : ''} ${variant.copy ? styles.thumbCopy : ''}`}
        >
          {dataMode === 'worker' && variant.previewUrl && variant.groupId !== 'copy' ? (
            variant.groupId === 'motion' ? (
              <video className={styles.media} src={variant.previewUrl} controls playsInline muted />
            ) : (
              <>
                {/* Private capability URLs expire; next/image cannot cache or optimize them. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.media}
                  src={variant.previewUrl}
                  alt={variant.accessibilityDescription ?? variant.label}
                  onClick={() => onInspect(variant)}
                />
              </>
            )
          ) : dataMode === 'worker' && variant.copy ? (
            <ReviewCopyPreview copy={variant.copy} />
          ) : (
            <MonoCaps>Current v2 · {variant.model}</MonoCaps>
          )}
        </div>
      )}
      {dataMode === 'worker' && variant.decision !== 'approved' ? (
        <label className={styles.descriptionField}>
          <span>Accessibility description required before approval</span>
          <textarea
            value={variant.accessibilityDescription ?? ''}
            onChange={(event) => onDescribe(variant.id, event.target.value)}
            placeholder="Describe this output before approval"
          />
        </label>
      ) : null}
      {offersLocalRejectAction(dataMode) && rejecting ? (
        <label className={styles.rejectionField}>
          <span>Reason for rejection</span>
          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Describe the required correction"
          />
        </label>
      ) : null}
      <div className={styles.cardFoot}>
        <div className={styles.cardActions}>
          {variant.decision === 'approved' ? (
            <MonoCaps>Already approved</MonoCaps>
          ) : (
            <Button onClick={() => onDecide(variant, 'approved')}>Approve</Button>
          )}
          {offersLocalRejectAction(dataMode) ? (
            <Button onClick={() => onDecide(variant, 'rejected')}>
              {rejecting ? 'Submit rejection' : 'Reject'}
            </Button>
          ) : null}
        </div>
        <MonoCaps>{variant.rejectionReason ?? variant.format}</MonoCaps>
      </div>
    </Card>
  );
}

function QaFindings({
  preview,
  findings,
}: Readonly<{ preview: boolean; findings: readonly ReviewQaFinding[] }>) {
  if (!preview) {
    if (findings.length === 0) {
      return (
        <div className={styles.findingList}>
          <div className={styles.drawerSummary}>
            <MonoCaps>No copy QA findings</MonoCaps>
            <br />
            Client copy checks run against parsed headline and primary text. Visual QA is not on
            this receipt.
          </div>
        </div>
      );
    }
    return (
      <div className={styles.findingList}>
        {findings.map((finding) => (
          <article className={styles.finding} key={`${finding.variantId}-${finding.code}`}>
            <MonoCaps>{finding.code.replaceAll('_', ' ')}</MonoCaps>
            <p>{finding.message}</p>
            <a href={`#variant-${finding.variantId}`}>Jump to {finding.label}</a>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.findingList}>
      <article className={styles.finding}>
        <MonoCaps>Contrast issue</MonoCaps>
        <p>Logo visibility on Hero B is below the 4.5:1 target.</p>
        <a href="#hero-b">Jump to Hero B</a>
      </article>
      <article className={styles.finding}>
        <MonoCaps>Legal disclaimer</MonoCaps>
        <p>Required “Results vary” line is missing from Story A.</p>
        <a href="#story-a">Jump to Story A</a>
      </article>
      <div className={styles.drawerSummary}>
        <MonoCaps>Partial value retained</MonoCaps>
        <br />
        Approved artifacts remain verified while pending work is reviewed.
      </div>
    </div>
  );
}

export function ReviewFlow({
  dataMode = 'preview',
  mode = 'approval',
  port: suppliedPort,
  readPort: suppliedReadPort,
  reviewer = 'Maya Chen',
  runId,
  workspace,
}: Readonly<{
  dataMode?: 'preview' | 'worker';
  mode?: 'compare' | 'approval';
  port?: ReviewPort;
  readPort?: ReviewReadPort;
  reviewer?: string;
  runId?: string;
  workspace: string;
}>) {
  const [previewPort] = useState<ReviewPort | null>(() =>
    dataMode === 'preview' ? (suppliedPort ?? new InMemoryReviewPort()) : null,
  );
  const [readPort] = useState<ReviewReadPort | null>(() => {
    if (dataMode === 'preview') return null;
    if (suppliedReadPort !== undefined) return suppliedReadPort;
    if (runId === undefined || runId.length === 0) return null;
    return new WorkerReviewPort(createBrowserCoreClient(), runId, reviewer, () =>
      createMutationIdempotencyKey('approve-artifacts'),
    );
  });
  const [groups, setGroups] = useState<readonly ArtifactGroupReview[]>(
    () => previewPort?.read() ?? [],
  );
  const [summary, setSummary] = useState<ReviewSummary>(() =>
    dataMode === 'worker'
      ? {
          canvasId: null,
          quotedMicros: 0n,
          authorizedMicros: 0n,
          capturedMicros: 0n,
          releasedMicros: 0n,
          refundedMicros: 0n,
          pendingMicros: 0n,
          netMicros: 0n,
          settlementStatus: 'active',
          budgetUsedMicros: 0n,
          budgetCapMicros: 0n,
          exportReady: false,
          qaNoteCount: 0,
          qaFindings: [],
          route: '',
          campaignName: null,
          recovery: null,
        }
      : {
          canvasId: 'preview-canvas',
          quotedMicros: 4_200_000n,
          authorizedMicros: 4_200_000n,
          capturedMicros: 4_200_000n,
          releasedMicros: 0n,
          refundedMicros: 0n,
          pendingMicros: 0n,
          netMicros: 4_200_000n,
          settlementStatus: 'captured',
          budgetUsedMicros: 18_420_000n,
          budgetCapMicros: 100_000_000n,
          exportReady: true,
          qaNoteCount: 2,
          qaFindings: [],
          route: 'kimi + flux + seedance',
          campaignName: null,
          recovery: null,
        },
  );
  const [result, setResult] = useState<ReviewPortResult | null>(() =>
    dataMode === 'worker' && readPort === null
      ? {
          type: 'error',
          message: 'Open review from a run so Core can load its artifacts.',
          retryable: false,
        }
      : null,
  );
  const [loading, setLoading] = useState(dataMode === 'worker' && readPort !== null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [inspected, setInspected] = useState<ReviewVariant | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const variants = groups.flatMap((group) => group.variants);

  useEffect(() => {
    if (readPort === null) return;
    let active = true;
    void readPort.read().then((next) => {
      if (!active) return;
      if (next.type === 'ok') {
        setGroups(next.groups);
        setSummary(next.summary);
        setResult(null);
      } else {
        setResult(next);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [readPort]);

  function describe(variantId: string, description: string) {
    setGroups((current) =>
      current.map((group) => ({
        ...group,
        variants: group.variants.map((variant) =>
          variant.id === variantId
            ? { ...variant, accessibilityDescription: description.trim() || null }
            : variant,
        ),
      })),
    );
    readPort?.describeVariant({ variantId, description });
    previewPort?.describeVariant({ variantId, description });
  }

  async function decide(variant: ReviewVariant, decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && rejectingId !== variant.id) {
      setRejectingId(variant.id);
      setRejectionReason('');
      return;
    }
    const target = readPort ?? previewPort;
    if (target === null) return;
    const next = await target.decideVariant({
      variantId: variant.id,
      decision,
      reason: rejectionReason,
      expectedRevisionId:
        groups.find((group) => group.id === variant.groupId)?.revision ?? 'current revision',
    });
    setResult(next);
    if (next.type === 'ok') {
      setGroups(next.groups);
      setRejectingId(null);
      setRejectionReason('');
    }
  }

  async function approveGroup(group: ArtifactGroupReview) {
    const target = readPort ?? previewPort;
    if (target === null) return;
    const next = await target.approveGroup({
      groupId: group.id,
      reviewer,
      expectedRevisionId: group.revision,
    });
    setResult(next);
    if (next.type === 'ok') setGroups(next.groups);
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>, index: number) {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const next = (index + (forward ? 1 : -1) + variants.length) % variants.length;
    cardRefs.current[next]?.focus();
  }

  const approvedCount = variants.filter((variant) => variant.decision === 'approved').length;
  const concepts =
    dataMode === 'worker' && mode === 'approval' ? composeReviewConcepts(groups) : [];
  const composed = concepts.length > 0;
  const commentAnchorId =
    inspected?.id ?? (composed ? (concepts[0]?.members[0]?.id ?? null) : (variants[0]?.id ?? null));
  const commentAnchorLabel =
    inspected?.label ??
    variants.find((variant) => variant.id === commentAnchorId)?.label ??
    'Review output';
  const collaborationCanvasId =
    summary.canvasId ?? (dataMode === 'preview' ? 'preview-canvas' : null);
  const collaboration = useCollaborationSession({
    canvasId: collaborationCanvasId,
    actor: collaborationActorForReviewer(
      reviewer,
      dataMode === 'preview' ? 'preview' : 'websocket',
    ),
    surface: 'review',
    transport: dataMode === 'preview' ? 'preview' : 'websocket',
  });
  const anchoredComments = commentsForAnchor(collaboration.snapshot, commentAnchorId);

  function submitCollaborationComment(body: string): void {
    if (commentAnchorId === null) return;
    collaboration.upsertComment({
      comment_id: `comment-${commentAnchorId}-${String(Date.now())}`,
      body,
      anchor_node_id: commentAnchorId,
    });
  }

  async function approveConcept(concept: ReviewConcept) {
    if (readPort === null) return;
    const next = await readPort.approveMembers({
      variantIds: concept.members.map((member) => member.id),
      expectedRevisionId: groups[0]?.revision ?? 'current revision',
    });
    setResult(next);
    if (next.type === 'ok') setGroups(next.groups);
  }

  async function retryRead() {
    if (readPort === null) return;
    setLoading(true);
    const next = await readPort.read();
    if (next.type === 'ok') {
      setGroups(next.groups);
      setSummary(next.summary);
      setResult(null);
    } else {
      setResult(next);
    }
    setLoading(false);
  }

  if (result?.type === 'session_expired') {
    return (
      <main id="main-content" className={styles.reviewPage}>
        <section className={styles.reviewStage} aria-label="Session expired">
          <SessionExpiredAction className={styles.reviewError} />
        </section>
      </main>
    );
  }
  return (
    <main
      id="main-content"
      className={`${styles.reviewPage} ${mode === 'compare' ? styles.compareMode : styles.approvalMode}`}
    >
      <section className={styles.reviewStage} aria-labelledby="review-title">
        <div className={styles.desktopBanner}>
          <span>Graph authoring is desktop-only · Continue on desktop</span>
          <span aria-hidden="true">↗</span>
        </div>
        <div className={styles.sectionHeading}>
          <div>
            <MonoCaps>
              Rev {groups[0]?.revision ?? 'pending'} · Reviewer {reviewer}
            </MonoCaps>
            <h1 id="review-title">
              {mode === 'compare'
                ? 'Output comparison'
                : (summary.campaignName ?? 'Review outputs')}
            </h1>
            <p>
              {mode === 'compare'
                ? 'Compare current output to its prior pinned version before approval.'
                : dataMode === 'worker'
                  ? approvedCount === variants.length && variants.length > 0
                    ? `${String(approvedCount)} of ${String(variants.length)} approved. Export the bundle when you are ready.`
                    : `Read each ad. Approve what you would run. ${String(approvedCount)} of ${String(variants.length)} approved.`
                  : 'Named approval is recorded per artifact group.'}
            </p>
          </div>
          <Button className={styles.qaToggle} onClick={() => setDrawerOpen(true)}>
            QA findings
          </Button>
        </div>
        <CollaborationSidebar
          anchorId={commentAnchorId}
          anchorLabel={commentAnchorLabel}
          comments={anchoredComments}
          onSubmitComment={submitCollaborationComment}
          snapshot={collaboration.snapshot}
          status={collaboration.status}
          surface="review"
        />
        <ReviewResultNotice
          result={result}
          {...(groups.length === 0 ? { onRetryRead: () => void retryRead() } : {})}
        />
        <ReviewRecoveryNotice runId={runId} summary={summary} workspace={workspace} />
        {dataMode === 'worker' &&
        !loading &&
        variants.length > 0 &&
        approvedCount === variants.length ? (
          <div className={styles.exportHero} role="status">
            <div>
              <MonoCaps>Pack approved</MonoCaps>
              <p>Every artifact on this receipt is approved. Export is the next step.</p>
            </div>
            <Link
              className="mbv-button mbv-button--primary"
              href={
                runId === undefined
                  ? `/studio/${workspace}/receipt`
                  : `/studio/${workspace}/receipt?run=${encodeURIComponent(runId)}`
              }
            >
              Export approved
            </Link>
          </div>
        ) : null}
        {loading ? (
          <div className={styles.reviewError} role="status" data-result="loading">
            Reading authoritative artifacts and approvals from Core.
          </div>
        ) : null}
        {!loading && result === null && groups.length === 0 ? (
          <div className={styles.reviewError} role="status" data-result="empty">
            <span>This run has no reviewable provider outputs yet.</span>
            <Link href={`/studio/${workspace}/quote`}>Return to quote and run progress</Link>
          </div>
        ) : null}
        {composed ? (
          <ComposedReview
            campaignName={summary.campaignName ?? 'Campaign'}
            concepts={concepts}
            onApprove={(concept) => void approveConcept(concept)}
            onDescribe={describe}
            onInspect={setInspected}
          />
        ) : null}
        {composed
          ? null
          : groups.map((group) => (
              <section
                className={styles.groupSection}
                key={group.id}
                aria-labelledby={`${group.id}-title`}
              >
                <div className={styles.groupHead}>
                  <div>
                    <h2 id={`${group.id}-title`}>{group.name}</h2>
                    <MonoCaps>Reviewer · {group.reviewer}</MonoCaps>
                  </div>
                  <div className={styles.groupApproval}>
                    <Chip status={decisionChip[group.decision].status}>
                      {decisionChip[group.decision].label}
                    </Chip>
                    {group.decision === 'approved' ? null : (
                      <Button variant="primary" onClick={() => void approveGroup(group)}>
                        {dataMode === 'preview' ? 'Approve group as Maya Chen' : 'Approve group'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className={styles.artifactGrid}>
                  {group.variants.map((variant) => {
                    const index = variants.findIndex((candidate) => candidate.id === variant.id);
                    return (
                      <VariantCard
                        key={variant.id}
                        dataMode={dataMode}
                        index={index}
                        mode={mode}
                        variant={variant}
                        rejecting={rejectingId === variant.id}
                        rejectionReason={rejectionReason}
                        setRejectionReason={setRejectionReason}
                        onDecide={(variant, decision) => void decide(variant, decision)}
                        onDescribe={describe}
                        onInspect={setInspected}
                        onNavigate={handleCardKey}
                        register={(element, refIndex) => {
                          cardRefs.current[refIndex] = element;
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
        {mode === 'approval' ? (
          <>
            <section
              className={`${styles.receiptSummary} receipt-summary`}
              aria-labelledby="receipt-summary-title"
            >
              <h2 id="receipt-summary-title">Receipt summary</h2>
              <div>
                <MonoCaps>Run total</MonoCaps>
                <strong>{formatUsdMicros(summary.capturedMicros)}</strong>
              </div>
              <div>
                <MonoCaps>Route</MonoCaps>
                <strong>{summary.route}</strong>
              </div>
              <div>
                <MonoCaps>{dataMode === 'preview' ? 'Budget used' : 'Captured / quoted'}</MonoCaps>
                <strong>
                  {formatUsdMicros(summary.budgetUsedMicros)} /{' '}
                  {formatUsdMicros(summary.budgetCapMicros)}
                </strong>
              </div>
              {dataMode === 'worker' ? (
                <>
                  <div>
                    <MonoCaps>Released / refunded / net</MonoCaps>
                    <strong>
                      {formatUsdMicros(summary.releasedMicros)} /{' '}
                      {formatUsdMicros(summary.refundedMicros)} /{' '}
                      {formatUsdMicros(summary.netMicros)}
                    </strong>
                  </div>
                  <div>
                    <MonoCaps>Settlement / pending</MonoCaps>
                    <strong>
                      {summary.settlementStatus} / {formatUsdMicros(summary.pendingMicros)}
                    </strong>
                  </div>
                </>
              ) : null}
            </section>
            <section
              className={`${styles.exportStatus} export-status`}
              aria-labelledby="mobile-export-title"
            >
              <h2 id="mobile-export-title">Export status</h2>
              <div className={`${styles.exportRow} export-row`}>
                <span>Meta-ready bundle</span>
                <Chip status={summary.exportReady ? 'verified' : 'queued'}>
                  {summary.exportReady ? 'Ready' : 'Pending'}
                </Chip>
              </div>
            </section>
          </>
        ) : null}
      </section>
      <aside className={styles.qaPanel} aria-labelledby="qa-title">
        <h2 id="qa-title">QA findings</h2>
        <p>
          {dataMode === 'preview'
            ? 'Two notes require review. Verified work remains isolated from pending branches.'
            : 'Receipt-backed artifacts remain isolated from local review drafts.'}
        </p>
        <QaFindings preview={dataMode === 'preview'} findings={summary.qaFindings} />
      </aside>
      <Drawer
        className={styles.tabletDrawer}
        open={drawerOpen}
        title="QA findings"
        onClose={() => setDrawerOpen(false)}
      >
        <QaFindings preview={dataMode === 'preview'} findings={summary.qaFindings} />
      </Drawer>
      <div className={styles.confirmBar}>
        <div>
          <MonoCaps>Batch approval</MonoCaps>
          <strong>
            {approvedCount} / {variants.length} approved
          </strong>
        </div>
        <div className={styles.confirmActions}>
          {mode === 'compare' ? (
            <Link
              className="mbv-button mbv-button--primary"
              href={
                runId === undefined
                  ? `/studio/${workspace}/review`
                  : `/studio/${workspace}/review?run=${encodeURIComponent(runId)}`
              }
            >
              Continue named review
            </Link>
          ) : (
            <Link
              className="mbv-button mbv-button--primary"
              href={
                runId === undefined
                  ? `/studio/${workspace}/receipt`
                  : `/studio/${workspace}/receipt?run=${encodeURIComponent(runId)}`
              }
            >
              Export approved
            </Link>
          )}
        </div>
      </div>
      <footer className={styles.footer}>
        <MonoCaps>
          Artifacts: {variants.length} · QA notes: {summary.qaNoteCount} · Quote:{' '}
          {formatUsdMicros(summary.quotedMicros)}
        </MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
      {inspected !== null && dataMode === 'worker' ? (
        <div
          className={styles.inspectOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={inspected.label}
          onClick={() => setInspected(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setInspected(null);
          }}
        >
          <div className={styles.inspectStage} onClick={(event) => event.stopPropagation()}>
            <div className={styles.inspectHead}>
              <strong>{inspected.label}</strong>
              <Button onClick={() => setInspected(null)}>Close</Button>
            </div>
            {inspected.previewUrl && inspected.groupId !== 'copy' ? (
              inspected.groupId === 'motion' ? (
                <video
                  className={styles.inspectMedia}
                  src={inspected.previewUrl}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                // Private capability URLs expire; next/image cannot cache or optimize them.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.inspectMedia}
                  src={inspected.previewUrl}
                  alt={inspected.accessibilityDescription ?? inspected.label}
                />
              )
            ) : inspected.copy ? (
              <ReviewCopyPreview copy={inspected.copy} />
            ) : (
              <MonoCaps>No private preview</MonoCaps>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
