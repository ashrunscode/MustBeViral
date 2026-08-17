'use client';

import { Button, Card, Chip, Drawer, MonoCaps, formatUsdMicros } from '@mustbeviral/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import {
  InMemoryReviewPort,
  WorkerReviewPort,
  type ArtifactGroupReview,
  type ReviewDecision,
  type ReviewPort,
  type ReviewReadPort,
  type ReviewPortResult,
  type ReviewSummary,
  type ReviewVariant,
} from '../../../../../src/features/review/review-port';
import { createBrowserCoreClient } from '../../../../../src/lib/core/browser-client';
import { createMutationIdempotencyKey } from '../../../../../src/lib/core/idempotency';
import styles from './review-flow.module.css';

const decisionChip = {
  pending: { status: 'running', label: 'Pending' },
  approved: { status: 'verified', label: 'Approved' },
  rejected: { status: 'failed', label: 'Rejected' },
} as const satisfies Record<
  ReviewDecision,
  { status: 'running' | 'verified' | 'failed'; label: string }
>;

export function ReviewResultNotice({ result }: Readonly<{ result: ReviewPortResult | null }>) {
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
      {message}
    </div>
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
      {rejecting ? (
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
          {variant.decision !== 'approved' || dataMode === 'preview' ? (
            <Button onClick={() => onDecide(variant, 'rejected')}>
              {rejecting
                ? dataMode === 'preview'
                  ? 'Submit rejection'
                  : 'Save local rejection note'
                : dataMode === 'preview'
                  ? 'Reject'
                  : 'Reject locally'}
            </Button>
          ) : null}
        </div>
        <MonoCaps>{variant.rejectionReason ?? variant.format}</MonoCaps>
      </div>
    </Card>
  );
}

function QaFindings({ preview }: Readonly<{ preview: boolean }>) {
  if (!preview) {
    return (
      <div className={styles.findingList}>
        <div className={styles.drawerSummary}>
          <MonoCaps>No structured QA findings</MonoCaps>
          <br />
          This receipt does not expose a separate QA-note feed.
        </div>
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
  const [summary, setSummary] = useState<ReviewSummary>(() => ({
    quotedMicros: 4_200_000n,
    capturedMicros: 4_200_000n,
    budgetUsedMicros: 18_420_000n,
    budgetCapMicros: 100_000_000n,
    exportReady: true,
    qaNoteCount: 2,
    route: 'kimi + flux + seedance',
  }));
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
            <h1 id="review-title">{mode === 'compare' ? 'Output comparison' : 'Review outputs'}</h1>
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
        <ReviewResultNotice result={result} />
        {loading ? (
          <div className={styles.reviewError} role="status" data-result="loading">
            Reading authoritative artifacts and approvals from Core.
          </div>
        ) : null}
        {!loading && result === null && groups.length === 0 ? (
          <div className={styles.reviewError} role="status" data-result="empty">
            This run has no reviewable provider outputs yet.
          </div>
        ) : null}
        {groups.map((group) => (
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
        <QaFindings preview={dataMode === 'preview'} />
      </aside>
      <Drawer
        className={styles.tabletDrawer}
        open={drawerOpen}
        title="QA findings"
        onClose={() => setDrawerOpen(false)}
      >
        <QaFindings preview={dataMode === 'preview'} />
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
    </main>
  );
}
