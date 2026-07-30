import { describe, expect, it } from 'vitest';

import { usdMicros } from '../../../../packages/billing/src/index';
import { ingestCopyCompletion } from '../../src/composition/copy-ingest';
import type { CopyIngestDependencies } from '../../src/composition/copy-ingest';
import type { FalArtifactContext } from '../../src/composition/artifact-machine';

/**
 * The OpenRouter copy route had no terminal path at all: its output was discarded in memory, its node
 * was never captured, and because wave promotion runs inside the settlement tail, the whole run
 * stalled at wave 1 - which on the launch pack is all three copy nodes. These tests pin the money
 * semantics of the path that replaces that dead end.
 */

const CONTEXT: FalArtifactContext = {
  workspaceId: 'ws-1',
  projectId: 'pr-1',
  runId: 'run-1',
  canvasRevisionId: 'rev-1',
  runNodeId: 'node-1',
  attemptId: 'attempt-1',
  attemptStatus: 'submitted',
  providerJobStatus: 'submitted',
  assetRole: 'copy_set',
  priceUnit: 'request',
  unitPriceMicros: usdMicros(150_000n),
  quotedTotalMicros: usdMicros(150_000n),
  reservation: {
    id: 'res-1',
    amountMicros: usdMicros(450_000n),
    capturedMicros: usdMicros(0n),
    releasedMicros: usdMicros(0n),
  },
};

interface Recorded {
  readonly calls: string[];
  readonly captures: { amountMicros: bigint; metadata: Record<string, unknown> }[];
  readonly writes: { objectKey: string; bytes: Uint8Array }[];
  readonly advances: { captureMicros?: bigint; artifactId?: string }[];
  readonly releases: bigint[];
}

function deps(overrides: Partial<CopyIngestDependencies> & { context?: FalArtifactContext } = {}): {
  dependencies: CopyIngestDependencies;
  recorded: Recorded;
} {
  const recorded: Recorded = { calls: [], captures: [], writes: [], advances: [], releases: [] };
  const dependencies: CopyIngestDependencies = {
    getContext: async () => overrides.context ?? CONTEXT,
    storeBytes: async (write) => {
      recorded.calls.push('storeBytes');
      recorded.writes.push({ objectKey: write.objectKey, bytes: write.bytes });
    },
    registerArtifact: async () => {
      recorded.calls.push('registerArtifact');
      return { artifactId: 'artifact-1', replayed: false };
    },
    advanceAttempt: async (input) => {
      recorded.calls.push('advanceAttempt');
      recorded.advances.push({
        ...(input.captureMicros === undefined ? {} : { captureMicros: input.captureMicros }),
        ...(input.artifactId === undefined ? {} : { artifactId: input.artifactId }),
      });
      return {
        effectiveAttemptStatus: 'succeeded',
        runStatus: 'running',
        runTerminal: false,
        reservation: CONTEXT.reservation,
        outcomes: [],
      };
    },
    settlement: {
      capture: async (input: Record<string, unknown>) => {
        recorded.calls.push('capture');
        recorded.captures.push({
          amountMicros: input.amountMicros as bigint,
          metadata: (input.metadata ?? {}) as Record<string, unknown>,
        });
      },
      release: async (input: Record<string, unknown>) => {
        recorded.calls.push('release');
        recorded.releases.push(input.amountMicros as bigint);
      },
      refund: async () => undefined,
      credit: async () => undefined,
      reserve: async () => undefined,
    } as unknown as CopyIngestDependencies['settlement'],
    requestId: 'req-1',
    ...overrides,
  };
  return { dependencies, recorded };
}

