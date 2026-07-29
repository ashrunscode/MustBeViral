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

/**
 * Inference hosts cleared to serve copy. Zero-data-retention constrains whether an upstream
 * *keeps* the payload; it says nothing about *where* inference runs. A 2026-07-28 live probe
 * measured that with `zdr: true` and `data_collection: 'deny'` and no allowlist, routing landed
 * on StreamLake for 2 of 3 requests, so jurisdiction has to be pinned separately.
 *
 * The same probe confirmed the control fails closed: an unsatisfiable allowlist returns HTTP 404
 * ("No allowed providers are available for the selected model.") rather than quietly falling back
 * to an uncleared host. Adding a host here is a governance decision, not a performance tweak.
 */
export const OPENROUTER_PROVIDER_ALLOWLIST = [
  'deepinfra',
  'together',
  'fireworks',
  'nebius',
  'parasail',
  'coreweave',
  'cloudflare',
] as const;

/**
 * Mandatory retention and jurisdiction control, not a routing preference. Every OpenRouter request
 * must include this complete object so an upstream that cannot deny data collection, or that sits
 * outside the cleared host set, fails closed.
 */
export const OPENROUTER_RETENTION_CONTROL = {
  zdr: true,
  provider: { data_collection: 'deny', only: OPENROUTER_PROVIDER_ALLOWLIST },
} as const;

/**
 * Measured reasoning tokens starved the copy budget, truncated output, and multiplied cost for
 * copy generation that does not need extended reasoning. Callers may override this per request.
 */
export const OPENROUTER_REASONING_DISABLED = {
  reasoning: { enabled: false },
} as const;

const MAX_PROVIDER_REPORTED_COST_MICROS = 100_000_000;

export interface OpenRouterReasoningConfig {
  readonly enabled: boolean;
}

export interface OpenRouterCopyInput {
  readonly task: 'copy';
  readonly messages: readonly Readonly<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>[];
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly reasoning?: OpenRouterReasoningConfig;
}

export interface OpenRouterCopyOutput {
  readonly text: string;
  readonly usage: Readonly<{
    meter: 'tokens';
    inputUnits: number;
    outputUnits: number;
    totalUnits: number;
    costSource: 'provider_reported';
    providerReportedCostMicros: number;
    totalCostMicros: number;
  }>;
}

export interface ParsedOpenRouterCompletion {
  readonly responseId?: string;
  readonly output: OpenRouterCopyOutput;
}

export interface OpenRouterCompletionContext {
  readonly modelId: string;
  readonly reasoning: OpenRouterReasoningConfig;
}

interface ParsedOpenRouterUsage {
  readonly inputUnits: number;
  readonly outputUnits: number;
  readonly totalUnits: number;
  readonly reasoningUnits?: number;
  readonly providerReportedCostMicros: number;
}

export class OpenRouterCompletionTruncatedError extends ProviderError {
  override readonly name = 'OpenRouterCompletionTruncatedError';

  constructor(
    context: OpenRouterCompletionContext,
    usage: ParsedOpenRouterUsage,
    finishReason: unknown,
  ) {
    const reasoningUnits = usage.reasoningUnits ?? 'unreported';
    super(
      'payload_invalid',
      `OpenRouter completion truncated for ${context.modelId}: ${reasoningUnits} reasoning tokens versus ${usage.outputUnits} completion tokens`,
      false,
      {
        reason: 'completion_truncated',
        modelId: context.modelId,
        finishReason: finishReason ?? 'unreported',
        reasoningTokens: reasoningUnits,
        completionTokens: usage.outputUnits,
        promptTokens: usage.inputUnits,
        totalTokens: usage.totalUnits,
        providerReportedCostMicros: usage.providerReportedCostMicros,
      },
    );
  }
}

export class OpenRouterUnsupportedReasoningParameterError extends ProviderError {
  override readonly name = 'OpenRouterUnsupportedReasoningParameterError';

