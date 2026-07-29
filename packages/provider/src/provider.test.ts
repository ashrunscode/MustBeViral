import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceLiteDescriptor,
  falSeedanceProFastDescriptor,
  launchDriverDescriptors,
  moonshotKimiK26Descriptor,
  openRouterCopyDescriptor,
} from './catalog';
import {
  OutboxDispatcher,
  ProviderReconciler,
  type PendingProviderOutboxEvent,
  type PendingProviderReconciliationJob,
  type ProviderOutboxPort,
  type ProviderReconciliationPort,
} from './dispatcher';
import { ProviderError, ProviderTransportFailure } from './errors';
import { FalQueueDriver } from './fal';
import { MoonshotKimiK26Driver } from './moonshot';
import type {
  DriverDescriptor,
  ProviderJobStatus,
  ProviderSubmission,
  ProviderTransport,
  ProviderTransportRequest,
  ProviderTransportResponse,
  VersionedProviderDriver,
} from './types';
import {
  FalWebhookVerifier,
  clearFalJwksCacheForTests,
  type WebhookEventDedupPort,
} from './webhook';

const CLOSED_GATES = {
  priceConfirmed: false,
  retentionCleared: false,
} as const;

interface HttpFixture {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

interface FailureFixture {
  readonly failure: Readonly<{
    kind: 'timeout' | 'connection' | 'aborted';
    requestMayHaveBeenAccepted: boolean;
  }>;
}

interface WebhookFixture {
  readonly timestamp: number;
  readonly eventId: string;
  readonly signature: string;
  readonly rawBody: string;
}

function fixture<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8')) as T;
}

class FixtureTransport implements ProviderTransport {
  readonly requests: ProviderTransportRequest[] = [];

  constructor(private readonly fixtures: readonly (HttpFixture | FailureFixture)[]) {}

  async request(request: ProviderTransportRequest): Promise<ProviderTransportResponse> {
    this.requests.push(request);
    const next = this.fixtures[this.requests.length - 1];
    if (next === undefined) throw new Error('fixture transport exhausted');
    if ('failure' in next) {
      throw new ProviderTransportFailure(
        next.failure.kind,
        'recorded fixture transport failure',
        next.failure.requestMayHaveBeenAccepted,
      );
    }
    return {
      status: next.status,
      headers: next.headers,
      body: JSON.stringify(next.body),
    };
  }
}

const enabled = (descriptor: DriverDescriptor): DriverDescriptor => ({
  ...descriptor,
  enableGates: { priceConfirmed: true, retentionCleared: true },
});

const fixtureCredential = 'fixture-credential-value';
const webhookFixtureMaterial = 'webhook-signing-fixture-value';
const fixtureFalWebhookUrl = 'https://core.fixture.invalid/v1/webhooks/fal';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('real network access is forbidden in provider tests');
    }),
  );
});

