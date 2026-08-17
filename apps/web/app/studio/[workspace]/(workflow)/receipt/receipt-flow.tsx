'use client';

import { Button, Card, Chip, LedgerTable, MonoCaps, formatUsdMicros } from '@mustbeviral/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  InMemoryExportPort,
  WorkerExportPort,
  type ExportPort,
  type ExportReadPort,
  type ExportPortResult,
  type ExportRowState,
} from '../../../../../src/features/export/export-port';
import { createBrowserCoreClient } from '../../../../../src/lib/core/browser-client';
import { createMutationIdempotencyKey } from '../../../../../src/lib/core/idempotency';
import styles from './receipt-flow.module.css';

const exportChip = {
  queued: { status: 'queued', label: 'Queued' },
  ready: { status: 'verified', label: 'Ready' },
  failed: { status: 'failed', label: 'Failed' },
} as const satisfies Record<
  ExportRowState,
  { status: 'queued' | 'verified' | 'failed'; label: string }
>;

export function ExportResultNotice({
  result,
  runId,
  workspace,
}: Readonly<{ result: ExportPortResult; runId?: string; workspace: string }>) {
  if (result.type === 'ok') return null;
  if (result.type === 'review_incomplete') {
    return (
      <Card
        className={styles.resultCard}
        feedback="error"
        role="alert"
        data-result="review_incomplete"
      >
        <strong>Review is incomplete</strong>
        <span>
          Approve groups: {result.pending_group_ids.join(', ')} before creating an export.
        </span>
        <Link
          href={
            runId === undefined
              ? `/studio/${workspace}/review`
              : `/studio/${workspace}/review?run=${encodeURIComponent(runId)}`
          }
        >
          Return to named review
        </Link>
      </Card>
    );
  }
  if (result.type === 'conflict') {
    return (
      <Card className={styles.resultCard} feedback="error" role="alert" data-result="conflict">
        <strong>Revision conflict</strong>
        <span>
          The immutable receipt cannot be issued against stale revision{' '}
          {result.expected_revision_id}. Current revision is {result.actual_revision_id}.
        </span>
        <Link href={`/studio/${workspace}/canvas?state=conflict`}>Open canvas recovery</Link>
      </Card>
    );
  }
  const message =
    result.type === 'forbidden'
      ? 'Your session is not permitted to export this run.'
      : result.type === 'not_found'
        ? `Run ${result.run_id} was not found.`
        : result.message;
  return (
    <Card className={styles.resultCard} feedback="error" role="alert" data-result={result.type}>
      <strong>Export unavailable</strong>
      <span>{message}</span>
    </Card>
  );
}