  constructor(context: OpenRouterCompletionContext) {
    const rejectedParameter = `reasoning.enabled=${String(context.reasoning.enabled)}`;
    super(
      'payload_invalid',
      `OpenRouter model ${context.modelId} rejected ${rejectedParameter}: response contained no choices array`,
      false,
      {
        reason: 'reasoning_parameter_unsupported',
        modelId: context.modelId,
        rejectedParameter,
      },
    );
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateInput(value: unknown): OpenRouterCopyInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderError('payload_invalid', 'OpenRouter input must be an object', false);
  }
  const input = value as Readonly<Record<string, unknown>>;
  if (input.task !== 'copy') {
    throw new ProviderError('payload_invalid', 'OpenRouter task must be copy', false);
  }
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new ProviderError(
      'payload_invalid',
      'OpenRouter messages must be a non-empty array',
      false,
    );
  }
  for (const message of input.messages) {
    if (typeof message !== 'object' || message === null || Array.isArray(message)) {
      throw new ProviderError('payload_invalid', 'OpenRouter message must be an object', false);
    }
    const candidate = message as Readonly<Record<string, unknown>>;
    if (
      (candidate.role !== 'system' &&
        candidate.role !== 'user' &&
        candidate.role !== 'assistant') ||
      typeof candidate.content !== 'string' ||
      candidate.content.length === 0
    ) {
      throw new ProviderError('payload_invalid', 'OpenRouter message shape is invalid', false);
    }
  }
  if (
    input.maxTokens !== undefined &&
    (!isNonNegativeInteger(input.maxTokens) || input.maxTokens === 0)
  ) {
    throw new ProviderError(
      'payload_invalid',
      'OpenRouter maxTokens must be a positive integer',
      false,
    );
  }
  if (
    input.temperature !== undefined &&
    (typeof input.temperature !== 'number' ||
      !Number.isFinite(input.temperature) ||
      input.temperature < 0 ||
      input.temperature > 2)
  ) {
    throw new ProviderError(
      'payload_invalid',
      'OpenRouter temperature must be between 0 and 2',
      false,
    );
  }
  if (
    input.reasoning !== undefined &&
    (typeof input.reasoning !== 'object' ||
      input.reasoning === null ||
      Array.isArray(input.reasoning) ||
      typeof (input.reasoning as Readonly<Record<string, unknown>>).enabled !== 'boolean')
  ) {
    throw new ProviderError(
      'payload_invalid',
      'OpenRouter reasoning override must contain a boolean enabled field',
      false,
    );
  }
  return input as unknown as OpenRouterCopyInput;
}

export function buildOpenRouterRequestBody(
  modelId: string,
  input: OpenRouterCopyInput,
): Readonly<Record<string, unknown>> {
  if (modelId.length === 0) {
    throw new ProviderError('payload_invalid', 'OpenRouter model id is not configured', false);
  }
  return {
    model: modelId,
    messages: input.messages,
    ...(input.maxTokens === undefined ? {} : { max_tokens: input.maxTokens }),
    ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    ...OPENROUTER_REASONING_DISABLED,
    ...(input.reasoning === undefined ? {} : { reasoning: input.reasoning }),
    ...OPENROUTER_RETENTION_CONTROL,
  };
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * Converts the JSON number's canonical decimal representation using integer arithmetic.
 * Fractions smaller than one micro are rounded up so provider spend is never understated.
 */
export function providerReportedUsdToMicros(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ProviderError(
      'payload_invalid',
      'OpenRouter usage.cost must be a finite non-negative number',
      false,
    );
  }
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/u.exec(value.toString().toLowerCase());
  if (match === null) {
    throw new ProviderError('payload_invalid', 'OpenRouter usage.cost shape drifted', false);
  }
  const whole = match[1];
  const fraction = match[2] ?? '';
  const exponent = Number(match[3] ?? '0');
  if (whole === undefined || !Number.isSafeInteger(exponent)) {
    throw new ProviderError('payload_invalid', 'OpenRouter usage.cost shape drifted', false);
  }
  const coefficient = BigInt(`${whole}${fraction}`);
  const decimalPlaces = fraction.length - exponent;
  const numerator = coefficient * 1_000_000n;
  const micros =
    decimalPlaces <= 0
      ? numerator * powerOfTen(-decimalPlaces)
      : (numerator + powerOfTen(decimalPlaces) - 1n) / powerOfTen(decimalPlaces);
  if (micros > BigInt(MAX_PROVIDER_REPORTED_COST_MICROS)) {
    throw new ProviderError(
      'payload_invalid',
      'OpenRouter usage.cost is implausibly large',
      false,
      { maxCostMicros: MAX_PROVIDER_REPORTED_COST_MICROS },
    );
  }
  return Number(micros);
}

