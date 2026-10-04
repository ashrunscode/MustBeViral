// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReceiptFlow } from '../../../app/(en)/studio/[workspace]/(workflow)/receipt/receipt-flow';
import { InMemoryExportPort, type ExportReadPort } from './export-port';

afterEach(cleanup);

const recorded = new InMemoryExportPort().create({
  expectedRevisionId: '7f3a',
  approvedGroupIds: ['visuals'],
});
if (recorded.type !== 'ok') throw new Error('Expected the complete preview receipt');
const missingTotals = {
  ...recorded,
  receipt: { ...recorded.receipt, quoteMicros: null, actualMicros: null },
};

describe('ReceiptFlow missing totals recovery', () => {
  it('keeps a named receipt heading in the loading status without creating an export', () => {
    const read = vi.fn<ExportReadPort['read']>(() => new Promise(() => undefined));
    const create = vi.fn<ExportReadPort['create']>().mockResolvedValue(recorded);
    render(
      <ReceiptFlow dataMode="worker" readPort={{ read, create }} workspace="workspace-fixture" />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Reading immutable receipt' });
    expect(screen.getByRole('status').contains(heading)).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps long ledger identifiers inside a named scroll region without removing the table', async () => {
    const attemptId = '99999999-9999-4999-8999-999999999999';
    const longReceipt = {
      ...missingTotals,
      receipt: {
        ...missingTotals.receipt,
        revision: '77777777-7777-4777-8777-777777777777',
        lineage: [
          {
            attemptId,
            provider: 'fal',
            providerModelId: 'synthetic/long-model-name-for-ledger-containment',
            routeId: 'synthetic/long-route-name-for-ledger-containment',
            status: 'succeeded' as const,
            capturedMicros: 0n,
          },
        ],
      },
    };
    const read = vi.fn<ExportReadPort['read']>().mockResolvedValue(longReceipt);
    const create = vi.fn<ExportReadPort['create']>().mockResolvedValue(recorded);
    render(
      <ReceiptFlow dataMode="worker" readPort={{ read, create }} workspace="workspace-fixture" />,
    );

    const region = await screen.findByRole('region', { name: 'Receipt charges by attempt' });
    const table = screen.getByRole('table', { name: 'Receipt lineage rows' });
    expect(region.contains(table)).toBe(true);
    expect(table.textContent).toContain(attemptId);
    expect(table.textContent).toContain('synthetic/long-model-name-for-ledger-containment');
    expect(table.textContent).toContain('synthetic/long-route-name-for-ledger-containment');
    expect(read).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('reads totals again without creating an export and replaces the unavailable comparison', async () => {
    const read = vi
      .fn<ExportReadPort['read']>()
      .mockResolvedValueOnce(missingTotals)
      .mockResolvedValueOnce(recorded);
    const create = vi.fn<ExportReadPort['create']>().mockResolvedValue(recorded);
    render(
      <ReceiptFlow dataMode="worker" readPort={{ read, create }} workspace="workspace-fixture" />,
    );

    const check = await screen.findByRole('button', { name: 'Check receipt status' });
    expect(screen.getByText('Settlement unavailable')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Receipt totals' }).textContent).toBe(
      'Quote unavailable, settled amount unavailable. Quote comparison unavailable.',
    );
    fireEvent.click(check);

    expect(await screen.findByText('Quoted $4.20, charged $4.08, $0.12 under quote')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check receipt status' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
    expect(read).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });

  it('offers only another read after a failed status check and recovers without creating an export', async () => {
    const read = vi
      .fn<ExportReadPort['read']>()
      .mockResolvedValueOnce(missingTotals)
      .mockResolvedValueOnce({
        type: 'error',
        message: 'Receipt read unavailable.',
        retryable: true,
      })
      .mockResolvedValueOnce(recorded);
    const create = vi.fn<ExportReadPort['create']>().mockResolvedValue(recorded);
    render(
      <ReceiptFlow dataMode="worker" readPort={{ read, create }} workspace="workspace-fixture" />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Check receipt status' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try reading receipt again' }));

    expect(await screen.findByText('Quoted $4.20, charged $4.08, $0.12 under quote')).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
    expect(read).toHaveBeenCalledTimes(3);
    expect(create).not.toHaveBeenCalled();
  });
});