describe('copy capture basis', () => {
  it('captures the pinned customer price, not the provider’s reported cost', async () => {
    const { dependencies, recorded } = deps();
    await ingestCopyCompletion(
      {
        providerRequestId: 'or-1',
        eventId: 'evt-1',
        output: { variants: ['a', 'b'] },
        // OpenRouter's real cost for a copy set is a few tens of micros.
        providerCostMicros: 17_336n,
      },
      dependencies,
    );
    // Capturing provider cost instead would make terminal settlement release the remainder and
    // silently turn a confirmed 150,000-micro line into a fraction of it.
    expect(recorded.captures[0]?.amountMicros).toBe(150_000n);
    expect(recorded.captures[0]?.metadata.provider_cost_micros).toBe('17336');
  });

  it('never charges above the quoted line even if the pinned unit price exceeds it', async () => {
    const { dependencies, recorded } = deps({
      context: { ...CONTEXT, unitPriceMicros: usdMicros(200_000n) },
    });
    await ingestCopyCompletion(
      { providerRequestId: 'or-1', eventId: 'evt-1', output: {} },
      dependencies,
    );
    expect(recorded.captures[0]?.amountMicros).toBe(150_000n);
  });

  it('omits provider cost from the ledger metadata when the provider did not report one', async () => {
    const { dependencies, recorded } = deps();
    await ingestCopyCompletion(
      { providerRequestId: 'or-1', eventId: 'evt-1', output: {} },
      dependencies,
    );
    expect(recorded.captures[0]?.metadata).not.toHaveProperty('provider_cost_micros');
  });
});

describe('copy ingest ordering', () => {
  it('stores bytes, then captures, then advances', async () => {
    // The order the fal path already proved and the database enforces. Dying before capture risks a
    // fraction of a cent of duplicate OpenRouter spend; dying after advance but before capture would
    // strand the whole reservation.
    const { dependencies, recorded } = deps();
    await ingestCopyCompletion(
      { providerRequestId: 'or-1', eventId: 'evt-1', output: {} },
      dependencies,
    );
    expect(recorded.calls).toEqual(['storeBytes', 'registerArtifact', 'capture', 'advanceAttempt']);
  });

  it('passes the registered artifact and the captured amount to the advance', async () => {
    const { dependencies, recorded } = deps();
    await ingestCopyCompletion(
      { providerRequestId: 'or-1', eventId: 'evt-1', output: {} },
      dependencies,
    );
    expect(recorded.advances[0]).toEqual({ artifactId: 'artifact-1', captureMicros: 150_000n });
  });
});

describe('copy artifact bytes', () => {
  it('serialises canonically so key order cannot change the content hash', async () => {
    // The content hash is the artifact's identity and the basis of replay protection, so two ingests
    // of the same completion must produce byte-identical output.
    const first = deps();
    await ingestCopyCompletion(
      { providerRequestId: 'or-1', eventId: 'evt-1', output: { b: 1, a: { d: 2, c: 3 } } },
      first.dependencies,
    );
    const second = deps();
    await ingestCopyCompletion(
      { providerRequestId: 'or-1', eventId: 'evt-1', output: { a: { c: 3, d: 2 }, b: 1 } },
      second.dependencies,
    );
    const decode = (bytes: Uint8Array | undefined): string =>
      new TextDecoder().decode(bytes ?? new Uint8Array());
    expect(decode(first.recorded.writes[0]?.bytes)).toBe(decode(second.recorded.writes[0]?.bytes));
    expect(decode(first.recorded.writes[0]?.bytes)).toBe('{"a":{"c":3,"d":2},"b":1}');
  });
});

describe('replay', () => {
  it.each(['succeeded', 'failed', 'canceled'])(
    'does not capture again for an attempt already %s',
    async (attemptStatus) => {
      const { dependencies, recorded } = deps({ context: { ...CONTEXT, attemptStatus } });
      const result = await ingestCopyCompletion(
        { providerRequestId: 'or-1', eventId: 'evt-1', output: {} },
        dependencies,
      );
      expect(result).toMatchObject({ status: 'ok', accepted: true, idempotent: true });
      expect(recorded.calls).toEqual([]);
    },
  );
});