function responseSignalsRetentionFailure(status: number, body: string): boolean {
  let payloadText = body;
  try {
    const payload = JSON.parse(body) as unknown;
    if (typeof payload === 'object' && payload !== null) {
      const error = (payload as Readonly<Record<string, unknown>>).error;
      if (error === undefined && status >= 200 && status < 300) return false;
      payloadText = JSON.stringify(error ?? payload);
    }
  } catch {
    // The HTTP mapper handles malformed JSON. The raw text can still carry a policy failure.
  }
  const normalized = payloadText.toLowerCase();
  return (
    normalized.includes('zero data retention') ||
    normalized.includes('data_collection') ||
    normalized.includes('data collection') ||
    /\bzdr\b/u.test(normalized) ||
    (normalized.includes('retention') &&
      (normalized.includes('cannot') ||
        normalized.includes('unable') ||
        normalized.includes('unsupported') ||
        normalized.includes('no endpoint')))
  );
}

export function assertOpenRouterRetentionConstraintsHonored(status: number, body: string): void {
  if (!responseSignalsRetentionFailure(status, body)) return;
  throw new ProviderError(
    'provider_error',
    'OpenRouter could not honor the mandatory retention controls',
    false,
    {
      reason: 'retention_controls_unavailable',
      status,
    },
  );
}

/**
 * Defence in depth behind the request-side allowlist. The request already pins `provider.only`,
 * so this should never fire; it exists because the allowlist is a routing *instruction* and the
 * serving host is the only *evidence* of where the payload actually went. A silent widening
 * upstream would otherwise be indistinguishable from the control working.
 */
export function assertOpenRouterServingProviderAllowed(servedBy: unknown): void {
  if (servedBy === undefined || servedBy === null) return;
  if (typeof servedBy !== 'string' || servedBy.length === 0) {
    throw new ProviderError('payload_invalid', 'OpenRouter provider shape drifted', false);
  }
  const normalized = servedBy.toLowerCase().replaceAll(/[\s_-]/gu, '');
  const allowed = OPENROUTER_PROVIDER_ALLOWLIST.some(
    (candidate) => candidate.replaceAll(/[\s_-]/gu, '') === normalized,
  );
  if (allowed) return;
  throw new ProviderError(
    'provider_error',
    `OpenRouter served the request from an uncleared host: ${servedBy}`,
    false,
    { reason: 'serving_provider_not_allowed', servedBy },
  );
}

function parseOpenRouterUsage(usage: unknown): ParsedOpenRouterUsage {
  if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) {
    throw new ProviderError('payload_invalid', 'OpenRouter usage shape drifted', false);
  }
  const usageObject = usage as Readonly<Record<string, unknown>>;
  const inputUnits = usageObject.prompt_tokens;
  const outputUnits = usageObject.completion_tokens;
  const totalUnits = usageObject.total_tokens;
  if (
    !isNonNegativeInteger(inputUnits) ||
    !isNonNegativeInteger(outputUnits) ||
    !isNonNegativeInteger(totalUnits)
  ) {
    throw new ProviderError('payload_invalid', 'OpenRouter token usage shape drifted', false);
  }
  const completionDetails = usageObject.completion_tokens_details;
  let reasoningUnits: number | undefined;
  if (completionDetails !== undefined) {
    if (
      typeof completionDetails !== 'object' ||
      completionDetails === null ||
      Array.isArray(completionDetails)
    ) {
      throw new ProviderError(
        'payload_invalid',
        'OpenRouter completion token details shape drifted',
        false,
      );
    }
    const reportedReasoningUnits = (completionDetails as Readonly<Record<string, unknown>>)
      .reasoning_tokens;
    if (reportedReasoningUnits !== undefined) {
      if (!isNonNegativeInteger(reportedReasoningUnits)) {
        throw new ProviderError(
          'payload_invalid',
          'OpenRouter reasoning token usage shape drifted',
          false,
        );
      }
      reasoningUnits = reportedReasoningUnits;
    }
  }
  const providerReportedCostMicros = providerReportedUsdToMicros(usageObject.cost);
  return {
    inputUnits,
    outputUnits,
    totalUnits,
    ...(reasoningUnits === undefined ? {} : { reasoningUnits }),
    providerReportedCostMicros,
  };
}

