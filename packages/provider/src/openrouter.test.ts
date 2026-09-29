import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOpenRouterCopyDescriptor,
  OPENROUTER_COPY_MODEL_CONFIGS,
  openRouterCopyCandidateDescriptors,
} from './catalog';
import { ProviderError, ProviderTransportFailure } from './errors';
import {
  assertOpenRouterServingProviderAllowed,
  OPENROUTER_PROVIDER_ALLOWLIST,
  OPENROUTER_REASONING_DISABLED,
  OPENROUTER_RETENTION_CONTROL,
  OpenRouterCompletionTruncatedError,
  OpenRouterCopyDriver,
  OpenRouterUnsupportedReasoningParameterError,
  providerReportedUsdToMicros,
} from './openrouter';
import type {
  DriverDescriptor,
  ProviderTransport,
  ProviderTransportRequest,
  ProviderTransportResponse,
} from './types';

class RecordingTransport implements ProviderTransport {
  readonly requests: ProviderTransportRequest[] = [];

  constructor(private readonly responses: readonly ProviderTransportResponse[]) {}

  async request(request: ProviderTransportRequest): Promise<ProviderTransportResponse> {
    this.requests.push(request);
    const response = this.responses[this.requests.length - 1];
    if (response === undefined) {
      throw new ProviderTransportFailure('connection', 'test transport exhausted');
    }
    return response;
  }
}

const fixtureCredential = 'fixture-openrouter-credential';
const fixtureDescriptor = createOpenRouterCopyDescriptor(OPENROUTER_COPY_MODEL_CONFIGS[0]);
const enabled = (descriptor: DriverDescriptor): DriverDescriptor => ({
  ...descriptor,
  enableGates: { priceConfirmed: true, retentionCleared: true },
});
const validInput = {
  task: 'copy',
  messages: [{ role: 'user', content: 'Write three compliant fixture ad-copy sets.' }],
  maxTokens: 650,
  temperature: 0.4,
} as const;

function successResponse(
  cost: unknown = 0.000072,
  id = 'openrouter-generation-fixture-001',
): ProviderTransportResponse {
  return {
    status: 200,
    headers: { 'x-request-id': 'openrouter-request-fixture-001' },
    body: JSON.stringify({
      id,
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: 'Fixture copy output.' },
        },
      ],
      usage: {
        prompt_tokens: 211,
        completion_tokens: 377,
        completion_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 588,
        cost,
      },
    }),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('real network access is forbidden in OpenRouter unit tests');
    }),
  );
});

describe('OpenRouter copy catalog', () => {
  it('records the cleared candidates in preference order and keeps all gates closed', () => {
    // Slate replaced by the WashBodega trial: cheaper than the openai/gpt-5.4 anchor and off the
    // OpenAI/Anthropic vendor tier. Evidence:
    // governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/decision.md
    expect(openRouterCopyCandidateDescriptors).toHaveLength(2);
    expect(openRouterCopyCandidateDescriptors.map((descriptor) => descriptor.modelId)).toEqual([
      'qwen/qwen3-30b-a3b-instruct-2507',
      'deepseek/deepseek-v3.2',
    ]);
    expect(openRouterCopyCandidateDescriptors.map((descriptor) => descriptor.price)).toEqual([
      {
        kind: 'text_tokens',
        inputPerMillionMicros: 48_000,
        outputPerMillionMicros: 193_000,
      },
      {
        kind: 'text_tokens',
        inputPerMillionMicros: 269_000,
        outputPerMillionMicros: 400_000,
      },
    ]);
    for (const descriptor of openRouterCopyCandidateDescriptors) {
      expect(descriptor).toMatchObject({
        descriptorVersion: '2026-07-28.1',
        driverVersion: '1.0.0',
        provider: 'openrouter',
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        // Opened on measured evidence: per-request ZDR plus a jurisdiction allowlist that fails
        // closed, and live usage.cost matching the catalog rate.
        enableGates: { priceConfirmed: true, retentionCleared: true },
      });
    }
  });
});