describe('versioned launch catalog', () => {
  it('pins exact launch routes, model ids, prices, versions, and evidence gates', () => {
    expect(launchDriverDescriptors).toHaveLength(4);
    expect(launchDriverDescriptors.map((entry) => entry.modelId)).toEqual([
      // Copy moved off the Moonshot direct route to the OpenRouter gateway.
      'qwen/qwen3-30b-a3b-instruct-2507',
      'fal-ai/flux-2-pro',
      'fal-ai/flux-kontext/pro',
      'fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
    ]);
    expect(falSeedanceProFastDescriptor.endpoint).toBe(
      'https://queue.fal.run/fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
    );
    // Historical quote catalog key stays stable; Lite was retired on fal.
    expect(falSeedanceProFastDescriptor.routeId).toBe('fal/seedance-1.0-lite/motion');
    expect(falSeedanceLiteDescriptor).toBe(falSeedanceProFastDescriptor);
    expect(openRouterCopyDescriptor.price).toEqual({
      kind: 'text_tokens',
      inputPerMillionMicros: 48_000,
      outputPerMillionMicros: 193_000,
    });
    // The retired Moonshot descriptor keeps its pinned price so historical quotes stay auditable.
    expect(moonshotKimiK26Descriptor.price).toEqual({
      kind: 'text_tokens',
      inputPerMillionMicros: 950_000,
      outputPerMillionMicros: 4_000_000,
    });
    expect(falFlux2ProDescriptor.price).toEqual({
      kind: 'image_megapixel_tiered',
      firstMegapixelMicros: 30_000,
      additionalMegapixelMicros: 15_000,
    });
    expect(falFluxKontextProDescriptor.price).toEqual({
      kind: 'image_flat',
      perImageMicros: 40_000,
    });
    expect(falSeedanceProFastDescriptor.price).toEqual({
      kind: 'video_second',
      perSecondMicros: 22_000,
      resolution: '720p',
    });
    for (const descriptor of launchDriverDescriptors) {
      expect(descriptor.driverVersion).toBe('1.0.0');
    }
    expect(
      launchDriverDescriptors.map(({ routeId, enableGates }) => ({ routeId, enableGates })),
    ).toEqual([
      {
        routeId: openRouterCopyDescriptor.routeId,
        enableGates: CLOSED_GATES,
      },
      {
        routeId: falFlux2ProDescriptor.routeId,
        enableGates: {
          priceConfirmed: true,
          retentionCleared: true,
        },
      },
      {
        routeId: falFluxKontextProDescriptor.routeId,
        enableGates: CLOSED_GATES,
      },
      {
        routeId: falSeedanceProFastDescriptor.routeId,
        enableGates: CLOSED_GATES,
      },
    ]);
  });
});

describe('Moonshot kimi-k2.6 driver', () => {
  const validInput = {
    task: 'copy',
    messages: [{ role: 'user', content: 'Write fixture copy.' }],
    maxTokens: 500,
    temperature: 0.4,
  } as const;

  it('fails closed with typed auth_missing when credentials are absent', async () => {
    const transport = new FixtureTransport([]);
    const driver = new MoonshotKimiK26Driver(moonshotKimiK26Descriptor, transport, undefined);
    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-fixture-001', payload: validInput }),
    ).rejects.toMatchObject({ code: 'auth_missing' });
    expect(transport.requests).toHaveLength(0);
  });

  it('fails closed on catalog gates without touching transport', async () => {
    const transport = new FixtureTransport([]);
    const driver = new MoonshotKimiK26Driver(
      moonshotKimiK26Descriptor,
      transport,
      fixtureCredential,
    );
    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-fixture-002', payload: validInput }),
    ).rejects.toMatchObject({ code: 'provider_error', details: { reason: 'price_not_confirmed' } });
    expect(transport.requests).toHaveLength(0);
  });

  it('maps chat-completions and captures token cost in integer micros', async () => {
    const transport = new FixtureTransport([fixture<HttpFixture>('moonshot/success.json')]);
    const driver = new MoonshotKimiK26Driver(
      enabled(moonshotKimiK26Descriptor),
      transport,
      fixtureCredential,
    );
    const result = await driver.submit({
      billingIdempotencyKey: 'billing-fixture-003',
      payload: validInput,
    });
    expect(result).toMatchObject({
      state: 'succeeded',
      output: {
        text: 'Fixture copy output.',
        usage: {
          inputUnits: 40_000,
          outputUnits: 15_000,
          inputCostMicros: 38_000,
          outputCostMicros: 60_000,
          totalCostMicros: 98_000,
        },
      },
    });
    expect(JSON.parse(transport.requests[0]?.body ?? '{}')).toMatchObject({
      model: 'kimi-k2.6',
      max_tokens: 500,
      temperature: 0.4,
    });
  });

  it.each([
    ['provider_error', 'moonshot/provider_error.json', 'provider_error'],
    ['rate_limited', 'moonshot/rate_limited.json', 'rate_limited'],
    ['timeout', 'moonshot/timeout.json', 'timeout'],
    ['payload drift', 'moonshot/payload_invalid.json', 'payload_invalid'],
  ] as const)('maps %s fixture to %s', async (_label, path, expectedCode) => {
    const transport = new FixtureTransport([fixture<HttpFixture | FailureFixture>(path)]);
    const driver = new MoonshotKimiK26Driver(
      enabled(moonshotKimiK26Descriptor),
      transport,
      fixtureCredential,
    );
    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-fixture-errors', payload: validInput }),
    ).rejects.toMatchObject({ code: expectedCode });
  });

  it('rejects invalid planning/copy input before transport', async () => {
    const transport = new FixtureTransport([]);
    const driver = new MoonshotKimiK26Driver(
      enabled(moonshotKimiK26Descriptor),
      transport,
      fixtureCredential,
    );
    await expect(
      driver.submit({
        billingIdempotencyKey: 'billing-fixture-invalid',
        payload: { task: 'drift' },
      }),
    ).rejects.toMatchObject({ code: 'payload_invalid' });
    expect(transport.requests).toHaveLength(0);
  });
});

