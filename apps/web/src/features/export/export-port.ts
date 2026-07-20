export type ExportRowState = 'queued' | 'ready' | 'failed';

export interface ExportRow {
  readonly id: string;
  readonly label: string;
  readonly format: string;
  readonly state: ExportRowState;
}

export interface ReceiptLineageRow {
  readonly id: string;
  readonly artifact: string;
  readonly provider: string;
  readonly model: string;
  readonly costMicros: bigint;
}

export interface ImmutableReceipt {
  readonly receiptNumber: string;
  readonly quoteMicros: bigint;
  readonly actualMicros: bigint;
  readonly revision: string;
  readonly issuedAt: string;
  readonly lineage: readonly ReceiptLineageRow[];
}

export type ExportPortResult =
  | { readonly type: 'ok'; readonly rows: readonly ExportRow[]; readonly receipt: ImmutableReceipt }
  | { readonly type: 'review_incomplete'; readonly pending_group_ids: readonly string[] }
  | { readonly type: 'conflict'; readonly actual_revision_id: string };

export interface ExportPort {
  create(
    input: Readonly<{ expectedRevisionId: string; approvedGroupIds: readonly string[] }>,
  ): ExportPortResult;
}

export class InMemoryExportPort implements ExportPort {
  readonly #scenario: ExportPortResult['type'];

  constructor(scenario: ExportPortResult['type'] = 'ok') {
    this.#scenario = scenario;
  }

  create(
    input: Readonly<{ expectedRevisionId: string; approvedGroupIds: readonly string[] }>,
  ): ExportPortResult {
    if (this.#scenario === 'conflict' || input.expectedRevisionId !== '7f3a')
      return { type: 'conflict', actual_revision_id: '81c2' };
    if (this.#scenario === 'review_incomplete' || !input.approvedGroupIds.includes('visuals'))
      return { type: 'review_incomplete', pending_group_ids: ['visuals'] };
    return {
      type: 'ok',
      rows: [
        { id: 'assets', label: '12 visual assets', format: 'PNG + WebP', state: 'ready' },
        { id: 'copy', label: '3 copy sets', format: 'CSV + TXT', state: 'ready' },
        { id: 'motion', label: '1 motion export', format: 'MP4 H.264', state: 'queued' },
        { id: 'manifest', label: 'Lineage manifest', format: 'JSON', state: 'failed' },
      ],
      receipt: {
        receiptNumber: 'MBV-0042-7F3A',
        quoteMicros: 4_200_000n,
        actualMicros: 4_080_000n,
        revision: '7f3a',
        issuedAt: '2026-07-20T18:42:00.000Z',
        lineage: [
          {
            id: 'concept',
            artifact: 'Concept logic',
            provider: 'Moonshot',
            model: 'kimi-2.6',
            costMicros: 1_140_000n,
          },
          {
            id: 'assets',
            artifact: 'Visual assets x3',
            provider: 'fal',
            model: 'flux-2-klein',
            costMicros: 2_340_000n,
          },
          {
            id: 'copy',
            artifact: 'Copy sets x3',
            provider: 'Moonshot',
            model: 'kimi-2.6',
            costMicros: 240_000n,
          },
          {
            id: 'motion',
            artifact: 'Motion 6s',
            provider: 'fal',
            model: 'seedance-1.0',
            costMicros: 360_000n,
          },
        ],
      },
    };
  }
}
