import { describe, expect, it } from 'vitest';
import { usdMicros, type SpendCaps } from '@mustbeviral/billing';
import { hashCanonicalGraph, type GraphSnapshot } from '@mustbeviral/graph';
import { createCommandHandlers } from './handlers';
import type {
  ArtifactRecord,
  AuditEvent,
  CanvasContextRecord,
  HandlerPorts,
  RunRecord,
  StoredQuote,
} from './ports';

const context = {
  workspace_id: 'workspace-1',
  actor_id: 'actor-1',
  request_id: 'request-123',
};

const briefGraph: GraphSnapshot = {
  nodes: [
    {
      id: 'brief-1',
      kind: 'brief',
      parameter_schema_version: 1,
      parameters: { title: 'Launch' },
    },
  ],
  edges: [],
};

class MemoryPorts {
  readonly audits: AuditEvent[] = [];
  readonly quotesById = new Map<string, StoredQuote>();
  readonly runsById = new Map<string, RunRecord>();
  readonly artifactsById = new Map<string, ArtifactRecord>();
  readonly lineage = new Map<string, { parentArtifactId: string; childArtifactId: string }>();
  readonly idempotencyRecords = new Map<string, { fingerprint: string; result: unknown }>();
  readonly counters = new Map<string, number>();
  canvas: CanvasContextRecord;
  nowValue = '2026-07-19T12:00:00.000Z';
  authorized = true;
  confirmationValid = true;
  caps: SpendCaps = {
    run: usdMicros(8_000_000n),
    workspaceDay: usdMicros(25_000_000n),
    globalDay: usdMicros(100_000_000n),
  };

  constructor() {
    this.canvas = {
      canvasId: 'canvas-1',
      projectId: 'project-1',
      headRevisionId: 'revision-0',
      graphSchemaVersion: 1,
      graphSnapshot: briefGraph,
      canonicalHash: 'initial-hash',
    };
  }

  asPorts(): HandlerPorts {
    return {
      authorization: {
        authorize: async () => this.authorized,
      },
      canvases: {
        get: async (_context, canvasId) => (canvasId === this.canvas.canvasId ? this.canvas : null),
        compareAndSwapRevision: async (_context, input) => {
          if (this.canvas.headRevisionId !== input.expectedRevisionId) {
            return { status: 'conflict' as const, actualHead: this.canvas.headRevisionId };
          }
          this.canvas = {
            ...this.canvas,
            headRevisionId: input.nextRevisionId,
            graphSnapshot: input.graphSnapshot,
            canonicalHash: input.canonicalHash,
          };
          return { status: 'ok' as const };
        },
      },
      catalog: {
        quotePlan: async (_context, snapshot) => ({
          priceCatalogVersionId: 'catalog-1',
          prices: [
            {
              priceCatalogVersionId: 'catalog-1',
              modelRouteId: 'fal-image-route',
              providerModelId: 'fal/image-model',
              unit: 'image',
              unitPriceMicros: usdMicros(750_000n),
            },
          ],
          nodes: snapshot.nodes
            .filter((node) => node.kind === 'image_generation')
            .map((node) => ({
              nodeId: node.id,
              modelRouteId: 'fal-image-route',
              pricingUnits: [{ unit: 'image' as const, quantity: 1n }],
            })),
        }),
      },
      quotes: {
        get: async (_context, quoteId) => this.quotesById.get(quoteId) ?? null,
        save: async (_context, stored) => {
          this.quotesById.set(stored.quote.quoteId, stored);
          return stored;
        },
      },
      billing: {
        get: async () => ({
          availableBalanceMicros: usdMicros(50_000_000n),
          workspaceDayExposureMicros: usdMicros(0n),
          globalDayExposureMicros: usdMicros(0n),
          caps: this.caps,
        }),
      },
      confirmations: {
        verify: async () => this.confirmationValid,
      },
      runs: {
        get: async (_context, runId) => this.runsById.get(runId) ?? null,
        startBarrier: async (_context, input) => {
          expect(input).toMatchObject({
            canvasId: 'canvas-1',
            quoteId: 'quote-1',
            confirmed: true,
          });
          const run: RunRecord = {
            runId: 'server-run-1',
            projectId: 'project-1',
            canvasId: input.canvasId,
            canvasRevisionId: input.expectedRevisionId,
            quoteId: input.quoteId,
            status: 'queued',
            reservationId: 'server-reservation-1',
          };
          this.runsById.set(run.runId, run);
          return {
            runId: run.runId,
            reservationId: run.reservationId,
            status: 'queued' as const,
          };
        },
        requestCancellation: async (_context, input) => {
          const run = this.runsById.get(input.runId);
          if (run === undefined || run.status !== input.expectedState) {
            return { status: 'conflict' as const, actualState: run?.status ?? 'failed' };
          }
          this.runsById.set(input.runId, { ...run, status: 'cancel_requested' });
          return { status: 'ok' as const };
        },
      },
      artifacts: {
        register: async (_context, artifact) => {
          this.artifactsById.set(artifact.artifactId, artifact);
        },
        registerLineage: async (_context, entry) => {
          this.lineage.set(entry.lineageId, entry);
        },
      },
      audit: {
        emit: async (event) => {
          this.audits.push(event);
        },
      },
      idempotency: {
        execute: async <Result>(
          identity: string,
          fingerprint: string,
          work: () => Promise<Result>,
        ) => {
          const existing = this.idempotencyRecords.get(identity);
          if (existing !== undefined) {
            return existing.fingerprint === fingerprint
              ? { status: 'replay' as const, result: existing.result as Result }
              : { status: 'conflict' as const };
          }
          const result = await work();
          this.idempotencyRecords.set(identity, { fingerprint, result });
          return { status: 'created' as const, result };
        },
      },
      clock: { now: () => this.nowValue },
      ids: {
        next: (kind) => {
          const next = (this.counters.get(kind) ?? 0) + 1;
          this.counters.set(kind, next);
          return `${kind}-${String(next)}`;
        },
      },
    };
  }
}