const falCases = [
  [falFlux2ProDescriptor, { prompt: 'Fixture master.' }],
  [
    falFluxKontextProDescriptor,
    { prompt: 'Fixture adaptation.', image_url: 'https://input.invalid/master.png' },
  ],
  [
    falSeedanceProFastDescriptor,
    { prompt: 'Fixture motion.', image_url: 'https://input.invalid/master.png', duration: 6 },
  ],
] as const;

describe('fal queue launch drivers', () => {
  it('fails closed with typed auth_missing when credentials are absent', async () => {
    const transport = new FixtureTransport([]);
    const driver = new FalQueueDriver(falFlux2ProDescriptor, transport, undefined);
    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-fal-auth', payload: { prompt: 'Fixture.' } }),
    ).rejects.toMatchObject({ code: 'auth_missing' });
    expect(transport.requests).toHaveLength(0);
  });

  it('fails closed on catalog and kill-switch evaluation', async () => {
    const transport = new FixtureTransport([]);
    const driver = new FalQueueDriver(
      enabled(falFlux2ProDescriptor),
      transport,
      fixtureCredential,
      fixtureFalWebhookUrl,
      { evaluate: () => ({ allowed: false, reason: 'global_kill_switch' }) },
    );
    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-fal-kill', payload: { prompt: 'Fixture.' } }),
    ).rejects.toMatchObject({
      code: 'provider_error',
      details: { reason: 'global_kill_switch' },
    });
    expect(transport.requests).toHaveLength(0);
  });

  it.each(falCases)(
    'submits %s as a queued job with billing idempotency',
    async (descriptor, payload) => {
      const transport = new FixtureTransport([fixture<HttpFixture>('fal/submit_success.json')]);
      const driver = new FalQueueDriver(
        enabled(descriptor),
        transport,
        fixtureCredential,
        fixtureFalWebhookUrl,
      );
      const result = await driver.submit({ billingIdempotencyKey: 'billing-fal-success', payload });
      expect(result).toMatchObject({
        provider: 'fal',
        routeId: descriptor.routeId,
        providerJobId: 'fal-job-fixture-001',
        state: 'queued',
      });
      expect(transport.requests[0]?.headers['x-fal-idempotency-key']).toBe('billing-fal-success');
      const submitUrl = new URL(transport.requests[0]?.url ?? '');
      expect(submitUrl.searchParams.get('fal_webhook')).toBe(fixtureFalWebhookUrl);
      expect(transport.requests[0]?.headers['x-fal-object-lifecycle-preference']).toBe(
        '{"expiration_duration_seconds":3600}',
      );
      expect(transport.requests[0]?.headers).not.toHaveProperty('x-fal-store-io');
      expect(submitUrl.origin + submitUrl.pathname).toBe(descriptor.endpoint);
      if (descriptor.capabilities.family === 'video') {
        const body = JSON.parse(transport.requests[0]?.body ?? '{}') as Record<string, unknown>;
        expect(body.duration).toBe('6');
        expect(body.resolution).toBe('720p');
      }
    },
  );

  it('fails closed before transport when the callback URL is absent', async () => {
    const transport = new FixtureTransport([]);
    const driver = new FalQueueDriver(enabled(falFlux2ProDescriptor), transport, fixtureCredential);
    await expect(
      driver.submit({
        billingIdempotencyKey: 'billing-fal-webhook-missing',
        payload: { prompt: 'Fixture.' },
      }),
    ).rejects.toMatchObject({
      code: 'provider_error',
      details: { reason: 'webhook_url_missing' },
    });
    expect(transport.requests).toHaveLength(0);
  });

  it.each([
    ['provider_error', 'fal/provider_error.json', 'provider_error'],
    ['rate_limited', 'fal/rate_limited.json', 'rate_limited'],
    ['timeout', 'fal/timeout.json', 'timeout'],
    ['ambiguous', 'fal/ambiguous.json', 'ambiguous_submit'],
  ] as const)('maps %s submit fixture to %s', async (_label, path, expectedCode) => {
    const transport = new FixtureTransport([fixture<HttpFixture | FailureFixture>(path)]);
    const driver = new FalQueueDriver(
      enabled(falFlux2ProDescriptor),
      transport,
      fixtureCredential,
      fixtureFalWebhookUrl,
    );
    await expect(
      driver.submit({
        billingIdempotencyKey: 'billing-fal-errors',
        payload: { prompt: 'Fixture.' },
      }),
    ).rejects.toMatchObject({ code: expectedCode });
  });

  it.each([
    ['fal/status_queued.json', 'queued'],
    ['fal/status_running.json', 'running'],
    ['fal/status_image_completed.json', 'succeeded'],
    ['fal/status_failed.json', 'failed'],
  ] as const)('maps status fixture %s', async (path, state) => {
    const transport = new FixtureTransport([fixture<HttpFixture>(path)]);
    const driver = new FalQueueDriver(enabled(falFlux2ProDescriptor), transport, fixtureCredential);
    await expect(driver.status('fal-job-fixture-001')).resolves.toMatchObject({ state });
  });

  it('marks video completion URLs as transient delivery only', async () => {
    const transport = new FixtureTransport([
      fixture<HttpFixture>('fal/status_video_completed.json'),
    ]);
    const driver = new FalQueueDriver(
      enabled(falSeedanceProFastDescriptor),
      transport,
      fixtureCredential,
    );
    await expect(driver.status('fal-job-fixture-001')).resolves.toMatchObject({
      state: 'succeeded',
      delivery: {
        kind: 'transient_delivery_url',
        transientDeliveryUrl: 'https://delivery.invalid/output.mp4',
      },
    });
  });

  it('fetches the result after an official-shape COMPLETED status omits output', async () => {
    const transport = new FixtureTransport([
      {
        status: 200,
        headers: {},
        body: {
          status: 'COMPLETED',
          request_id: 'fal-job-fixture-001',
          response_url: 'https://queue.fal.run/fixture/response',
        },
      },
      fixture<HttpFixture>('fal/status_image_completed.json'),
    ]);
    const driver = new FalQueueDriver(enabled(falFlux2ProDescriptor), transport, fixtureCredential);
    await expect(driver.status('fal-job-fixture-001')).resolves.toMatchObject({
      state: 'succeeded',
      delivery: { kind: 'transient_delivery_url' },
    });
    expect(transport.requests[1]?.url).toBe(
      `${falFlux2ProDescriptor.endpoint}/requests/fal-job-fixture-001`,
    );
  });

  it.each(falCases)(
    'marks ambiguous submit for every fal route family %s',
    async (descriptor, payload) => {
      const transport = new FixtureTransport([fixture<FailureFixture>('fal/ambiguous.json')]);
      const driver = new FalQueueDriver(
        enabled(descriptor),
        transport,
        fixtureCredential,
        fixtureFalWebhookUrl,
      );
      await expect(
        driver.submit({ billingIdempotencyKey: 'billing-fal-ambiguous', payload }),
      ).rejects.toMatchObject({ code: 'ambiguous_submit' });
    },
  );
});

