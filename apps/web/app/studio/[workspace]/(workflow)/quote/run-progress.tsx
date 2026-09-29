'use client';

import { Button, Card, Chip, MonoCaps, formatUsdMicros } from '@mustbeviral/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { SessionExpiredAction } from '../../../../../src/components/session-expired-action';
import {
  InMemoryRunPort,
  WorkerRunPort,
  type RunAttemptState,
  type RunPort,
  type RunReadPort,
  type RunPortResult,
  type RunSnapshot,
} from '../../../../../src/features/run/run-port';
import { createBrowserCoreClient } from '../../../../../src/lib/core/browser-client';
import { createMutationIdempotencyKey } from '../../../../../src/lib/core/idempotency';
import styles from './run-progress.module.css';

const stateChip = {
  queued: { status: 'queued', label: 'Queued' },
  running: { status: 'running', label: 'Running' },
  complete: { status: 'verified', label: 'Complete' },
  failed: { status: 'failed', label: 'Failed' },
  cancelled: { status: 'notes', label: 'Cancelled' },
  skipped: { status: 'notes', label: 'Skipped' },
  reconciliation: { status: 'failed', label: 'Reconciliation' },
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
  if (result.type === 'forbidden') {
    return (
      <div className={styles.runError} role="alert" data-result="forbidden">
        Your session is not permitted to read or change this run.
      </div>
    );
  }
  if (result.type === 'session_expired') {
    return <SessionExpiredAction className={styles.runError} />;
  }
  if (result.type === 'error') {
    return (
      <div className={styles.runError} role="alert" data-result="error">
        {result.message}
      </div>
    );
  }
  return (
    <div className={styles.runError} role="alert" data-result="conflict">
      Run state changed to {result.actual_state}. Reload before issuing another command.
    </div>
  );
}

export function shouldStopRunPolling(
  resultType: RunPortResult['type'] | null,
  snapshotState: RunSnapshot['state'] | null,
): boolean {
  return (
    resultType === 'session_expired' ||
    snapshotState === 'complete' ||
    snapshotState === 'failed' ||
    snapshotState === 'cancelled'
  );
}