export function ReceiptFlow({
  dataMode = 'preview',
  port: suppliedPort,
  readPort: suppliedReadPort,
  runId,
  scenario = 'ok',
  workspace,
}: Readonly<{
  dataMode?: 'preview' | 'worker';
  port?: ExportPort;
  readPort?: ExportReadPort;
  runId?: string;
  scenario?: 'ok' | 'review_incomplete' | 'conflict';
  workspace: string;
}>) {
  const [previewPort] = useState<ExportPort | null>(() =>
    dataMode === 'preview' ? (suppliedPort ?? new InMemoryExportPort(scenario)) : null,
  );
  const [readPort] = useState<ExportReadPort | null>(() => {
    if (dataMode === 'preview') return null;
    if (suppliedReadPort !== undefined) return suppliedReadPort;
    if (runId === undefined || runId.length === 0) return null;
    return new WorkerExportPort(createBrowserCoreClient(), runId, () =>
      createMutationIdempotencyKey('create-export'),
    );
  });
  const [result, setResult] = useState<ExportPortResult | null>(
    () =>
      previewPort?.create({
        expectedRevisionId: '7f3a',
        approvedGroupIds: ['visuals', 'copy'],
      }) ??
      (readPort === null
        ? {
            type: 'error',
            message: 'Open receipt from a run so Core can create its export.',
            retryable: false,
          }
        : null),
  );

  useEffect(() => {
    if (readPort === null) return;
    let active = true;
    void readPort.create().then((next) => {
      if (active) setResult(next);
    });
    return () => {
      active = false;
    };
  }, [readPort]);

  if (result === null) {
    return (
      <main id="main-content" className={styles.receiptPage}>
        <Card className={styles.resultCard} feedback="loading" role="status" data-result="loading">
          <strong>Creating immutable export</strong>
          <span>Core is assembling approved artifacts and reading the authoritative receipt.</span>
        </Card>
      </main>
    );
  }

  if (result.type !== 'ok') {
    return (
      <main id="main-content" className={styles.receiptPage}>
        <ExportResultNotice
          {...(runId === undefined ? {} : { runId })}
          result={result}
          workspace={workspace}
        />
      </main>
    );
  }

  const { receipt, rows, downloadUrl } = result;
  const varianceMicros =
    receipt.quoteMicros >= receipt.actualMicros ? receipt.quoteMicros - receipt.actualMicros : 0n;
  const issuedDate = receipt.issuedAt.slice(0, 10);
  return (
    <main id="main-content" className={styles.receiptPage}>
      <div className={styles.sealRow}>
        <span className={`${styles.receiptSeal} receipt-seal`}>
          <span aria-hidden="true">◆</span>
          <MonoCaps>Receipt verified</MonoCaps>
        </span>
      </div>
      <article className={`${styles.receiptCard} receipt-card`} aria-labelledby="receipt-title">
        <header className={styles.documentHead}>
          <div>
            <h1 id="receipt-title">
              Receipt · Rev {receipt.revision} · {issuedDate}
            </h1>
            <p>
              {dataMode === 'preview'
                ? 'Lumen Skin / Meta Campaign Launch Pack / Immutable settlement record'
                : `Run ${receipt.receiptNumber} / Immutable settlement record`}
            </p>
          </div>
          <div className={`${styles.receiptNumber} receipt-number`}>
            <MonoCaps>Statement</MonoCaps>
            <strong>{receipt.receiptNumber}</strong>
          </div>
        </header>
        <div className={styles.documentBody}>
          <section aria-labelledby="lineage-title">
            <h2 id="lineage-title" className={styles.sectionLabel}>
              Provider, model, and cost lineage
            </h2>
            <LedgerTable className={styles.ledger} aria-label="Receipt lineage rows">
              <thead>
                <tr>
                  <th>Artifact</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lineage.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No capture-lineage rows were returned for this receipt.</td>
                  </tr>
                ) : null}
                {receipt.lineage.map((row) => (
                  <tr key={row.id} data-lineage-id={row.id}>
                    <td>{row.artifact}</td>
                    <td>{row.provider}</td>
                    <td>{row.model}</td>
                    <td>{formatUsdMicros(row.costMicros)}</td>
                  </tr>
                ))}
                <tr className={styles.totalRow}>
                  <td>Total actual</td>
                  <td>Settled</td>
                  <td>Rev {receipt.revision}</td>
                  <td>{formatUsdMicros(receipt.actualMicros)}</td>
                </tr>
              </tbody>
            </LedgerTable>
          </section>
          <aside className={styles.evidenceColumn} aria-label="Receipt evidence">
            <section className={styles.evidenceBlock}>
              <h2>Quote vs actual</h2>
              <div>
                <span>Named quote</span>
                <strong>{formatUsdMicros(receipt.quoteMicros)}</strong>
              </div>
              <div>
                <span>Actual settled</span>
                <strong>{formatUsdMicros(receipt.actualMicros)}</strong>
              </div>
              <div>
                <span>Under quote</span>
                <strong>{formatUsdMicros(varianceMicros)}</strong>
              </div>
            </section>
            <section className={styles.evidenceBlock}>
              <h2>Immutable record</h2>
              <div>
                <span>Revision</span>
                <strong>{receipt.revision}</strong>
              </div>
              <div>
                <span>Issued</span>
                <strong>{receipt.issuedAt}</strong>
              </div>
              <div>
                <span>Region</span>
                <strong>{dataMode === 'preview' ? 'us-east-1' : 'Core receipt'}</strong>
              </div>
            </section>
          </aside>
        </div>
        <section className={`${styles.exportStatus} export-status`} aria-labelledby="export-title">
          <h2 id="export-title">Export status</h2>
          <div className={styles.exportGrid}>
            {rows.map((row) => {
              const chip = exportChip[row.state];
              return (
                <div
                  className={`${styles.exportRow} export-row`}
                  key={row.id}
                  data-export-state={row.state}
                >
                  <span>
                    <strong>{row.label}</strong>
                    <MonoCaps>{row.format}</MonoCaps>
                  </span>
                  <Chip status={chip.status}>{chip.label}</Chip>
                </div>
              );
            })}
          </div>
        </section>
        <footer className={styles.documentFoot}>
          <MonoCaps>
            {dataMode === 'preview'
              ? 'Immutable · Ledger entry 0042'
              : `Immutable · Run ${receipt.receiptNumber}`}
          </MonoCaps>
          <MonoCaps>
            {dataMode === 'preview'
              ? 'Signer: mbv-ledger-v2 / us-east-1'
              : 'Authority: Supabase ledger / Core Worker'}
          </MonoCaps>
        </footer>
      </article>
      <div className={styles.confirmBar}>
        <div>
          <MonoCaps>Immutable record</MonoCaps>
          <span>
            Quote {formatUsdMicros(receipt.quoteMicros)} · Actual{' '}
            {formatUsdMicros(receipt.actualMicros)} · {formatUsdMicros(varianceMicros)} retained
          </span>
        </div>
        {dataMode === 'worker' && downloadUrl ? (
          <a className="mbv-button mbv-button--primary" href={downloadUrl} download>
            Download pack
          </a>
        ) : (
          <Button disabled={dataMode === 'worker'}>
            {dataMode === 'preview' ? 'Download PDF' : 'Export recorded'}
          </Button>
        )}
      </div>
      <footer className={styles.footer}>
        <MonoCaps>
          {dataMode === 'preview'
            ? 'Ledger read: 22ms · Entry: 0042'
            : `Ledger read · Capture rows: ${String(receipt.lineage.length)}`}
        </MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