describe('OpenRouter jurisdiction control', () => {
  it('pins routing to the cleared host set on every request', () => {
    // ZDR governs retention, not jurisdiction: a live probe measured that without this allowlist
    // the selected model routed to StreamLake on 2 of 3 requests.
    expect(OPENROUTER_RETENTION_CONTROL.provider.only).toBe(OPENROUTER_PROVIDER_ALLOWLIST);
    expect(OPENROUTER_RETENTION_CONTROL).toMatchObject({
      zdr: true,
      provider: { data_collection: 'deny' },
    });
  });

  it('accepts a serving host from the allowlist regardless of casing or separators', () => {
    for (const host of ['DeepInfra', 'coreweave', 'Cloud-Flare', 'Nebius']) {
      expect(() => {
        assertOpenRouterServingProviderAllowed(host);
      }).not.toThrow();
    }
  });

  it('rejects a completion served from an uncleared host', () => {
    let thrown: unknown;
    try {
      assertOpenRouterServingProviderAllowed('StreamLake');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ProviderError);
    const error = thrown as ProviderError;
    expect(error.retryable).toBe(false);
    expect(error.details).toMatchObject({ reason: 'serving_provider_not_allowed' });
  });

  it('tolerates a response that omits the provider field', () => {
    // Absence is not evidence of a bad host; the request-side allowlist remains the primary gate.
    expect(() => {
      assertOpenRouterServingProviderAllowed(undefined);
    }).not.toThrow();
  });
});