export function parseOpenRouterCompletion(
  body: string,
  context: OpenRouterCompletionContext,
): ParsedOpenRouterCompletion {
  const payload = parseJsonObject(body, 'openrouter');
  assertOpenRouterServingProviderAllowed(payload.provider);
  const choices = payload.choices;
  if (!Array.isArray(choices)) {
    throw new OpenRouterUnsupportedReasoningParameterError(context);
  }
  if (choices.length !== 1) {
    throw new ProviderError('payload_invalid', 'OpenRouter choices shape drifted', false);
  }
  const choice = choices[0];
  if (typeof choice !== 'object' || choice === null || Array.isArray(choice)) {
    throw new ProviderError('payload_invalid', 'OpenRouter choice shape drifted', false);
  }
  const choiceObject = choice as Readonly<Record<string, unknown>>;
  const message = choiceObject.message;
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    throw new ProviderError('payload_invalid', 'OpenRouter message shape drifted', false);
  }
  const usage = parseOpenRouterUsage(payload.usage);
  const text = (message as Readonly<Record<string, unknown>>).content;
  const finishReason = choiceObject.finish_reason;
  const contentIsEmpty = text === null || (typeof text === 'string' && text.trim().length === 0);
  if (finishReason === 'length' || (contentIsEmpty && usage.outputUnits > 0)) {
    throw new OpenRouterCompletionTruncatedError(context, usage, finishReason);
  }
  if (typeof text !== 'string' || text.length === 0) {
    throw new ProviderError('payload_invalid', 'OpenRouter content shape drifted', false);
  }
  const responseId = payload.id;
  if (responseId !== undefined && (typeof responseId !== 'string' || responseId.length === 0)) {
    throw new ProviderError('payload_invalid', 'OpenRouter response id shape drifted', false);
  }
  return {
    ...(responseId === undefined ? {} : { responseId }),
    output: {
      text,
      usage: {
        meter: 'tokens',
        inputUnits: usage.inputUnits,
        outputUnits: usage.outputUnits,
        totalUnits: usage.totalUnits,
        costSource: 'provider_reported',
        providerReportedCostMicros: usage.providerReportedCostMicros,
        totalCostMicros: usage.providerReportedCostMicros,
      },
    },
  };
}

export class OpenRouterCopyDriver implements VersionedProviderDriver {
  constructor(
    readonly descriptor: DriverDescriptor,
    private readonly transport: ProviderTransport,
    private readonly credential: string | undefined,
    private readonly enablement: ProviderEnablementPort = descriptorGateEnablement,
  ) {}

  async submit(input: ProviderSubmitInput): Promise<ProviderSubmission> {
    const credential = requireCredential(this.credential, 'openrouter');
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
        body: JSON.stringify(buildOpenRouterRequestBody(this.descriptor.modelId, normalized)),
        timeoutMs: 30_000,
      });
    } catch (cause) {
      if (cause instanceof ProviderTransportFailure && cause.kind === 'timeout') {
        throw new ProviderError('timeout', 'OpenRouter request timed out', true, {}, { cause });
      }
      throw new ProviderError('provider_error', 'OpenRouter transport failed', true, {}, { cause });
    }
    assertOpenRouterRetentionConstraintsHonored(response.status, response.body);
    if (response.status < 200 || response.status >= 300) {
      throw errorFromHttpStatus('openrouter', response.status, response.body);
    }
    const parsed = parseOpenRouterCompletion(response.body, {
      modelId: this.descriptor.modelId,
      reasoning: normalized.reasoning ?? OPENROUTER_REASONING_DISABLED.reasoning,
    });
    const providerRequestId = response.headers['x-request-id'] ?? parsed.responseId;
    return {
      provider: 'openrouter',
      routeId: this.descriptor.routeId,
      providerJobId: providerRequestId ?? input.billingIdempotencyKey,
      ...(providerRequestId === undefined ? {} : { providerRequestId }),
      state: 'succeeded',
      output: parsed.output,
    };
  }
}
