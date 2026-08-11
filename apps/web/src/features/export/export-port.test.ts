import { describe, expect, it } from 'vitest';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import { InMemoryExportPort, WorkerExportPort } from './export-port';

describe('InMemoryExportPort', () => {
  it('returns deterministic export row states and immutable receipt lineage', () => {
    const result = new InMemoryExportPort().create({
      expectedRevisionId: '7f3a',
      approvedGroupIds: ['visuals'],
    });
    expect(result.type).toBe('ok');
    if (result.type !== 'ok') return;
    expect(result.rows.map((row) => row.state)).toEqual(['ready', 'ready', 'queued', 'failed']);
    expect(result.receipt.lineage.map((row) => [row.provider, row.model, row.costMicros])).toEqual([
      ['Moonshot', 'kimi-2.6', 1_140_000n],
      ['fal', 'flux-2-klein', 2_340_000n],
      ['Moonshot', 'kimi-2.6', 240_000n],
      ['fal', 'seedance-1.0', 360_000n],
    ]);
  });

  it.each(['review_incomplete', 'conflict'] as const)('returns the %s branch', (scenario) => {
    const result = new InMemoryExportPort(scenario).create({
      expectedRevisionId: '7f3a',
      approvedGroupIds: ['visuals'],
    });
    expect(result.type).toBe(scenario);
  });
});

describe('WorkerExportPort', () => {
  const timestamp = '2026-08-11T12:00:00.000Z';
  const hash = 'a'.repeat(64);
  const artifact = (kind: 'approved_output' | 'provider_output' | 'export', id: string) => ({
    accessibility_description: kind === 'export' ? null : 'Approved product output.',
    approved_at: kind === 'approved_output' ? timestamp : null,
    approved_by: kind === 'approved_output' ? 'user-live' : null,
    artifact_kind: kind,
    byte_size: kind === 'export' ? 4096 : 2048,
    canvas_revision_id: 'revision-live',
    content_hash: hash,
    created_at: timestamp,
    id,
    mime_type: kind === 'export' ? 'application/zip' : 'image/png',
    object_key: `private/${id}`,
    project_id: 'project-live',
    rights_attestation: {},
    run_id: 'run-live',
    run_node_id: kind === 'export' ? null : 'run-node-live',
    status: 'available',
    updated_at: timestamp,
    workspace_id: 'workspace-live',
  });
  const receipt = (includeExport: boolean) => ({
    run: {
      canvas_id: 'canvas-live',
      canvas_revision_hash: hash,
      canvas_revision_id: 'revision-live',
      confirmed_at: timestamp,
      confirmed_by: 'user-live',
      created_at: timestamp,
      dispatch_epoch: 0,
      dispatch_wave: 1,
      id: 'run-live',
      project_id: 'project-live',
      quote_id: 'quote-live',
      status: 'succeeded',
      updated_at: timestamp,
      workspace_id: 'workspace-live',
    },
    reservation: {
      amount_micros: 4_550_000,
      captured_micros: 672_574,
      created_at: timestamp,
      id: 'reservation-live',
      quote_id: 'quote-live',
      refunded_micros: 0,
      released_micros: 3_877_426,
      run_id: 'run-live',
      status: 'released',
      updated_at: timestamp,
      workspace_id: 'workspace-live',
    },
    ledger: [
      {
        account_code: 'wallet',
        amount_micros: 672_574,
        causative_key: 'capture-live',
        created_at: timestamp,
        direction: 'debit',
        entry_type: 'capture',
        id: 'ledger-live',
        metadata: {
          artifact_id: 'artifact-approved',
          provider_registration_id: 'fal',
          provider_model_id: 'fal/model-live',
        },
        reservation_id: 'reservation-live',
        run_id: 'run-live',
        transaction_id: 'transaction-live',
        workspace_id: 'workspace-live',
      },
    ],
    artifacts: [
      artifact('approved_output', 'artifact-approved'),
      ...(includeExport ? [artifact('export', 'artifact-export')] : []),
    ],
    lineage: [],
  });

  it('exports approved artifacts, re-reads the receipt, and reuses idempotency on replay', async () => {
    const calls: Array<Readonly<{ headers: Headers; method: string; url: string }>> = [];
    let receiptReads = 0;
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-export-0001',
      fetch: async (input, init) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ headers: new Headers(init?.headers), method, url });
        if (url.endsWith('/receipt')) {
          receiptReads += 1;
          return new Response(
            JSON.stringify({
              data: { receipt: receipt(receiptReads > 1) },
              meta: { request_id: 'request-export-0001' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            data: {
              artifact: {
                artifact_id: 'artifact-export',
                project_id: 'project-live',
                run_id: 'run-live',
                canvas_revision_id: 'revision-live',
                artifact_kind: 'export',
                status: 'available',
                object_key: 'private/artifact-export',
                content_hash: hash,
                mime_type: 'application/zip',
                byte_size: 4096,
              },
              replayed: receiptReads > 2,
            },
            meta: { request_id: 'request-export-0001' },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const port = new WorkerExportPort(client, 'run-live', () => 'export-idem-stable');
    await expect(port.create()).resolves.toMatchObject({
      type: 'ok',
      rows: expect.arrayContaining([
        expect.objectContaining({ id: 'artifact-export', state: 'ready' }),
      ]),
      receipt: {
        quoteMicros: 4_550_000n,
        actualMicros: 672_574n,
        lineage: [
          {
            provider: 'fal',
            model: 'fal/model-live',
            costMicros: 672_574n,
          },
        ],
      },
    });
    await port.create();
    expect(
      calls
        .filter(({ method }) => method === 'POST')
        .map(({ headers }) => headers.get('idempotency-key')),
    ).toEqual(['export-idem-stable', 'export-idem-stable']);
  });

  it('stops before export when provider outputs are still unapproved', async () => {
    let exportCalls = 0;
    const pendingReceipt = receipt(false);
    pendingReceipt.artifacts = [artifact('provider_output', 'artifact-pending')];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-export-0002',
      fetch: async (input) => {
        if (!String(input).endsWith('/receipt')) exportCalls += 1;
        return new Response(
          JSON.stringify({
            data: { receipt: pendingReceipt },
            meta: { request_id: 'request-export-0002' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    await expect(
      new WorkerExportPort(client, 'run-live', () => 'export-idem-pending').create(),
    ).resolves.toEqual({
      type: 'review_incomplete',
      pending_group_ids: ['artifact-pending'],
    });
    expect(exportCalls).toBe(0);
  });
});
