'use client';

import { Button, Card, Chip, LedgerTable, MonoCaps, formatUsdMicros } from '@mustbeviral/ui';
import Link from 'next/link';
import { useState } from 'react';

import {
  InMemoryExportPort,
  type ExportPort,
  type ExportPortResult,
  type ExportRowState,
} from '../../../../../src/features/export/export-port';
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
  workspace,
}: Readonly<{ result: ExportPortResult; workspace: string }>) {
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
        <Link href={`/studio/${workspace}/review`}>Return to named review</Link>
      </Card>
    );
  }
  return (
    <Card className={styles.resultCard} feedback="error" role="alert" data-result="conflict">
      <strong>Revision conflict</strong>
      <span>
        The immutable receipt cannot be issued against stale revision 7f3a. Current revision is{' '}
        {result.actual_revision_id}.
      </span>
      <Link href={`/studio/${workspace}/canvas?state=conflict`}>Open canvas recovery</Link>
    </Card>
  );
}

export function ReceiptFlow({
  port: suppliedPort,
  scenario = 'ok',
  workspace,
}: Readonly<{
  port?: ExportPort;
  scenario?: ExportPortResult['type'];
  workspace: string;
}>) {
  const [port] = useState(() => suppliedPort ?? new InMemoryExportPort(scenario));
  const [result] = useState(() =>
    port.create({ expectedRevisionId: '7f3a', approvedGroupIds: ['visuals', 'copy'] }),
  );

  if (result.type !== 'ok') {
    return (
      <main id="main-content" className={styles.receiptPage}>
        <ExportResultNotice result={result} workspace={workspace} />
      </main>
    );
  }

  const { receipt, rows } = result;
  const varianceMicros = receipt.quoteMicros - receipt.actualMicros;
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
            <h1 id="receipt-title">Receipt · Rev {receipt.revision} · 2026-07-20</h1>
            <p>Lumen Skin / Meta Campaign Launch Pack / Immutable settlement record</p>
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
                <strong>us-east-1</strong>
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
          <MonoCaps>Immutable · Ledger entry 0042</MonoCaps>
          <MonoCaps>Signer: mbv-ledger-v2 / us-east-1</MonoCaps>
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
        <Button>Download PDF</Button>
      </div>
      <footer className={styles.footer}>
        <MonoCaps>Ledger read: 22ms · Entry: 0042</MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
