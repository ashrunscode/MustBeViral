import { describe, expect, it, vi } from 'vitest';
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
    expect(
      result.receipt.lineage.map((row) => [row.provider, row.providerModelId, row.capturedMicros]),
    ).toEqual([
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
    artifact_kind: kind,
    byte_size: kind === 'export' ? 4096 : 2048,
    canvas_revision_id: 'revision-live',
    content_hash: hash,
    created_at: timestamp,
    id,
    mime_type: kind === 'export' ? 'application/zip' : 'image/png',
    project_id: 'project-live',
    run_id: 'run-live',
    run_node_id: kind === 'export' ? null : 'run-node-live',
    status: 'available',
    updated_at: timestamp,
  });
  const downloadableArtifact = (id: string) => ({
    ...artifact('export', id),
    approved_by: null,
    object_key: `private/${id}`,
    rights_attestation: {},
    workspace_id: 'workspace-live',
  });
  const receipt = (includeExport: boolean) => ({
    run: {
      canvas_id: 'canvas-live',
      canvas_revision_hash: hash,
      canvas_revision_id: 'revision-live',
      confirmed_at: timestamp,
      created_at: timestamp,
      dispatch_wave: 1,
      id: 'run-live',
      project_id: 'project-live',
      quote_id: 'quote-live',
      status: 'succeeded',
      updated_at: timestamp,
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
    },
    ledger: [
      {
        account_code: 'wallet',
        amount_micros: 672_574,
        created_at: timestamp,
        direction: 'debit',
        entry_type: 'capture',
        id: 'ledger-live',
        reservation_id: 'reservation-live',
        run_id: 'run-live',
        transaction_id: 'transaction-live',
      },
    ],
    artifacts: [
      artifact('approved_output', 'artifact-approved'),
      ...(includeExport ? [artifact('export', 'artifact-export')] : []),
    ],
    lineage: [],
    provider_jobs: [
      {
        attempt_id: 'attempt-live',
        provider: 'fal',
        provider_model_id: 'fal/model-live',
        route_id: 'fal/model-live-route',
        status: 'succeeded',
        captured_micros: '672574',
      },
    ],
  });

  it('reads without mutation and gives each proven explicit create or rebuild a fresh key', async () => {
    const calls: Array<Readonly<{ headers: Headers; method: string; url: string }>> = [];
    let exportCreated = false;
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-export-0001',
      fetch: async (input, init) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ headers: new Headers(init?.headers), method, url });
        if (url.endsWith('/receipt')) {
          return new Response(
            JSON.stringify({
              data: { receipt: receipt(exportCreated) },
              meta: { request_id: 'request-export-0001' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.includes('/artifacts/artifact-export')) {
          return new Response(
            JSON.stringify({
              data: {
                artifact: downloadableArtifact('artifact-export'),
                access: {
                  url: 'https://core.example.test/v1/artifacts/artifact-export/content?token=download',
                  expires_at: timestamp,
                  purpose: 'customer_download',
                },
                copy: null,
              },
              meta: { request_id: 'request-export-0001' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        exportCreated = true;
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
              replayed: false,
            },
            meta: { request_id: 'request-export-0001' },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const createIdempotencyKey = vi
      .fn<() => string>()
      .mockReturnValueOnce('export-idem-create')
      .mockReturnValueOnce('export-idem-rebuild');
    const port = new WorkerExportPort(client, 'run-live', createIdempotencyKey);
    await expect(port.read()).resolves.toMatchObject({ type: 'export_required' });
    expect(calls.filter(({ method }) => method === 'POST')).toHaveLength(0);
    expect(createIdempotencyKey).not.toHaveBeenCalled();

    await expect(port.create()).resolves.toMatchObject({
      type: 'ok',
      exportArtifactId: 'artifact-export',
      rows: expect.arrayContaining([
        expect.objectContaining({ id: 'artifact-export', state: 'ready' }),
      ]),
      receipt: {
        quoteMicros: 4_550_000n,
        actualMicros: 672_574n,
        lineage: [
          {
            attemptId: 'attempt-live',
            provider: 'fal',
            providerModelId: 'fal/model-live',
            routeId: 'fal/model-live-route',
            status: 'succeeded',
            capturedMicros: 672_574n,
          },
        ],
      },
    });
    await port.create();
    expect(
      calls
        .filter(({ method }) => method === 'POST')
        .map(({ headers }) => headers.get('idempotency-key')),
    ).toEqual(['export-idem-create', 'export-idem-rebuild']);
    expect(createIdempotencyKey).toHaveBeenCalledTimes(2);
  });

  it('does not replay create_export after reauthentication or a read-only remount', async () => {
    let exportCreated = false;
    let exportCalls = 0;
    const idempotencyKeys: Array<string | null> = [];
    const createIdempotencyKey = vi.fn(() => 'export-idem-session');
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-export-session',
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith('/receipt')) {
          return new Response(
            JSON.stringify({
              data: { receipt: receipt(exportCreated) },
              meta: { request_id: 'request-export-session' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        exportCalls += 1;
        idempotencyKeys.push(new Headers(init?.headers).get('idempotency-key'));
        if (exportCalls === 1) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'UNAUTHENTICATED',
                message: 'The bearer session expired.',
                request_id: 'request-export-session',
                retryable: false,
              },
            }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          );
        }
        exportCreated = true;
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
              replayed: false,
            },
            meta: { request_id: 'request-export-session' },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const port = new WorkerExportPort(client, 'run-live', createIdempotencyKey);

    await expect(port.read()).resolves.toMatchObject({ type: 'export_required' });
    await expect(port.create()).resolves.toEqual({ type: 'session_expired' });
    expect(exportCalls).toBe(1);
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1);

    await expect(port.read()).resolves.toMatchObject({ type: 'export_required' });
    expect(exportCalls).toBe(1);

    await expect(port.create()).resolves.toMatchObject({
      type: 'ok',
      exportArtifactId: 'artifact-export',
    });
    expect(exportCalls).toBe(2);
    expect(idempotencyKeys).toEqual(['export-idem-session', 'export-idem-session']);
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('remints an expired download link without rebuilding the existing export', async () => {
    let receiptReads = 0;
    let exportCalls = 0;
    let accessReads = 0;
    const existingReceipt = receipt(true);
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-export-remint',
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith('/receipt')) {
          receiptReads += 1;
          return new Response(
            JSON.stringify({
              data: { receipt: existingReceipt },
              meta: { request_id: 'request-export-remint' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if ((init?.method ?? 'GET') === 'POST') exportCalls += 1;
        accessReads += 1;
        return new Response(
          JSON.stringify({
            data: {
              artifact: downloadableArtifact('artifact-export'),
              access: {
                url: `https://core.example.test/v1/artifacts/artifact-export/content?token=download-${String(accessReads)}`,
                expires_at: `2026-08-${String(10 + accessReads).padStart(2, '0')}T12:00:00.000Z`,
                purpose: 'customer_download',
              },
              copy: null,
            },
            meta: { request_id: 'request-export-remint' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const port = new WorkerExportPort(client, 'run-live', () => 'unused-export-idem');
    await expect(port.read()).resolves.toMatchObject({
      type: 'ok',
      exportArtifactId: 'artifact-export',
    });
    await expect(port.remintDownload('artifact-export')).resolves.toMatchObject({
      type: 'ok',
      download: {
        url: expect.stringContaining('download-1'),
        expiresAt: '2026-08-11T12:00:00.000Z',
      },
    });
    expect(receiptReads).toBe(1);
    expect(exportCalls).toBe(0);
  });

  it('maps a receipt-known legacy checksum failure to an explicit buyer-triggered rebuild', async () => {
    let exportCalls = 0;
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-export-rebuild',
      fetch: async (input, init) => {
        const url = String(input);
        if (url.endsWith('/receipt')) {
          return new Response(
            JSON.stringify({
              data: { receipt: receipt(true) },
              meta: { request_id: 'request-export-rebuild' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if ((init?.method ?? 'GET') === 'GET') {
          return new Response(
            JSON.stringify({
              error: {
                code: 'NOT_FOUND',
                message: 'Artifact unavailable.',
                request_id: 'request-export-rebuild',
                retryable: false,
              },
            }),
            { status: 404, headers: { 'content-type': 'application/json' } },
          );
        }
        exportCalls += 1;
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
              replayed: true,
            },
            meta: { request_id: 'request-export-rebuild' },
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const port = new WorkerExportPort(client, 'run-live', () => 'export-idem-rebuild');

    await expect(port.read()).resolves.toMatchObject({
      type: 'ok',
      exportArtifactId: 'artifact-export',
    });
    await expect(port.remintDownload('artifact-export')).resolves.toEqual({
      type: 'rebuild_required',
    });
    expect(exportCalls).toBe(0);

    await expect(port.create()).resolves.toMatchObject({
      type: 'ok',
      exportArtifactId: 'artifact-export',
    });
    expect(exportCalls).toBe(1);
  });

  it('keeps a transient mint failure retryable without rebuilding', async () => {
    let exportCalls = 0;
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-export-transient',
      fetch: async (input, init) => {
        if ((init?.method ?? 'GET') === 'POST') exportCalls += 1;
        return new Response(
          JSON.stringify({
            data: {
              artifact: downloadableArtifact('artifact-export'),
              access: null,
              copy: null,
            },
            meta: { request_id: 'request-export-transient' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const port = new WorkerExportPort(client, 'run-live', () => 'unused-export-idem');

    await expect(port.remintDownload('artifact-export')).resolves.toEqual({
      type: 'error',
      message: 'Core did not return a customer download link.',
      retryable: true,
    });
    expect(exportCalls).toBe(0);
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