async function buildQuotedFlow(memory: MemoryPorts) {
  const handlers = createCommandHandlers(memory.asPorts());
  const patch = await handlers.applyCanvasPatch({
    context,
    canvas_id: 'canvas-1',
    expected_revision_id: 'revision-0',
    reason: 'Add first generation branch',
    patch: {
      upsert_nodes: [
        {
          id: 'image-1',
          kind: 'image_generation',
          parameter_schema_version: 1,
          parameters: { prompt: 'Product hero' },
        },
      ],
      upsert_edges: [
        {
          id: 'edge-1',
          kind: 'dependency',
          source_node_id: 'brief-1',
          target_node_id: 'image-1',
        },
      ],
    },
    idempotency_key: 'patch-key',
  });
  expect(patch.status).toBe('ok');
  const validation = await handlers.validateGraph({ context, canvas_id: 'canvas-1' });
  expect(validation).toMatchObject({ status: 'ok', valid: true });
  const quote = await handlers.quoteRun({
    context,
    canvas_id: 'canvas-1',
    expected_revision_id: memory.canvas.headRevisionId,
    idempotency_key: 'quote-key',
  });
  expect(quote.status).toBe('ok');
  if (quote.status !== 'ok') throw new Error('quote setup failed');
  return { handlers, quote: quote.quote };
}

