import {
  errorFromHttpStatus,
  parseJsonObject,
  ProviderError,
  ProviderTransportFailure,
  requireCredential,
} from './errors';
import {
  assertRouteEnabled,
  descriptorGateEnablement,
  type DriverDescriptor,
  type ProviderEnablementPort,
  type ProviderSubmission,
  type ProviderSubmitInput,
  type ProviderTransport,
  type VersionedProviderDriver,
} from './types';

export interface MoonshotTextInput {
  readonly task: 'planning' | 'copy';
  readonly messages: readonly Readonly<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>[];
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface MoonshotTextOutput {
  readonly text: string;
  readonly usage: Readonly<{
    meter: 'tokens';
    inputUnits: number;
    outputUnits: number;
    totalUnits: number;
    inputCostMicros: number;
    outputCostMicros: number;
    totalCostMicros: number;
  }>;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateInput(value: unknown): MoonshotTextInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderError('payload_invalid', 'Moonshot input must be an object', false);
  }
  const input = value as Readonly<Record<string, unknown>>;
  if (input.task !== 'planning' && input.task !== 'copy') {
    throw new ProviderError('payload_invalid', 'Moonshot task must be planning or copy', false);
  }
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new ProviderError(
      'payload_invalid',
      'Moonshot messages must be a non-empty array',
      false,
    );
  }
  for (const message of input.messages) {
    if (typeof message !== 'object' || message === null || Array.isArray(message)) {
      throw new ProviderError('payload_invalid', 'Moonshot message must be an object', false);
    }
    const candidate = message as Readonly<Record<string, unknown>>;
    if (
      (candidate.role !== 'system' &&
        candidate.role !== 'user' &&
        candidate.role !== 'assistant') ||
      typeof candidate.content !== 'string' ||
      candidate.content.length === 0
    ) {
      throw new ProviderError('payload_invalid', 'Moonshot message shape is invalid', false);
    }
  }
  if (input.maxTokens !== undefined && (!isInteger(input.maxTokens) || input.maxTokens === 0)) {
    throw new ProviderError(
      'payload_invalid',
      'Moonshot maxTokens must be a positive integer',
      false,
    );
  }
  if (
    input.temperature !== undefined &&
    (typeof input.temperature !== 'number' || input.temperature < 0 || input.temperature > 2)
  ) {
    throw new ProviderError(
      'payload_invalid',
      'Moonshot temperature must be between 0 and 2',
      false,
    );
  }
  return input as unknown as MoonshotTextInput;
}

function parseOutput(body: string, descriptor: DriverDescriptor): MoonshotTextOutput {
  const payload = parseJsonObject(body, 'moonshot');
  const choices = payload.choices;
  const usage = payload.usage;
  if (!Array.isArray(choices) || choices.length !== 1) {
    throw new ProviderError('payload_invalid', 'Moonshot choices shape drifted', false);
  }
  const choice = choices[0];
  if (typeof choice !== 'object' || choice === null || Array.isArray(choice)) {
    throw new ProviderError('payload_invalid', 'Moonshot choice shape drifted', false);
  }
  const message = (choice as Readonly<Record<string, unknown>>).message;
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    throw new ProviderError('payload_invalid', 'Moonshot message shape drifted', false);
  }
  const text = (message as Readonly<Record<string, unknown>>).content;
  if (typeof text !== 'string' || text.length === 0) {
    throw new ProviderError('payload_invalid', 'Moonshot content shape drifted', false);
  }
  if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) {
    throw new ProviderError('payload_invalid', 'Moonshot usage shape drifted', false);
  }
  const usageObject = usage as Readonly<Record<string, unknown>>;
  const inputUnits = usageObject.prompt_tokens;
  const outputUnits = usageObject.completion_tokens;
  const totalUnits = usageObject.total_tokens;
  if (!isInteger(inputUnits) || !isInteger(outputUnits) || !isInteger(totalUnits)) {
    throw new ProviderError('payload_invalid', 'Moonshot token usage shape drifted', false);
  }
  if (descriptor.price.kind !== 'text_tokens') {
    throw new ProviderError(
      'provider_error',
      'Moonshot descriptor has the wrong price shape',
      false,
    );
  }
  const inputCostMicros = Math.ceil(
    (inputUnits * descriptor.price.inputPerMillionMicros) / 1_000_000,
  );
  const outputCostMicros = Math.ceil(
    (outputUnits * descriptor.price.outputPerMillionMicros) / 1_000_000,
  );
  return {
    text,
    usage: {
      meter: 'tokens',
      inputUnits,
      outputUnits,
      totalUnits,
      inputCostMicros,
      outputCostMicros,
      totalCostMicros: inputCostMicros + outputCostMicros,
    },
  };
}

export class MoonshotKimiK26Driver implements VersionedProviderDriver {
  constructor(
    readonly descriptor: DriverDescriptor,
    private readonly transport: ProviderTransport,
    private readonly credential: string | undefined,
    private readonly enablement: ProviderEnablementPort = descriptorGateEnablement,
  ) {}

  async submit(input: ProviderSubmitInput): Promise<ProviderSubmission> {
    const credential = requireCredential(this.credential, 'moonshot');
    assertRouteEnabled(this.descriptor, this.enablement);
    const normalized = validateInput(input.payload);
    let response;
    try {
      response = await this.transport.request({
        method: 'POST',
        url: this.descriptor.endpoint,
        headers: {
          authorization: `Bearer ${credential}`,
          'content-type': 'application/json',
          'idempotency-key': input.billingIdempotencyKey,
        },
        body: JSON.stringify({
          model: this.descriptor.modelId,
          messages: normalized.messages,
          ...(normalized.maxTokens === undefined ? {} : { max_tokens: normalized.maxTokens }),
          ...(normalized.temperature === undefined ? {} : { temperature: normalized.temperature }),
        }),
        timeoutMs: 30_000,
      });
    } catch (cause) {
      if (cause instanceof ProviderTransportFailure && cause.kind === 'timeout') {
        throw new ProviderError('timeout', 'Moonshot request timed out', true, {}, { cause });
      }
      throw new ProviderError('provider_error', 'Moonshot transport failed', true, {}, { cause });
    }
    if (response.status < 200 || response.status >= 300) {
      throw errorFromHttpStatus('moonshot', response.status, response.body);
    }
    const providerRequestId = response.headers['x-request-id'];
    return {
      provider: 'moonshot',
      routeId: this.descriptor.routeId,
      providerJobId: providerRequestId ?? input.billingIdempotencyKey,
      ...(providerRequestId === undefined ? {} : { providerRequestId }),
      state: 'succeeded',
      output: parseOutput(response.body, this.descriptor),
    };
  }
}