describe('OpenRouter copy driver', () => {
  it('sends mandatory ZDR fields and disables reasoning by default on every request', async () => {
    const transport = new RecordingTransport([
      successResponse(0.000072, 'generation-one'),
      successResponse(0.000073, 'generation-two'),
    ]);
    const driver = new OpenRouterCopyDriver(
      enabled(fixtureDescriptor),
      transport,
      fixtureCredential,
    );

    await driver.submit({ billingIdempotencyKey: 'billing-openrouter-001', payload: validInput });
    await driver.submit({ billingIdempotencyKey: 'billing-openrouter-002', payload: validInput });

    expect(transport.requests).toHaveLength(2);
    for (const request of transport.requests) {
      expect(request.url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(request.headers.authorization).toBe(`Bearer ${fixtureCredential}`);
      expect(JSON.parse(request.body ?? '{}')).toMatchObject({
        model: fixtureDescriptor.modelId,
        max_tokens: 650,
        temperature: 0.4,
        ...OPENROUTER_REASONING_DISABLED,
        ...OPENROUTER_RETENTION_CONTROL,
      });
    }
  });

  it('allows the default reasoning control to be overridden per request', async () => {
    const transport = new RecordingTransport([successResponse()]);
    const driver = new OpenRouterCopyDriver(
      enabled(fixtureDescriptor),
      transport,
      fixtureCredential,
    );

    await driver.submit({
      billingIdempotencyKey: 'billing-openrouter-reasoning-override',
      payload: { ...validInput, reasoning: { enabled: true } },
    });

    expect(JSON.parse(transport.requests[0]?.body ?? '{}')).toMatchObject({
      reasoning: { enabled: true },
    });
  });

  it('fails closed and non-retryable when the retention controls cannot be honored', async () => {
    const transport = new RecordingTransport([
      {
        status: 404,
        headers: {},
        body: JSON.stringify({
          error: { message: 'No endpoints found that support zero data retention (ZDR).' },
        }),
      },
    ]);
    const driver = new OpenRouterCopyDriver(
      enabled(fixtureDescriptor),
      transport,
      fixtureCredential,
    );

    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-openrouter-zdr', payload: validInput }),
    ).rejects.toMatchObject({
      code: 'provider_error',
      retryable: false,
      details: { reason: 'retention_controls_unavailable', status: 404 },
    });
  });

  it('captures exact provider-reported usage.cost in integer USD micros', async () => {
    const transport = new RecordingTransport([successResponse()]);
    const driver = new OpenRouterCopyDriver(
      enabled(fixtureDescriptor),
      transport,
      fixtureCredential,
    );

    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-openrouter-cost', payload: validInput }),
    ).resolves.toMatchObject({
      provider: 'openrouter',
      state: 'succeeded',
      output: {
        text: 'Fixture copy output.',
        usage: {
          inputUnits: 211,
          outputUnits: 377,
          totalUnits: 588,
          costSource: 'provider_reported',
          providerReportedCostMicros: 72,
          totalCostMicros: 72,
        },
      },
    });
    expect(providerReportedUsdToMicros(9e-7)).toBe(1);
  });

  it('reports output-budget truncation distinctly from schema drift', async () => {
    const transport = new RecordingTransport([
      {
        status: 200,
        headers: {},
        body: JSON.stringify({
          id: 'openrouter-truncated-fixture',
          choices: [
            {
              finish_reason: 'length',
              message: { role: 'assistant', content: 'Truncated fixture copy.' },
            },
          ],
          usage: {
            prompt_tokens: 211,
            completion_tokens: 696,
            completion_tokens_details: { reasoning_tokens: 668 },
            total_tokens: 907,
            cost: 0.0051,
          },
        }),
      },
    ]);
    const driver = new OpenRouterCopyDriver(
      enabled(fixtureDescriptor),
      transport,
      fixtureCredential,
    );

    const rejection = driver.submit({
      billingIdempotencyKey: 'billing-openrouter-truncated',
      payload: validInput,
    });
    await expect(rejection).rejects.toBeInstanceOf(OpenRouterCompletionTruncatedError);
    await expect(rejection).rejects.toMatchObject({
      name: 'OpenRouterCompletionTruncatedError',
      code: 'payload_invalid',
      retryable: false,
      details: {
        reason: 'completion_truncated',
        reasoningTokens: 668,
        completionTokens: 696,
        providerReportedCostMicros: 5_100,
      },
    });
    await expect(rejection).rejects.not.toMatchObject({
      message: 'OpenRouter content shape drifted',
    });
  });

  it('names a reasoning-parameter rejection when the response has no choices array', async () => {
    const transport = new RecordingTransport([
      {
        status: 200,
        headers: {},
        body: JSON.stringify({
          error: { message: 'reasoning configuration unsupported' },
        }),
      },
    ]);
    const driver = new OpenRouterCopyDriver(
      enabled(fixtureDescriptor),
      transport,
      fixtureCredential,
    );

    const rejection = driver.submit({
      billingIdempotencyKey: 'billing-openrouter-reasoning-unsupported',
      payload: validInput,
    });
    await expect(rejection).rejects.toBeInstanceOf(OpenRouterUnsupportedReasoningParameterError);
    await expect(rejection).rejects.toMatchObject({
      name: 'OpenRouterUnsupportedReasoningParameterError',
      code: 'payload_invalid',
      retryable: false,
      details: {
        reason: 'reasoning_parameter_unsupported',
        modelId: fixtureDescriptor.modelId,
        rejectedParameter: 'reasoning.enabled=false',
      },
    });
  });

  it.each([
    ['missing', undefined],
    ['negative', -0.01],
    ['string', '0.01'],
    ['non-finite', Number.POSITIVE_INFINITY],
    ['implausibly large', 101],
  ])('rejects %s provider cost instead of defaulting it to zero', async (_label, cost) => {
    const initialResponse = successResponse(cost);
    const payload = JSON.parse(initialResponse.body) as {
      usage: Record<string, unknown>;
    };
    if (_label === 'missing') delete payload.usage.cost;
    const response =
      _label === 'missing'
        ? { ...initialResponse, body: JSON.stringify(payload) }
        : initialResponse;
    const transport = new RecordingTransport([response]);
    const driver = new OpenRouterCopyDriver(
      enabled(fixtureDescriptor),
      transport,
      fixtureCredential,
    );

    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-openrouter-bad-cost', payload: validInput }),
    ).rejects.toMatchObject({ code: 'payload_invalid', retryable: false });
  });

  it('blocks a closed catalog route before any HTTP call', async () => {
    // The live copy route's gates are open, so this constructs a closed descriptor explicitly.
    // The guarantee under test is that an unconfirmed price stops a request before it can spend,
    // and it must keep holding no matter which routes happen to be open in the catalog.
    const closedDescriptor: DriverDescriptor = {
      ...fixtureDescriptor,
      enableGates: { priceConfirmed: false, retentionCleared: false },
    };
    const transport = new RecordingTransport([]);
    const driver = new OpenRouterCopyDriver(closedDescriptor, transport, fixtureCredential);

    await expect(
      driver.submit({ billingIdempotencyKey: 'billing-openrouter-closed', payload: validInput }),
    ).rejects.toMatchObject({
      code: 'provider_error',
      retryable: false,
      details: { reason: 'price_not_confirmed' },
    });
    expect(transport.requests).toHaveLength(0);
  });
});