describe('command handler flows', () => {
  it('runs brief -> patch -> validate -> quote -> confirm -> run -> artifact -> cancel', async () => {
    const memory = new MemoryPorts();
    memory.canvas = { ...memory.canvas, canonicalHash: await hashCanonicalGraph(briefGraph) };
    const { handlers, quote } = await buildQuotedFlow(memory);
    const started = await handlers.startRun({
      context,
      quote_id: quote.quoteId,
      confirmed: true,
      confirmation_token: 'confirmation-token-123',
      idempotency_key: 'start-key',
    });
    expect(started.status).toBe('ok');
    if (started.status !== 'ok') throw new Error('run setup failed');
    expect(started.run).toMatchObject({
      runId: 'server-run-1',
      reservationId: 'server-reservation-1',
      status: 'queued',
    });
    expect(memory.counters.has('run')).toBe(false);
    expect(memory.counters.has('reservation')).toBe(false);
    expect(memory.counters.has('outbox')).toBe(false);
    expect(await handlers.getRun({ context, run_id: started.run.runId })).toEqual({
      status: 'ok',
      run: started.run,
    });
    const artifact = await handlers.registerArtifact({
      context,
      run_id: started.run.runId,
      run_node_id: null,
      artifact_id: 'artifact-1',
      artifact_kind: 'provider_output',
      object_key: 'private/workspace-1/image.png',
      mime_type: 'image/png',
      byte_size: 42,
      content_hash: 'a'.repeat(64),
      idempotency_key: 'artifact-key',
    });
    expect(artifact.status).toBe('ok');
    expect(
      await handlers.registerArtifactLineage({
        context,
        parent_artifact_id: 'artifact-input',
        child_artifact_id: 'artifact-1',
        relationship: 'input_to_output',
        idempotency_key: 'lineage-key',
      }),
    ).toMatchObject({ status: 'ok' });
    expect(
      await handlers.cancelRun({
        context,
        run_id: started.run.runId,
        reason: 'User requested stop',
        idempotency_key: 'cancel-key',
      }),
    ).toEqual({ status: 'ok', runId: started.run.runId, cancellation: 'accepted' });
    expect(memory.audits.map((event) => event.operation)).toContain('start_run');
  });

  it('returns a revision conflict without writing a revision', async () => {
    const memory = new MemoryPorts();
    const handlers = createCommandHandlers(memory.asPorts());
    const result = await handlers.applyCanvasPatch({
      context,
      canvas_id: 'canvas-1',
      expected_revision_id: 'stale-revision',
      reason: 'Stale edit',
      patch: {},
      idempotency_key: 'conflict-key',
    });
    expect(result).toEqual({ status: 'conflict', reason: 'revision', actual: 'revision-0' });
    expect(memory.canvas.headRevisionId).toBe('revision-0');
  });

  it('rejects an expired quote before confirmation or reservation', async () => {
    const memory = new MemoryPorts();
    const { handlers, quote } = await buildQuotedFlow(memory);
    memory.nowValue = '2026-07-19T12:15:00.000Z';
    const result = await handlers.startRun({
      context,
      quote_id: quote.quoteId,
      confirmed: true,
      confirmation_token: 'confirmation-token-123',
      idempotency_key: 'expired-key',
    });
    expect(result).toEqual({
      status: 'expired_quote',
      quoteId: quote.quoteId,
      expiredAt: '2026-07-19T12:15:00.000Z',
    });
    expect(memory.runsById).toHaveLength(0);
  });

  it('returns cap_exceeded before the start barrier', async () => {
    const memory = new MemoryPorts();
    const { handlers, quote } = await buildQuotedFlow(memory);
    memory.caps = { ...memory.caps, run: usdMicros(100_000n) };
    const result = await handlers.startRun({
      context,
      quote_id: quote.quoteId,
      confirmed: true,
      confirmation_token: 'confirmation-token-123',
      idempotency_key: 'cap-key',
    });
    expect(result).toMatchObject({ status: 'cap_exceeded', tier: 'run' });
    expect(memory.runsById).toHaveLength(0);
  });

  it('replays the same idempotent start result with one barrier effect', async () => {
    const memory = new MemoryPorts();
    const { handlers, quote } = await buildQuotedFlow(memory);
    const input = {
      context,
      quote_id: quote.quoteId,
      confirmed: true as const,
      confirmation_token: 'confirmation-token-123',
      idempotency_key: 'replay-key',
    };
    const first = await handlers.startRun(input);
    const second = await handlers.startRun({
      ...input,
      context: { ...context, request_id: 'request-from-second-transport' },
    });
    expect(second).toEqual(first);
    expect(memory.runsById).toHaveLength(1);
    expect(memory.audits.some((event) => event.outcome === 'idempotent_replay')).toBe(true);
  });

  it('rejects reuse of an idempotency key with changed input', async () => {
    const memory = new MemoryPorts();
    const { handlers, quote } = await buildQuotedFlow(memory);
    await handlers.startRun({
      context,
      quote_id: quote.quoteId,
      confirmed: true,
      confirmation_token: 'confirmation-token-123',
      idempotency_key: 'same-key',
    });
    const changed = await handlers.startRun({
      context: { ...context, request_id: 'request-456' },
      quote_id: quote.quoteId,
      confirmed: true,
      confirmation_token: 'confirmation-token-456',
      idempotency_key: 'same-key',
    });
    expect(changed).toEqual({ status: 'conflict', reason: 'idempotency' });
    expect(memory.runsById).toHaveLength(1);
  });
});
