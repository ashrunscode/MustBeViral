import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usdMicros } from '../../../../packages/billing/src/index';
import { ProviderError } from '../../../../packages/provider/src/errors';
import { toTransientDeliveryUrl } from '../../../../packages/provider/src/types';
import type { VerifiedFalWebhook } from '../../../../packages/provider/src/webhook';
import { createCoreApp, defaultV1Dependencies } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import type { FalArtifactContext, FalAttemptAdvance } from '../../src/composition/artifact-machine';
import { copyFalDeliveryToPrivateR2 } from '../../src/composition/artifact-storage';
import {
  ingestVerifiedFalWebhook,
  type FalIngestDependencies,
} from '../../src/composition/fal-ingest';
import type { PrivilegedSettlementPort } from '../../src/composition/settlement';

function png(width = 1080, height = 1350): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function context(overrides: Partial<FalArtifactContext> = {}): FalArtifactContext {
  return {
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    runId: 'run-1',
    canvasRevisionId: 'revision-1',
    runNodeId: 'run-node-1',
    attemptId: 'attempt-1',
    attemptStatus: 'submitted',
    providerJobStatus: 'submitted',
    assetRole: 'master_static',
    priceUnit: 'image',
    unitPriceMicros: usdMicros(500_000n),
    quotedTotalMicros: usdMicros(500_000n),
    reservation: {
      id: 'reservation-1',
      amountMicros: usdMicros(500_000n),
      capturedMicros: usdMicros(0n),
      releasedMicros: usdMicros(0n),
    },
    ...overrides,
  };
}

function successEvent(eventId = 'event-1'): VerifiedFalWebhook {
  return {
    provider: 'fal',
    eventId,
    receivedAtEpochSeconds: 2_000,
    attempt: {
      providerJobId: 'fal-job-1',
      status: {
        state: 'succeeded',
        providerJobId: 'fal-job-1',
        delivery: {
          kind: 'transient_delivery_url',
          transientDeliveryUrl: toTransientDeliveryUrl(
            'https://private-delivery.example.test/output.png',
          ),
        },
      },
    },
  };
}

function failedEvent(): VerifiedFalWebhook {
  return {
    provider: 'fal',
    eventId: 'event-failed-1',
    receivedAtEpochSeconds: 2_000,
    attempt: {
      providerJobId: 'fal-job-1',
      status: {
        state: 'failed',
        providerJobId: 'fal-job-1',
        error: new ProviderError('provider_error', 'fixture failure', false),
      },
    },
  };
}

function settlementSpies() {
  const capture = vi.fn(async () => ({ transactionId: 'capture-1', replayed: false }));
  const release = vi.fn(async () => ({ transactionId: 'release-1', replayed: false }));
  const refund = vi.fn(async () => ({ transactionId: 'refund-1', replayed: false }));
  return {
    capture,
    release,
    refund,
    port: { capture, release, refund } satisfies PrivilegedSettlementPort,
  };
}

