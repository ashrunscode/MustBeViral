'use client';

import {
  Button,
  Card,
  Chip,
  LedgerTable,
  MonoCaps,
  QuotePill,
  formatUsdMicros,
} from '@mustbeviral/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  InMemoryQuotePort,
  WorkerQuotePort,
  canConfirmQuote,
  formatQuoteCountdown,
  quoteIsExpired,
  quoteSecondsRemaining,
  type QuoteConfirmResult,
  type QuotePort,
  type QuoteReadPort,
  type QuoteReadResult,
  type QuotePortScenario,
  type RunQuote,
} from '../../../../../src/features/quote/quote-port';
import { createBrowserCoreClient } from '../../../../../src/lib/core/browser-client';
import { createMutationIdempotencyKey } from '../../../../../src/lib/core/idempotency';
import styles from './quote-flow.module.css';
import { RunProgress } from './run-progress';

export function QuoteResultNotice({
  canvasId,
  onRequote,
  result,
  workspace,
}: Readonly<{
  onRequote?: () => void;
  canvasId?: string;
  result: QuoteConfirmResult | null;
  workspace: string;
}>) {
  if (result === null) return null;
  if (result.type === 'ok') {
    return (
      <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status" data-result="ok">
        <strong>Run confirmed</strong>
        <span>
          Maximum charge {formatUsdMicros(result.acceptedMaximumMicros)} · {result.runId}
        </span>
      </div>
    );
  }
  if (result.type === 'expired_quote') {
    return (
      <div
        className={`${styles.notice} ${styles.noticeExpired}`}
        role="alert"
        data-result="expired_quote"
      >
        <span>
          <strong>Quote expired.</strong> No spend was submitted. Request a fresh named price.
        </span>
        <Button variant="ghost" onClick={onRequote}>
          Re-quote this run
        </Button>
      </div>
    );
  }
  if (result.type === 'cap_exceeded') {
    return (
      <div
        className={`${styles.notice} ${styles.noticeError}`}
        role="alert"
        data-result="cap_exceeded"
      >
        <strong>Spend cap blocked confirmation</strong>
        <span>{result.explanation}</span>
        <MonoCaps>
          Cap {formatUsdMicros(result.capMicros)} · Attempted{' '}
          {formatUsdMicros(result.attemptedMicros)}
        </MonoCaps>
      </div>
    );
  }
  return (
    <div
      className={`${styles.notice} ${styles.noticeConflict}`}
      role="alert"
      data-result="conflict"
    >
      <span>
        <strong>Canvas revision changed.</strong> Expected {result.expected_revision_id}; current is{' '}
        {result.actual_revision_id}.
      </span>
      <Link
        className="mbv-button mbv-button--ghost"
        href={
          canvasId === undefined
            ? `/studio/${workspace}/canvas?state=conflict`
            : `/studio/${workspace}/canvas?canvas=${encodeURIComponent(canvasId)}`
        }
      >
        Open canvas recovery
      </Link>
    </div>
  );
}

function QuoteLoadState({
  canvasId,
  result,
  workspace,
}: Readonly<{
  canvasId?: string;
  result: Exclude<QuoteReadResult, { type: 'ok' }> | null;
  workspace: string;
}>) {
  const message =
    result === null
      ? 'Reading the pinned canvas revision and calculating its named maximum price.'
      : result.type === 'conflict'
        ? `Expected ${result.expected_revision_id}; current is ${result.actual_revision_id}.`
        : result.type === 'graph_invalid'
          ? result.message
          : result.type === 'forbidden'
            ? 'You do not have permission to quote this canvas.'
            : result.type === 'not_found'
              ? `Canvas ${result.canvas_id} was not found.`
              : result.message;
  return (
    <main id="main-content" className={styles.quotePage}>
      <section className={styles.quoteStage} aria-labelledby="quote-title">
        <Card className={styles.quoteCard} feedback={result === null ? 'loading' : 'error'}>
          <MonoCaps className={styles.eyebrow}>Pre-spend quote</MonoCaps>
          <h1 id="quote-title">Review this run before spending</h1>
          <div
            className={`${styles.notice} ${result === null ? '' : styles.noticeError}`}
            role={result === null ? 'status' : 'alert'}
            data-result={result?.type ?? 'loading'}
          >
            <strong>{result === null ? 'Calculating quote' : 'Quote unavailable'}</strong>
            <span>{message}</span>
            {result?.type === 'conflict' ? (
              <Link
                className="mbv-button mbv-button--ghost"
                href={
                  canvasId === undefined
                    ? `/studio/${workspace}/canvas`
                    : `/studio/${workspace}/canvas?canvas=${encodeURIComponent(canvasId)}`
                }
              >
                Open canvas recovery
              </Link>
            ) : null}
          </div>
        </Card>
      </section>
    </main>
  );
}