export function RunProgress({
  dataMode = 'preview',
  maximumChargeMicros,
  port: suppliedPort,
  readPort: suppliedReadPort,
  runId = 'run-lumen-0007',
  scenario = 'normal',
  workspace,
}: Readonly<{
  port?: RunPort;
  readPort?: RunReadPort;
  dataMode?: 'preview' | 'worker';
  maximumChargeMicros?: bigint;
  runId?: string;
  scenario?: 'normal' | 'failed' | 'reconciliation';
  workspace: string;
}>) {
  const [previewPort] = useState<RunPort | null>(() =>
    dataMode === 'preview' ? (suppliedPort ?? new InMemoryRunPort(scenario)) : null,
  );
  const [readPort] = useState<RunReadPort | null>(() => {
    if (dataMode === 'preview') return null;
    return (
      suppliedReadPort ??
      new WorkerRunPort(createBrowserCoreClient(), () => createMutationIdempotencyKey('cancel-run'))
    );
  });
  const initial = previewPort?.read(runId) ?? null;
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(
    initial?.type === 'ok' ? initial.snapshot : null,
  );
  const [result, setResult] = useState<RunPortResult | null>(
    initial === null || initial.type === 'ok' ? null : initial,
  );

  useEffect(() => previewPort?.subscribe(setSnapshot), [previewPort]);

  useEffect(() => {
    if (
      snapshot === null ||
      snapshot.state === 'complete' ||
      snapshot.state === 'failed' ||
      snapshot.state === 'cancelled' ||
      previewPort === null
    )
      return;
    const timer = window.setTimeout(() => {
      const next = previewPort.advance(snapshot.runId, snapshot.sequence);
      setResult(next.type === 'ok' ? null : next);
      if (next.type === 'ok') setSnapshot(next.snapshot);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [previewPort, snapshot]);

  useEffect(() => {
    if (readPort === null || shouldStopRunPolling(result?.type ?? null, snapshot?.state ?? null))
      return;
    const workerPort = readPort;
    let active = true;
    async function poll() {
      const next = await workerPort.read(runId);
      if (!active) return;
      setResult(next.type === 'ok' ? null : next);
      if (next.type === 'ok') setSnapshot(next.snapshot);
      if (next.type === 'session_expired') {
        active = false;
        window.clearInterval(timer);
      }
    }
    const timer = window.setInterval(() => void poll(), 1_000);
    void poll();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [readPort, result?.type, runId, snapshot?.state]);

  async function cancel() {
    if (snapshot === null) return;
    const next =
      readPort === null
        ? previewPort?.cancel(snapshot.runId, snapshot.sequence)
        : await readPort.cancel(snapshot.runId);
    if (next === undefined) return;
    setResult(next.type === 'ok' ? null : next);
    if (next.type === 'ok') setSnapshot(next.snapshot);
  }

  if (snapshot === null) {
    return (
      <main id="main-content" className={styles.runPage}>
        <RunResultNotice result={result} />
        {result === null ? (
          <div className={styles.runError} role="status" data-result="loading">
            Reading authoritative run progress from Core.
          </div>
        ) : null}
      </main>
    );
  }

  const completeCount = snapshot.attempts.filter((attempt) => attempt.state === 'complete').length;
  const terminal =
    snapshot.state === 'complete' || snapshot.state === 'failed' || snapshot.state === 'cancelled';
  const activityLabel =
    snapshot.state === 'reconciliation_required'
      ? 'Reconciliation pending'
      : terminal
        ? 'Terminal state'
        : 'Providers active';
  const settlement = snapshot.settlement;
  return (
    <main id="main-content" className={styles.runPage} data-run-state={snapshot.state}>
      <section className={`${styles.quoteStage} quote-stage`} aria-labelledby="run-title">
        <header className={styles.runHead}>
          <div>
            <MonoCaps>
              Run {snapshot.runId} · Rev {snapshot.revision}
            </MonoCaps>
            <h1 id="run-title">
              {snapshot.state === 'failed'
                ? 'This launch pack stopped'
                : snapshot.state === 'reconciliation_required'
                  ? 'This launch pack needs verification'
                  : 'Generating the launch pack'}
            </h1>
            <p>
              {snapshot.state === 'failed' || snapshot.state === 'reconciliation_required'
                ? 'Failed branches name what happened, whether spend was accepted, and the safest next step.'
                : 'Completed branches remain reviewable while downstream work continues.'}
            </p>
          </div>
          <Chip
            status={
              snapshot.state === 'complete'
                ? 'verified'
                : snapshot.state === 'failed'
                  ? 'failed'
                  : snapshot.state === 'cancelled'
                    ? 'notes'
                    : snapshot.state === 'reconciliation_required'
                      ? 'failed'
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
            <Link
              href={`/studio/${workspace}/review/compare?run=${encodeURIComponent(snapshot.runId)}`}
            >
              Review available outputs
            </Link>
          </div>
        ) : null}
        {snapshot.recovery !== null ? (
          <div
            className={styles.recoveryMoment}
            role="alert"
            data-recovery={snapshot.recovery.kind}
          >
            <strong>{snapshot.recovery.title}</strong>
            <p>{snapshot.recovery.whatFailed}</p>
            <p data-recovery-settlement="true">
              {settlement === null
                ? snapshot.recovery.spend
                : `Run settlement: ${formatUsdMicros(settlement.capturedMicros)} captured · ${formatUsdMicros(settlement.releasedMicros)} released · ${formatUsdMicros(settlement.refundedMicros)} refunded · ${formatUsdMicros(settlement.pendingMicros)} pending.`}
            </p>
            <p>
              {snapshot.recovery.retained}{' '}
              {snapshot.recovery.retainedRunNodeIds.length > 0
                ? `${String(snapshot.recovery.retainedRunNodeIds.length)} completed branch${snapshot.recovery.retainedRunNodeIds.length === 1 ? ' is' : 'es are'} retained.`
                : 'No completed branch was retained.'}
            </p>
            <p>{snapshot.recovery.nextAction}</p>
            <div className={styles.recoveryActions}>
              <Link href={`/studio/${workspace}/brief`}>Edit campaign brief</Link>
              <Link href={`/studio/${workspace}/receipt?run=${encodeURIComponent(snapshot.runId)}`}>
                Open receipt
              </Link>
            </div>
          </div>
        ) : null}
        <RunResultNotice result={result} />
        <div className={styles.attemptList}>
          {snapshot.attempts.length === 0 ? (
            <Card className={styles.attemptCard}>
              <MonoCaps>Run queued</MonoCaps>
              <strong>Waiting for the first dispatch wave</strong>
              <span>Core has not exposed a runnable node yet.</span>
            </Card>
          ) : null}
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
          <span
            style={{
              width: `${String(snapshot.attempts.length === 0 ? 0 : (completeCount / snapshot.attempts.length) * 100)}%`,
            }}
          />
        </div>
        <dl>
          <div>
            <dt>Reserved maximum</dt>
            <dd>
              {settlement !== null
                ? formatUsdMicros(settlement.reservationMicros)
                : maximumChargeMicros === undefined && dataMode === 'worker'
                  ? 'Pinned quote'
                  : formatUsdMicros(maximumChargeMicros ?? 4_200_000n)}
            </dd>
          </div>
          <div>
            <dt>Captured</dt>
            <dd>{settlement === null ? 'Pending' : formatUsdMicros(settlement.capturedMicros)}</dd>
          </div>
          <div>
            <dt>Released</dt>
            <dd>{settlement === null ? 'Pending' : formatUsdMicros(settlement.releasedMicros)}</dd>
          </div>
          <div>
            <dt>Refunded</dt>
            <dd>{settlement === null ? 'Pending' : formatUsdMicros(settlement.refundedMicros)}</dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd>{settlement === null ? 'Unknown' : formatUsdMicros(settlement.pendingMicros)}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{snapshot.revision}</dd>
          </div>
        </dl>
      </aside>
      <div className={styles.runBar}>
        <div>
          <MonoCaps>{activityLabel}</MonoCaps>
          <strong>{snapshot.state}</strong>
        </div>
        {snapshot.state === 'reconciliation_required' ? (
          <Link
            className="mbv-button mbv-button--primary"
            href={`/studio/${workspace}/receipt?run=${encodeURIComponent(snapshot.runId)}`}
          >
            Open receipt
          </Link>
        ) : snapshot.state === 'failed' && !snapshot.firstReviewable ? (
          <Link className="mbv-button mbv-button--primary" href={`/studio/${workspace}/brief`}>
            Edit campaign brief
          </Link>
        ) : snapshot.state === 'complete' || snapshot.state === 'failed' ? (
          <Link
            className="mbv-button mbv-button--primary"
            href={`/studio/${workspace}/review/compare?run=${encodeURIComponent(snapshot.runId)}`}
          >
            Open output review
          </Link>
        ) : snapshot.state === 'cancelled' ? (
          <span className={styles.cancelledCopy}>
            Run cancelled. Completed outputs were retained.
          </span>
        ) : result?.type === 'session_expired' ? null : (
          <Button variant="ghost" onClick={() => void cancel()}>
            Cancel run
          </Button>
        )}
      </div>
      <footer className={styles.footer}>
        <MonoCaps>
          Attempt stream ·{' '}
          {dataMode === 'preview' ? 'deterministic fixture' : 'authenticated Worker'} · us-east-1
        </MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