describe('durable private fal ingest', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('deduplicates a delivered event into one artifact and one capture', async () => {
    let attemptStatus = 'submitted';
    const registration = vi.fn(async () => ({ artifactId: 'artifact-1', replayed: false }));
    const storage = vi.fn(async () => ({
      byteSize: 24,
      contentHash: 'a'.repeat(64),
      mimeType: 'image/png',
      measurement: { kind: 'image' as const, widthPixels: 1080, heightPixels: 1350 },
    }));
    const money = settlementSpies();
    const advance = vi.fn(async (input: Parameters<FalIngestDependencies['advanceAttempt']>[0]) => {
      if (input.status === 'succeeded') attemptStatus = 'succeeded';
      return {
        effectiveAttemptStatus: attemptStatus,
        runStatus: 'succeeded',
        runTerminal: true,
        reservation: {
          id: 'reservation-1',
          amountMicros: usdMicros(500_000n),
          capturedMicros: usdMicros(500_000n),
          releasedMicros: usdMicros(0n),
        },
        outcomes: [
          {
            attemptId: 'attempt-1',
            status: 'succeeded',
            captureMicros: usdMicros(500_000n),
          },
        ],
      } satisfies FalAttemptAdvance;
    });
    const dependencies: FalIngestDependencies = {
      getContext: async () => context({ attemptStatus }),
      storeDelivery: storage,
      registerArtifact: registration,
      advanceAttempt: advance,
      settlement: money.port,
      requestId: 'request-ingest-1',
    };

    const first = await ingestVerifiedFalWebhook(successEvent(), dependencies);
    const replay = await ingestVerifiedFalWebhook(successEvent(), dependencies);

    expect(first).toMatchObject({ status: 'ok', artifact_id: 'artifact-1' });
    expect(replay).toMatchObject({ status: 'ok', idempotent: true });
    expect(storage).toHaveBeenCalledTimes(1);
    expect(registration).toHaveBeenCalledTimes(1);
    expect(money.capture).toHaveBeenCalledTimes(1);
    expect(money.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        causativeKey: 'run:run-1:attempt:attempt-1:capture',
        amountMicros: 500_000n,
      }),
    );
    expect(money.release).not.toHaveBeenCalled();
    expect(JSON.stringify([first, replay, registration.mock.calls])).not.toContain(
      'private-delivery.example.test',
    );
  });

  it('releases only a failed attempt share and reaches partial_succeeded for a mixed run', async () => {
    const money = settlementSpies();
    const storage = vi.fn();
    const registration = vi.fn();
    const advance = vi.fn(async () => ({
      effectiveAttemptStatus: 'failed',
      runStatus: 'partial_succeeded',
      runTerminal: true,
      reservation: {
        id: 'reservation-1',
        amountMicros: usdMicros(700_000n),
        capturedMicros: usdMicros(500_000n),
        releasedMicros: usdMicros(200_000n),
      },
      outcomes: [
        {
          attemptId: 'attempt-success',
          status: 'succeeded' as const,
          captureMicros: usdMicros(500_000n),
        },
        { attemptId: 'attempt-1', status: 'failed' as const },
      ],
    }));
    const result = await ingestVerifiedFalWebhook(failedEvent(), {
      getContext: async () =>
        context({
          quotedTotalMicros: usdMicros(200_000n),
          reservation: {
            id: 'reservation-1',
            amountMicros: usdMicros(700_000n),
            capturedMicros: usdMicros(500_000n),
            releasedMicros: usdMicros(0n),
          },
        }),
      storeDelivery: storage,
      registerArtifact: registration,
      advanceAttempt: advance,
      settlement: money.port,
      requestId: 'request-ingest-failed',
    });

    expect(result).toMatchObject({ status: 'ok', run_status: 'partial_succeeded' });
    expect(money.release).toHaveBeenCalledTimes(1);
    expect(money.release).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMicros: 200_000n,
        causativeKey: 'run:run-1:attempt:attempt-1:release',
      }),
    );
    expect(money.capture).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(registration).not.toHaveBeenCalled();
  });

  it('sends fal auth and releases the webhook claim when private R2 put fails', async () => {
    let requestedDeliveryUrl = '';
    let requestedDeliveryInit: RequestInit | undefined;
    const deliveryFetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedDeliveryUrl = String(input);
      requestedDeliveryInit = init;
      return new Response(png().buffer as ArrayBuffer, {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '24' },
      });
    });
    const deliveryFetch = deliveryFetchMock as unknown as typeof fetch;
    const bucket = {
      put: vi.fn(async () => {
        throw new Error('fixture R2 failure');
      }),
    } as unknown as R2Bucket;
    const bindings = {
      FAL_KEY: 'fixture-fal-key',
      MEDIA_BUCKET: bucket,
    } as unknown as CoreBindings;
    const money = settlementSpies();
    const registration = vi.fn();
    const releaseClaim = vi.fn(async () => true);
    const markProcessed = vi.fn(async () => true);
    const event = successEvent('event-r2-failure');
    const app = createCoreApp({
      ...defaultV1Dependencies,
      falWebhook: {
        verifyAndMap: async () => event,
        markProcessed,
        release: releaseClaim,
      },
      falWebhookIngest: async (verified) =>
        ingestVerifiedFalWebhook(verified, {
          getContext: async () => context(),
          storeDelivery: async ({ context: job, deliveryUrl, objectKey }) =>
            copyFalDeliveryToPrivateR2({
              bindings,
              deliveryUrl,
              objectKey,
              workspaceId: job.workspaceId,
              runId: job.runId,
              attemptId: job.attemptId,
              fetchImplementation: deliveryFetch,
            }),
          registerArtifact: registration,
          advanceAttempt: vi.fn(),
          settlement: money.port,
          requestId: 'request-r2-failure',
        }),
    });

    const response = await app.request(
      '/v1/webhooks/fal',
      { method: 'POST', body: '{}' },
      bindings,
    );

    expect(response.status).toBe(503);
    expect(deliveryFetchMock).toHaveBeenCalledTimes(1);
    expect(requestedDeliveryUrl).toBe('https://private-delivery.example.test/output.png');
    expect(new Headers(requestedDeliveryInit?.headers).get('authorization')).toBe(
      'Key fixture-fal-key',
    );
    expect(registration).not.toHaveBeenCalled();
    expect(money.capture).not.toHaveBeenCalled();
    expect(markProcessed).not.toHaveBeenCalled();
    expect(releaseClaim).toHaveBeenCalledWith('fal', 'event-r2-failure');
  });

  it('hashes and measures the bytes read back from private R2', async () => {
    const providerBytes = png();
    let storedBytes = new Uint8Array();
    const bucket = {
      put: vi.fn(async (_key: string, body: ReadableStream) => {
        storedBytes = new Uint8Array(await new Response(body).arrayBuffer());
      }),
      get: vi.fn(async () => ({
        arrayBuffer: async () =>
          storedBytes.buffer.slice(
            storedBytes.byteOffset,
            storedBytes.byteOffset + storedBytes.byteLength,
          ),
      })),
    } as unknown as R2Bucket;
    const result = await copyFalDeliveryToPrivateR2({
      bindings: {
        FAL_KEY: 'fixture-fal-key',
        MEDIA_BUCKET: bucket,
      } as unknown as CoreBindings,
      deliveryUrl: toTransientDeliveryUrl('https://private-delivery.example.test/output.png'),
      objectKey: 'workspaces/workspace-1/runs/run-1/attempts/attempt-1/provider-output',
      workspaceId: 'workspace-1',
      runId: 'run-1',
      attemptId: 'attempt-1',
      fetchImplementation: vi.fn(
        async () =>
          new Response(providerBytes.buffer as ArrayBuffer, {
            status: 200,
            headers: { 'content-type': 'image/png', 'content-length': '24' },
          }),
      ),
    });

    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(bucket.get).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      byteSize: 24,
      mimeType: 'image/png',
      measurement: { kind: 'image', widthPixels: 1080, heightPixels: 1350 },
    });
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('treats an authenticated fal delivery denial as expiry or provider access drift', async () => {
    const bucket = { put: vi.fn() } as unknown as R2Bucket;
    await expect(
      copyFalDeliveryToPrivateR2({
        bindings: {
          FAL_KEY: 'fixture-fal-key',
          MEDIA_BUCKET: bucket,
        } as unknown as CoreBindings,
        deliveryUrl: toTransientDeliveryUrl('https://private-delivery.example.test/hidden.png'),
        objectKey: 'workspaces/workspace-1/runs/run-1/attempts/attempt-1/provider-output',
        workspaceId: 'workspace-1',
        runId: 'run-1',
        attemptId: 'attempt-1',
        fetchImplementation: vi.fn(async () => new Response(null, { status: 403 })),
      }),
    ).rejects.toMatchObject({
      reason: 'delivery_acl_suspected',
      retryable: true,
      message: expect.stringMatching(/expired|access behavior/u),
    });
    expect(bucket.put).not.toHaveBeenCalled();
  });
});