export function QuoteFlow({
  canvasId,
  dataMode = 'preview',
  initialNowMs,
  port: suppliedPort,
  quotePort: suppliedQuotePort,
  revisionId,
  runScenario = 'normal',
  startInRunStage = false,
  scenario = 'ok',
  workspace,
}: Readonly<{
  initialNowMs?: number;
  canvasId?: string;
  dataMode?: 'preview' | 'worker';
  port?: QuotePort;
  quotePort?: QuoteReadPort;
  revisionId?: string;
  runScenario?: 'normal' | 'failed';
  startInRunStage?: boolean;
  scenario?: QuotePortScenario;
  workspace: string;
}>) {
  const [previewPort] = useState<QuotePort | null>(() =>
    dataMode === 'preview'
      ? (suppliedPort ?? new InMemoryQuotePort({ scenario, nowMs: initialNowMs ?? 0 }))
      : null,
  );
  const [quotePort] = useState<QuoteReadPort | null>(() => {
    if (dataMode === 'preview') return null;
    if (suppliedQuotePort !== undefined) return suppliedQuotePort;
    if (canvasId === undefined || canvasId.length === 0) return null;
    return new WorkerQuotePort(createBrowserCoreClient(), canvasId, revisionId, () =>
      createMutationIdempotencyKey('quote-run'),
    );
  });
  const [quote, setQuote] = useState<RunQuote | null>(
    () => previewPort?.read(initialNowMs) ?? null,
  );
  const [loadResult, setLoadResult] = useState<Exclude<QuoteReadResult, { type: 'ok' }> | null>(
    () =>
      dataMode === 'worker' && quotePort === null
        ? {
            type: 'error',
            message: 'Open this quote from a canvas so Core can pin the expected revision.',
            retryable: false,
          }
        : null,
  );
  const [nowMs, setNowMs] = useState(initialNowMs ?? quote?.createdAtMs ?? 0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<QuoteConfirmResult | null>(null);

  useEffect(() => {
    if (startInRunStage) return;
    let active = true;
    if (quotePort !== null) {
      void quotePort.read().then((next) => {
        if (!active) return;
        if (next.type === 'ok') {
          setQuote(next.quote);
          setNowMs(next.quote.createdAtMs);
          setLoadResult(null);
        } else {
          setLoadResult(next);
        }
      });
    } else if (previewPort !== null && suppliedPort === undefined && initialNowMs === undefined) {
      void previewPort.requote(Date.now()).then((next) => {
        if (!active) return;
        setQuote(next);
        setNowMs(next.createdAtMs);
      });
    }
    return () => {
      active = false;
    };
  }, [initialNowMs, previewPort, quotePort, startInRunStage, suppliedPort]);

  useEffect(() => {
    if (startInRunStage) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startInRunStage]);

  if (startInRunStage) {
    return <RunProgress workspace={workspace} scenario={runScenario} />;
  }

  if (quote === null) {
    return (
      <QuoteLoadState
        {...(canvasId === undefined ? {} : { canvasId })}
        result={loadResult}
        workspace={workspace}
      />
    );
  }

  const secondsRemaining = quoteSecondsRemaining(quote.expiresAtMs, nowMs);
  const expired = quoteIsExpired(quote.expiresAtMs, nowMs) || result?.type === 'expired_quote';
  const confirmEnabled =
    canConfirmQuote({ acknowledged, expiresAtMs: quote.expiresAtMs, nowMs, pending }) &&
    !expired &&
    previewPort !== null;
  const total = formatUsdMicros(quote.totalMicros);
  const feedback = pending
    ? 'loading'
    : result?.type === 'ok'
      ? 'success'
      : result === null
        ? 'default'
        : 'error';

  if (result?.type === 'ok') {
    return <RunProgress workspace={workspace} runId={result.runId} scenario={runScenario} />;
  }

  async function confirmRun() {
    if (!confirmEnabled || quote === null) return;
    setPending(true);
    if (previewPort === null) return;
    const next = await previewPort.confirm({ quote, acknowledged, nowMs });
    setResult(next);
    setPending(false);
  }

  async function requote() {
    setPending(true);
    const next =
      quotePort === null ? await previewPort?.requote(Date.now()) : await quotePort.requote();
    if (next === undefined) {
      setPending(false);
      return;
    }
    if ('type' in next) {
      if (next.type === 'ok') {
        setQuote(next.quote);
        setNowMs(next.quote.createdAtMs);
        setLoadResult(null);
      } else {
        setQuote(null);
        setLoadResult(next);
      }
    } else {
      setQuote(next);
      setNowMs(next.createdAtMs);
    }
    setAcknowledged(false);
    setResult(null);
    setPending(false);
  }

  return (
    <main id="main-content" className={styles.quotePage}>
      <section className={styles.quoteStage} aria-labelledby="quote-title">
        <Card className={styles.quoteCard} feedback={feedback === 'error' ? 'error' : feedback}>
          <MonoCaps className={styles.eyebrow}>Pre-spend quote</MonoCaps>
          <h1 id="quote-title">Review this run before spending</h1>
          <p className={styles.lede}>
            The reservation is pinned to this revision, route, and affected branch.
          </p>

          <QuoteResultNotice
            {...(canvasId === undefined ? {} : { canvasId })}
            result={result}
            workspace={workspace}
            onRequote={() => void requote()}
          />
          {expired && result?.type !== 'expired_quote' ? (
            <QuoteResultNotice
              {...(canvasId === undefined ? {} : { canvasId })}
              result={{ type: 'expired_quote', expiredAtMs: quote.expiresAtMs }}
              workspace={workspace}
              onRequote={() => void requote()}
            />
          ) : null}

          <div className={styles.revisionRow}>
            <QuotePill
              amount={total}
              revision={quote.revision}
              feedback={expired ? 'error' : 'default'}
            />
            <MonoCaps>
              {expired ? 'Expired' : `Expires ${formatQuoteCountdown(secondsRemaining)}`}
            </MonoCaps>
          </div>

          <LedgerTable className={styles.ledger} aria-label="Per-node estimate">
            <thead>
              <tr>
                <th>Node</th>
                <th>Basis</th>
                <th>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.node}</td>
                  <td>{item.basis}</td>
                  <td>{formatUsdMicros(item.amountMicros)}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td>Total</td>
                <td>Maximum charge</td>
                <td data-testid="quote-total">{total}</td>
              </tr>
            </tbody>
          </LedgerTable>

          <div className={styles.impact}>
            <span>
              <span aria-hidden="true">↳</span> rerun affects 4 nodes
            </span>
            <span className={styles.countdown}>
              <MonoCaps>
                {expired ? 'Quote expired' : `Expires ${formatQuoteCountdown(secondsRemaining)}`}
              </MonoCaps>
            </span>
          </div>
          <div className={styles.capsRow}>
            <MonoCaps>
              Run cap {formatUsdMicros(quote.runCapMicros)} · Day cap{' '}
              {formatUsdMicros(quote.workspaceDayCapMicros)} (used{' '}
              {formatUsdMicros(quote.workspaceDayUsedMicros)})
            </MonoCaps>
          </div>
          <label className={styles.acknowledgment} htmlFor="quote-acknowledgment">
            <input
              id="quote-acknowledgment"
              type="checkbox"
              checked={acknowledged}
              disabled={expired || pending}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              I acknowledge this revision and the maximum {total} charge before provider work
              starts.
            </span>
          </label>
          <Link
            className={styles.quietBack}
            href={
              canvasId === undefined
                ? `/studio/${workspace}/canvas`
                : `/studio/${workspace}/canvas?canvas=${encodeURIComponent(canvasId)}`
            }
          >
            Back to canvas
          </Link>
        </Card>
      </section>

      <aside className={styles.sidePanel} aria-labelledby="impact-title">
        <h2 id="impact-title">Run impact</h2>
        <div className={styles.miniGraph} aria-label="Mini graph of affected descendants">
          <span className={styles.miniLine} />
          <span className={styles.miniNode}>
            <MonoCaps>Brief</MonoCaps>
          </span>
          <span className={`${styles.miniNode} ${styles.miniAffected}`}>
            <MonoCaps>Logic</MonoCaps>
          </span>
          <span className={styles.miniNode}>
            <MonoCaps>Pack</MonoCaps>
          </span>
        </div>
        <div className={styles.legend}>
          <span>
            <i className={`${styles.legendSwatch} ${styles.miniAffected}`} />
            Affected descendant
          </span>
          <span>
            <i className={styles.legendSwatch} />
            Retained node
          </span>
        </div>
        <div className={styles.prechecks}>
          <h3>QA pre-checks</h3>
          <div className={styles.checkList}>
            <span>
              Claims boundary <Chip status="verified">Pass</Chip>
            </span>
            <span>
              Asset rights <Chip status="verified">Pass</Chip>
            </span>
            <span>
              Motion safe area <Chip status="running">Pending</Chip>
            </span>
          </div>
        </div>
      </aside>

      <div className={styles.confirmBar}>
        <div className={styles.barRoute}>
          <div>
            <MonoCaps>Pinned revision</MonoCaps>
            <MonoCaps>{quote.revision}</MonoCaps>
          </div>
          <div>
            <MonoCaps>Route</MonoCaps>
            <MonoCaps>{quote.route}</MonoCaps>
          </div>
          <div>
            <MonoCaps>Expires</MonoCaps>
            <MonoCaps>{expired ? 'Expired' : formatQuoteCountdown(secondsRemaining)}</MonoCaps>
          </div>
        </div>
        {expired ? (
          <Button
            feedback={pending ? 'loading' : 'error'}
            loadingLabel="Re-quoting"
            onClick={() => void requote()}
          >
            Re-quote this run
          </Button>
        ) : (
          <Button
            variant="primary"
            feedback={feedback}
            loadingLabel="Confirming quote"
            disabled={!confirmEnabled}
            onClick={() => void confirmRun()}
          >
            Confirm {total} run
          </Button>
        )}
      </div>
      <footer className={styles.footer}>
        <MonoCaps>Quote latency: 142ms · Affected nodes: 4 · Region: us-east-1</MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
