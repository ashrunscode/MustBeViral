'use client';

import { Button, Card, Chip, MonoCaps } from '@mustbeviral/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  InMemoryRunPort,
  type RunAttemptState,
  type RunPort,
  type RunPortResult,
  type RunSnapshot,
} from '../../../../../src/features/run/run-port';
import styles from './run-progress.module.css';

const stateChip = {
  queued: { status: 'queued', label: 'Queued' },
  running: { status: 'running', label: 'Running' },
  complete: { status: 'verified', label: 'Complete' },
  failed: { status: 'failed', label: 'Failed' },
  cancelled: { status: 'notes', label: 'Cancelled' },
} as const satisfies Record<
  RunAttemptState,
  { status: 'queued' | 'running' | 'verified' | 'failed' | 'notes'; label: string }
>;

export function RunResultNotice({ result }: Readonly<{ result: RunPortResult | null }>) {
  if (result === null || result.type === 'ok') return null;
  if (result.type === 'not_found') {
    return (
      <div className={styles.runError} role="alert" data-result="not_found">
        Run {result.run_id} was not found.
      </div>
    );
  }
  return (
    <div className={styles.runError} role="alert" data-result="conflict">
      Run state changed to {result.actual_state}. Reload before issuing another command.
    </div>
  );
}

export function RunProgress({
  port: suppliedPort,
  runId = 'run-lumen-0007',
  scenario = 'normal',
  workspace,
}: Readonly<{
  port?: RunPort;
  runId?: string;
  scenario?: 'normal' | 'failed';
  workspace: string;
}>) {
  const [port] = useState(() => suppliedPort ?? new InMemoryRunPort(scenario));
  const initial = port.read(runId);
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(
    initial.type === 'ok' ? initial.snapshot : null,
  );
  const [result, setResult] = useState<RunPortResult | null>(
    initial.type === 'ok' ? null : initial,
  );

  useEffect(() => port.subscribe(setSnapshot), [port]);

  useEffect(() => {
    if (
      snapshot === null ||
      snapshot.state === 'complete' ||
      snapshot.state === 'failed' ||
      snapshot.state === 'cancelled'
    )
      return;
    const timer = window.setTimeout(() => {
      const next = port.advance(snapshot.runId, snapshot.sequence);
      setResult(next.type === 'ok' ? null : next);
      if (next.type === 'ok') setSnapshot(next.snapshot);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [port, snapshot]);

  function cancel() {
    if (snapshot === null) return;
    const next = port.cancel(snapshot.runId, snapshot.sequence);
    setResult(next.type === 'ok' ? null : next);
    if (next.type === 'ok') setSnapshot(next.snapshot);
  }

  if (snapshot === null) {
    return (
      <main id="main-content" className={styles.runPage}>
        <RunResultNotice result={result} />
      </main>
    );
  }

  const completeCount = snapshot.attempts.filter((attempt) => attempt.state === 'complete').length;
  const terminal =
    snapshot.state === 'complete' || snapshot.state === 'failed' || snapshot.state === 'cancelled';
  return (
    <main id="main-content" className={styles.runPage} data-run-state={snapshot.state}>
      <section className={`${styles.quoteStage} quote-stage`} aria-labelledby="run-title">
        <header className={styles.runHead}>
          <div>
            <MonoCaps>
              Run {snapshot.runId} · Rev {snapshot.revision}
            </MonoCaps>
            <h1 id="run-title">Generating the launch pack</h1>
            <p>Completed branches remain reviewable while downstream work continues.</p>
          </div>
          <Chip
            status={
              snapshot.state === 'complete'
                ? 'verified'
                : snapshot.state === 'failed'
                  ? 'failed'
                  : snapshot.state === 'cancelled'
                    ? 'notes'
                    : 'running'
            }
          >
            {snapshot.state === 'reviewable' ? 'Partial completion' : snapshot.state}
          </Chip>
        </header>
        {snapshot.firstReviewable ? (
          <div className={styles.reviewableMoment} role="status" data-first-reviewable="true">
            <span aria-hidden="true">◆</span>
            <span>
              <strong>First reviewable output is ready.</strong> Review can begin without waiting
              for every branch.
            </span>
            <Link href={`/studio/${workspace}/review/compare`}>Review available outputs</Link>
          </div>
        ) : null}
        <RunResultNotice result={result} />
        <div className={styles.attemptList}>
          {snapshot.attempts.map((attempt, index) => {
            const chip = stateChip[attempt.state];
            return (
              <div className={styles.attemptTrack} key={attempt.id}>
                {index > 0 ? (
                  <span
                    className={`${styles.runTransfer} ${attempt.state === 'running' ? 'flow-transfer' : ''}`}
                    aria-hidden="true"
                  />
                ) : null}
                <Card
                  className={styles.attemptCard}
                  feedback={
                    attempt.state === 'failed'
                      ? 'error'
                      : attempt.state === 'complete'
                        ? 'success'
                        : 'default'
                  }
                >
                  {attempt.state === 'running' ? (
                    <span className="filament-sweep" aria-hidden="true" />
                  ) : null}
                  <div className={styles.attemptTopline}>
                    <MonoCaps>{attempt.provider}</MonoCaps>
                    <Chip status={chip.status}>{chip.label}</Chip>
                  </div>
                  <strong>{attempt.node}</strong>
                  <span>{attempt.detail}</span>
                </Card>
              </div>
            );
          })}
        </div>
      </section>
      <aside className={styles.runAside} aria-label="Run progress summary">
        <MonoCaps>Live run</MonoCaps>
        <h2>
          {completeCount} of {snapshot.attempts.length} branches complete
        </h2>
        <div className={styles.progressTrack}>
          <span style={{ width: `${String((completeCount / snapshot.attempts.length) * 100)}%` }} />
        </div>
        <dl>
          <div>
            <dt>Reserved maximum</dt>
            <dd>$4.20</dd>
          </div>
          <div>
            <dt>Partial value</dt>
            <dd>{snapshot.firstReviewable ? 'Retained' : 'Pending'}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{snapshot.revision}</dd>
          </div>
        </dl>
      </aside>
      <div className={styles.runBar}>
        <div>
          <MonoCaps>{terminal ? 'Terminal state' : 'Providers active'}</MonoCaps>
          <strong>{snapshot.state}</strong>
        </div>
        {snapshot.state === 'complete' || snapshot.state === 'failed' ? (
          <Link
            className="mbv-button mbv-button--primary"
            href={`/studio/${workspace}/review/compare`}
          >
            Open output review
          </Link>
        ) : snapshot.state === 'cancelled' ? (
          <span className={styles.cancelledCopy}>
            Run cancelled. Completed outputs were retained.
          </span>
        ) : (
          <Button variant="ghost" onClick={cancel}>
            Cancel run
          </Button>
        )}
      </div>
      <footer className={styles.footer}>
        <MonoCaps>Attempt stream · deterministic fixture · us-east-1</MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
