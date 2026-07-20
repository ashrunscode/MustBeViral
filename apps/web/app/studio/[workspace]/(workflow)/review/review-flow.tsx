'use client';

import { Button, Card, Chip, Drawer, MonoCaps } from '@mustbeviral/ui';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';

import {
  InMemoryReviewPort,
  type ArtifactGroupReview,
  type ReviewDecision,
  type ReviewPort,
  type ReviewPortResult,
  type ReviewVariant,
} from '../../../../../src/features/review/review-port';
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
  return (
    <div className={styles.reviewError} role="alert" data-result="not_found">
      Artifact {result.artifact_id} was not found.
    </div>
  );
}

function VariantCard({
  index,
  mode,
  onDecide,
  onNavigate,
  register,
  rejecting,
  rejectionReason,
  setRejectionReason,
  variant,
}: Readonly<{
  index: number;
  mode: 'compare' | 'approval';
  onDecide: (variant: ReviewVariant, decision: 'approved' | 'rejected') => void;
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
            <div className={styles.thumb}>
              <MonoCaps>Current output · v2</MonoCaps>
            </div>
            <div className={styles.versionCaption}>
              <MonoCaps>{variant.model}</MonoCaps>
              <MonoCaps>{variant.format}</MonoCaps>
            </div>
          </div>
          <div className={styles.version}>
            <div className={`${styles.thumb} ${styles.prior}`}>
              <MonoCaps>Prior pinned · v1</MonoCaps>
            </div>
            <div className={styles.versionCaption}>
              <MonoCaps>Prior</MonoCaps>
              <MonoCaps>{variant.format}</MonoCaps>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.mobileThumb}>
          <MonoCaps>Current v2 · {variant.model}</MonoCaps>
        </div>
      )}
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
          <Button onClick={() => onDecide(variant, 'approved')}>Approve</Button>
          <Button onClick={() => onDecide(variant, 'rejected')}>
            {rejecting ? 'Submit rejection' : 'Reject'}
          </Button>
        </div>
        <MonoCaps>{variant.rejectionReason ?? variant.format}</MonoCaps>
      </div>
    </Card>
  );
}

function QaFindings() {
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
  mode = 'approval',
  port: suppliedPort,
  workspace,
}: Readonly<{ mode?: 'compare' | 'approval'; port?: ReviewPort; workspace: string }>) {
  const [port] = useState(() => suppliedPort ?? new InMemoryReviewPort());
  const [groups, setGroups] = useState<readonly ArtifactGroupReview[]>(() => port.read());
  const [result, setResult] = useState<ReviewPortResult | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const variants = groups.flatMap((group) => group.variants);

  function decide(variant: ReviewVariant, decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && rejectingId !== variant.id) {
      setRejectingId(variant.id);
      setRejectionReason('');
      return;
    }
    const next = port.decideVariant({
      variantId: variant.id,
      decision,
      reason: rejectionReason,
      expectedRevisionId: '7f3a',
    });
    setResult(next);
    if (next.type === 'ok') {
      setGroups(next.groups);
      setRejectingId(null);
      setRejectionReason('');
    }
  }

  function approveGroup(group: ArtifactGroupReview) {
    const next = port.approveGroup({
      groupId: group.id,
      reviewer: 'Maya Chen',
      expectedRevisionId: '7f3a',
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
            <MonoCaps>Rev 7f3a · Reviewer Maya Chen</MonoCaps>
            <h1 id="review-title">{mode === 'compare' ? 'Output comparison' : 'Review outputs'}</h1>
            <p>
              {mode === 'compare'
                ? 'Compare current output to its prior pinned version before approval.'
                : 'Named approval is recorded per artifact group.'}
            </p>
          </div>
          <Button className={styles.qaToggle} onClick={() => setDrawerOpen(true)}>
            QA findings
          </Button>
        </div>
        <ReviewResultNotice result={result} />
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
                <Button variant="primary" onClick={() => approveGroup(group)}>
                  Approve group as Maya Chen
                </Button>
              </div>
            </div>
            <div className={styles.artifactGrid}>
              {group.variants.map((variant) => {
                const index = variants.findIndex((candidate) => candidate.id === variant.id);
                return (
                  <VariantCard
                    key={variant.id}
                    index={index}
                    mode={mode}
                    variant={variant}
                    rejecting={rejectingId === variant.id}
                    rejectionReason={rejectionReason}
                    setRejectionReason={setRejectionReason}
                    onDecide={decide}
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
                <strong>$4.20</strong>
              </div>
              <div>
                <MonoCaps>Route</MonoCaps>
                <strong>kimi + flux + seedance</strong>
              </div>
              <div>
                <MonoCaps>Budget used</MonoCaps>
                <strong>$18.42 / $100.00</strong>
              </div>
            </section>
            <section
              className={`${styles.exportStatus} export-status`}
              aria-labelledby="mobile-export-title"
            >
              <h2 id="mobile-export-title">Export status</h2>
              <div className={`${styles.exportRow} export-row`}>
                <span>Meta-ready bundle</span>
                <Chip status="verified">Ready</Chip>
              </div>
            </section>
          </>
        ) : null}
      </section>
      <aside className={styles.qaPanel} aria-labelledby="qa-title">
        <h2 id="qa-title">QA findings</h2>
        <p>Two notes require review. Verified work remains isolated from pending branches.</p>
        <QaFindings />
      </aside>
      <Drawer
        className={styles.tabletDrawer}
        open={drawerOpen}
        title="QA findings"
        onClose={() => setDrawerOpen(false)}
      >
        <QaFindings />
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
            <Link className="mbv-button mbv-button--primary" href={`/studio/${workspace}/review`}>
              Continue named review
            </Link>
          ) : (
            <Link className="mbv-button mbv-button--primary" href={`/studio/${workspace}/receipt`}>
              Export approved
            </Link>
          )}
        </div>
      </div>
      <footer className={styles.footer}>
        <MonoCaps>Artifacts: {variants.length} · QA notes: 2 · Quote: $4.20</MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