describe('fal signed webhook verifier', () => {
  const createDedup = (
    dedupResult: 'claimed' | 'duplicate' | 'in_progress' = 'claimed',
  ): WebhookEventDedupPort => ({
    claim: vi.fn().mockResolvedValue(dedupResult),
    markProcessed: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(true),
  });

  const createVerifier = (dedupResult: 'claimed' | 'duplicate' | 'in_progress' = 'claimed') => {
    const dedup = createDedup(dedupResult);
    return {
      dedup,
      verifier: new FalWebhookVerifier(
        webhookFixtureMaterial,
        dedup,
        { nowEpochSeconds: () => 1_784_451_600 },
        300,
      ),
    };
  };

  const requestFrom = (recorded: WebhookFixture) => ({
    rawBody: Buffer.from(recorded.rawBody),
    headers: {
      'x-fal-signature': recorded.signature,
      'x-fal-timestamp': String(recorded.timestamp),
      'x-fal-event-id': recorded.eventId,
    },
  });

  it('verifies raw-body HMAC and maps payload to a run attempt', async () => {
    const recorded = fixture<WebhookFixture>('webhook/valid.json');
    const { dedup, verifier } = createVerifier();
    await expect(verifier.verifyAndMap(requestFrom(recorded))).resolves.toMatchObject({
      provider: 'fal',
      eventId: 'fal-event-fixture-001',
      attempt: {
        providerJobId: 'fal-job-fixture-001',
        status: {
          state: 'succeeded',
          delivery: { kind: 'transient_delivery_url' },
        },
      },
    });
    expect(dedup.claim).toHaveBeenCalledWith('fal', 'fal-event-fixture-001');
  });

  it('rejects an invalid signature before deduplication', async () => {
    const recorded = fixture<WebhookFixture>('webhook/invalid_signature.json');
    const { dedup, verifier } = createVerifier();
    await expect(verifier.verifyAndMap(requestFrom(recorded))).rejects.toMatchObject({
      code: 'auth_rejected',
    });
    expect(dedup.claim).not.toHaveBeenCalled();
  });

  it('rejects a fixture replay through the atomic event-id contract', async () => {
    const recorded = fixture<WebhookFixture>('webhook/replayed.json');
    const { verifier } = createVerifier('duplicate');
    await expect(verifier.verifyAndMap(requestFrom(recorded))).rejects.toMatchObject({
      code: 'provider_error',
      details: { reason: 'webhook_replayed' },
    });
  });

  it('reports a fresh concurrent claim as retryable in progress', async () => {
    const recorded = fixture<WebhookFixture>('webhook/replayed.json');
    const { verifier } = createVerifier('in_progress');
    await expect(verifier.verifyAndMap(requestFrom(recorded))).rejects.toMatchObject({
      code: 'provider_error',
      retryable: true,
      details: { reason: 'webhook_in_progress' },
    });
  });

  it('rejects stale timestamps and missing webhook credentials', async () => {
    const recorded = fixture<WebhookFixture>('webhook/valid.json');
    const dedup = createDedup();
    const stale = new FalWebhookVerifier(
      webhookFixtureMaterial,
      dedup,
      { nowEpochSeconds: () => recorded.timestamp + 301 },
      300,
    );
    await expect(stale.verifyAndMap(requestFrom(recorded))).rejects.toMatchObject({
      code: 'auth_rejected',
    });
    const missing = new FalWebhookVerifier(undefined, dedup, {
      nowEpochSeconds: () => recorded.timestamp,
    });
    await expect(missing.verifyAndMap(requestFrom(recorded))).rejects.toMatchObject({
      code: 'auth_missing',
    });
  });

  it('verifies official fal JWKS headers with receiver-safe injected and default fetches', async () => {
    clearFalJwksCacheForTests();
    const { generateKeyPairSync, createHash, sign } = await import('node:crypto');
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const jwk = publicKey.export({ format: 'jwk' }) as { x?: string };
    expect(typeof jwk.x).toBe('string');
    const rawBody = Buffer.from(
      JSON.stringify({
        request_id: 'fal-jwks-job-001',
        status: 'OK',
        payload: { images: [{ url: 'https://delivery.invalid/jwks.png' }] },
      }),
    );
    const requestId = 'fal-jwks-event-001';
    const userId = 'fal-user-fixture';
    const timestamp = '1784451600';
    const bodyHash = createHash('sha256').update(rawBody).digest('hex');
    const message = `${requestId}\n${userId}\n${timestamp}\n${bodyHash}`;
    const signatureHex = sign(null, Buffer.from(message, 'utf8'), privateKey).toString('hex');
    const jwksResponse = () =>
      new Response(JSON.stringify({ keys: [{ kty: 'OKP', crv: 'Ed25519', x: jwk.x }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const fetchImplementation = vi.fn(function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(jwksResponse());
    }) as unknown as typeof fetch;
    const dedup = createDedup();
    const verifier = new FalWebhookVerifier(
      {
        fetchImplementation,
        jwksUrl: 'https://jwks.test/keys',
      },
      dedup,
      { nowEpochSeconds: () => 1_784_451_600 },
    );
    await expect(
      verifier.verifyAndMap({
        rawBody,
        headers: {
          'x-fal-webhook-request-id': requestId,
          'x-fal-webhook-user-id': userId,
          'x-fal-webhook-timestamp': timestamp,
          'x-fal-webhook-signature': signatureHex,
        },
      }),
    ).resolves.toMatchObject({
      provider: 'fal',
      eventId: requestId,
      attempt: {
        providerJobId: 'fal-jwks-job-001',
        status: { state: 'succeeded' },
      },
    });
    expect(fetchImplementation).toHaveBeenCalled();
    expect(dedup.claim).toHaveBeenCalledWith('fal', requestId);

    clearFalJwksCacheForTests();
    const defaultFetch = vi.fn(function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(jwksResponse());
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', defaultFetch);
    const defaultVerifier = new FalWebhookVerifier(
      { jwksUrl: 'https://jwks.test/keys' },
      createDedup(),
      { nowEpochSeconds: () => 1_784_451_600 },
    );
    await expect(
      defaultVerifier.verifyAndMap({
        rawBody,
        headers: {
          'x-fal-webhook-request-id': requestId,
          'x-fal-webhook-user-id': userId,
          'x-fal-webhook-timestamp': timestamp,
          'x-fal-webhook-signature': signatureHex,
        },
      }),
    ).resolves.toMatchObject({ eventId: requestId });
    expect(defaultFetch).toHaveBeenCalledOnce();
  });
});

class RecordingOutbox implements ProviderOutboxPort {
  readonly submissions: ProviderSubmission[] = [];
  readonly ambiguities: ProviderError[] = [];
  readonly failures: ProviderError[] = [];
  readonly published: unknown[] = [];

  constructor(
    private readonly events: readonly PendingProviderOutboxEvent[],
    private readonly existing: ProviderSubmission | null = null,
  ) {}

  async claimPending(limit: number): Promise<readonly PendingProviderOutboxEvent[]> {
    return this.events.slice(0, limit);
  }

  async findSubmissionByBillingKey(): Promise<ProviderSubmission | null> {
    return this.existing;
  }

  async recordSubmission(
    _event: PendingProviderOutboxEvent,
    result: ProviderSubmission,
  ): Promise<void> {
    this.submissions.push(result);
  }

  async recordAmbiguity(_event: PendingProviderOutboxEvent, error: ProviderError): Promise<void> {
    this.ambiguities.push(error);
  }

  async recordFailure(_event: PendingProviderOutboxEvent, error: ProviderError): Promise<void> {
    this.failures.push(error);
  }

  async markPublished(_event: PendingProviderOutboxEvent, result: unknown): Promise<void> {
    this.published.push(result);
  }
}

const outboxEvent: PendingProviderOutboxEvent = {
  eventId: 'outbox-fixture-001',
  workspaceId: 'workspace-fixture-001',
  runId: 'run-fixture-001',
  attemptId: 'attempt-fixture-001',
  providerRegistrationId: 'provider-registration-fixture-001',
  routeId: falFlux2ProDescriptor.routeId,
  billingIdempotencyKey: 'billing-outbox-fixture-001',
  payload: { prompt: 'Fixture master.' },
  executionPlanLine: { node_id: 'master-1' },
};

const successfulSubmission: ProviderSubmission = {
  provider: 'fal',
  routeId: falFlux2ProDescriptor.routeId,
  providerJobId: 'fal-job-fixture-001',
  state: 'queued',
};

function driverWith(implementation: () => Promise<ProviderSubmission>): VersionedProviderDriver {
  return { descriptor: enabled(falFlux2ProDescriptor), submit: implementation };
}

describe('outbox dispatcher', () => {
  it('submits and records a pending event exactly once', async () => {
    const outbox = new RecordingOutbox([outboxEvent]);
    const submit = vi.fn().mockResolvedValue(successfulSubmission);
    const summary = await new OutboxDispatcher([driverWith(submit)], outbox).dispatchPending(10);
    expect(summary).toEqual({
      claimed: 1,
      submitted: 1,
      replayed: 0,
      reconciliationRequired: 0,
      failed: 0,
    });
    expect(submit).toHaveBeenCalledWith({
      billingIdempotencyKey: outboxEvent.billingIdempotencyKey,
      payload: outboxEvent.payload,
    });
    expect(outbox.submissions).toEqual([successfulSubmission]);
  });

  it('replays by billing idempotency key without provider submission', async () => {
    const outbox = new RecordingOutbox([outboxEvent], successfulSubmission);
    const submit = vi.fn();
    const summary = await new OutboxDispatcher([driverWith(submit)], outbox).dispatchPending(10);
    expect(summary.replayed).toBe(1);
    expect(submit).not.toHaveBeenCalled();
    expect(outbox.published).toEqual([successfulSubmission]);
  });

  it('records ambiguous submit for reconciliation and does not retry blindly', async () => {
    const outbox = new RecordingOutbox([outboxEvent]);
    const driver = driverWith(() =>
      Promise.reject(new ProviderError('ambiguous_submit', 'fixture ambiguity', false)),
    );
    const summary = await new OutboxDispatcher([driver], outbox).dispatchPending(10);
    expect(summary.reconciliationRequired).toBe(1);
    expect(outbox.ambiguities).toHaveLength(1);
    expect(outbox.published).toEqual([{ reconciliationRequired: true }]);
  });

  it('records non-ambiguous failures and unknown routes without publishing', async () => {
    const failedOutbox = new RecordingOutbox([outboxEvent]);
    const driver = driverWith(() =>
      Promise.reject(new ProviderError('rate_limited', 'fixture rate limit', true)),
    );
    const failed = await new OutboxDispatcher([driver], failedOutbox).dispatchPending(10);
    expect(failed.failed).toBe(1);
    expect(failedOutbox.published).toHaveLength(0);

    const unknownEvent = { ...outboxEvent, routeId: 'fixture/unknown-route' };
    const unknownOutbox = new RecordingOutbox([unknownEvent]);
    const unknown = await new OutboxDispatcher([], unknownOutbox).dispatchPending(10);
    expect(unknown.failed).toBe(1);
    expect(unknownOutbox.failures[0]).toMatchObject({ code: 'provider_error' });
  });
});

describe('provider status reconciliation', () => {
  it('polls submitted and resolvable unknown jobs without submitting again', async () => {
    const jobs: readonly PendingProviderReconciliationJob[] = [
      {
        providerJobId: 'job-row-1',
        provider: 'fal',
        routeId: falFlux2ProDescriptor.routeId,
        providerRequestId: 'fal-request-queued',
        status: 'submitted',
      },
      {
        providerJobId: 'job-row-2',
        provider: 'fal',
        routeId: falFlux2ProDescriptor.routeId,
        providerRequestId: 'fal-request-unknown',
        status: 'unknown',
      },
    ];
    const statuses: ProviderJobStatus[] = [];
    const failures: ProviderError[] = [];
    const reconciliation: ProviderReconciliationPort = {
      listPending: async () => jobs,
      recordStatus: async (_job, status) => {
        statuses.push(status);
      },
      recordFailure: async (_job, error) => {
        failures.push(error);
      },
    };
    const status = vi
      .fn<(providerJobId: string) => Promise<ProviderJobStatus>>()
      .mockResolvedValueOnce({
        state: 'queued',
        providerJobId: 'fal-request-queued',
      })
      .mockResolvedValueOnce({
        state: 'running',
        providerJobId: 'fal-request-unknown',
      });
    const submit = vi.fn();
    const driver: VersionedProviderDriver = {
      descriptor: enabled(falFlux2ProDescriptor),
      submit,
      status,
    };

    await expect(
      new ProviderReconciler([driver], reconciliation).reconcilePending(10),
    ).resolves.toEqual({ checked: 2, updated: 2, failed: 0 });
    expect(status).toHaveBeenCalledTimes(2);
    expect(statuses.map((entry) => entry.state)).toEqual(['queued', 'running']);
    expect(failures).toHaveLength(0);
    expect(submit).not.toHaveBeenCalled();
  });
});
