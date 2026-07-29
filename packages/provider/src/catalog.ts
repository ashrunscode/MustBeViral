import type { DriverDescriptor } from './types';

const CLOSED_GATES = {
  priceConfirmed: false,
  retentionCleared: false,
} as const;

export interface OpenRouterCopyModelConfig {
  readonly modelId: string;
  readonly inputPerMillionMicros: number;
  readonly outputPerMillionMicros: number;
}

/**
 * Copy models cleared by the WashBodega trial, in documented preference order. Evidence:
 * governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/decision.md
 *
 * The selected model is 55x cheaper than the openai/gpt-5.4 anchor it replaces, but cost is not
 * why it won: copy is roughly 0.04% of pack cost, so the switch saves about $0.0126 per pack. It
 * was selected as the best of the cheap slate on craft, not the cheapest of it - qwen3.7-flash was
 * 35% cheaper again and was disqualified for shipping copy sets with no hook field.
 */
export const OPENROUTER_COPY_MODEL_CONFIGS = [
  {
    modelId: 'qwen/qwen3-30b-a3b-instruct-2507',
    inputPerMillionMicros: 48_000,
    outputPerMillionMicros: 193_000,
  },
  {
    modelId: 'deepseek/deepseek-v3.2',
    inputPerMillionMicros: 269_000,
    outputPerMillionMicros: 400_000,
  },
] as const satisfies readonly OpenRouterCopyModelConfig[];

/**
 * Disqualified candidates, kept as a record so a future slate does not re-test them blind.
 *
 * - google/gemini-3.6-flash: a max_tokens=700 probe spent 668 of 696 completion tokens on
 *   reasoning, truncated the copy, and cost roughly 10x the viable candidates. It then rejected
 *   reasoning.enabled=false by returning no choices array.
 * - qwen/qwen3.7-flash: cheapest measured candidate, but omitted the required Hook field from
 *   three copy sets and attested in its compliance notes to an edit it never made.
 * - z-ai/glm-4.7-flash: invented an unsupported turnaround claim and misplaced the store in
 *   "West Houston" when it is Southwest Houston - a claims-discipline failure, not a style one.
 * - mistralai/mistral-small-3.2-24b-instruct: produced three near-identical angles and wrapped
 *   output in a code fence.
 * - openai/gpt-5.4 and anthropic/claude-sonnet-5: cleanest output, excluded by the vendor-tier
 *   mandate. gpt-5.4 is retained in evidence as the quality anchor for future slates.
 */

/**
 * Builds the closed descriptor for whichever candidate wins the blind copy evaluation.
 * No candidate is selected as the launch default until that evidence is reviewed.
 */
export function createOpenRouterCopyDescriptor(model: OpenRouterCopyModelConfig): DriverDescriptor {
  return {
    descriptorVersion: '2026-07-28.1',
    driverVersion: '1.0.0',
    provider: 'openrouter',
    routeId: 'openrouter/chat-completions/copy',
    modelId: model.modelId,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    price: {
      kind: 'text_tokens',
      inputPerMillionMicros: model.inputPerMillionMicros,
      outputPerMillionMicros: model.outputPerMillionMicros,
    },
    capabilities: {
      family: 'text',
      tasks: ['copy'],
      inputSchemaVersion: 'openrouter.chat-completions.input.v1',
      outputSchemaVersion: 'openrouter.chat-completions.output.v1',
    },
    enableGates: CLOSED_GATES,
    idempotencyPolicy: 'billing_key_header',
  };
}

export const openRouterCopyCandidateDescriptors = OPENROUTER_COPY_MODEL_CONFIGS.map(
  createOpenRouterCopyDescriptor,
);

/**
 * The launch copy route, pinned to the model the WashBodega trial selected.
 *
 * `routeId` is deliberately model-agnostic, so swapping the copy model later repoints
 * `provider_model_id` on the existing route rather than minting a new route key - the same shape
 * the Seedance repoint used. Moving *provider* is what forced a new key here; moving model does not.
 */
export const openRouterCopyDescriptor = createOpenRouterCopyDescriptor(
  OPENROUTER_COPY_MODEL_CONFIGS[0],
);

const FLUX_2_PRO_REDUCED_EXPOSURE_GATES = {
  // Price was confirmed and hashed into the seeded launch-catalog evidence.
  priceConfirmed: true,
  // Retention was cleared on the measured reduced-exposure basis: the delivery object is
  // short-lived and unguessable, the canonical copy is private in R2, and no provider URL
  // is persisted or exposed.
  retentionCleared: true,
} as const;

export const moonshotKimiK26Descriptor = {
  descriptorVersion: '2026-07-19.1',
  driverVersion: '1.0.0',
  provider: 'moonshot',
  routeId: 'moonshot/kimi-k2.6/chat-completions',
  modelId: 'kimi-k2.6',
  endpoint: 'https://api.moonshot.ai/v1/chat/completions',
  price: {
    kind: 'text_tokens',
    inputPerMillionMicros: 950_000,
    outputPerMillionMicros: 4_000_000,
  },
  capabilities: {
    family: 'text',
    tasks: ['planning', 'copy'],
    inputSchemaVersion: 'moonshot.chat-completions.input.v1',
    outputSchemaVersion: 'moonshot.chat-completions.output.v1',
  },
  enableGates: CLOSED_GATES,
  idempotencyPolicy: 'billing_key_header',
} as const satisfies DriverDescriptor;

export const falFlux2ProDescriptor = {
  descriptorVersion: '2026-07-19.1',
  driverVersion: '1.0.0',
  provider: 'fal',
  routeId: 'fal/flux-2-pro/masters',
  modelId: 'fal-ai/flux-2-pro',
  endpoint: 'https://queue.fal.run/fal-ai/flux-2-pro',
  price: {
    kind: 'image_megapixel_tiered',
    firstMegapixelMicros: 30_000,
    additionalMegapixelMicros: 15_000,
  },
  capabilities: {
    family: 'image',
    tasks: ['master_static'],
    inputSchemaVersion: 'fal.flux-2-pro.input.v1',
    outputSchemaVersion: 'fal.image.output.v1',
  },
  enableGates: FLUX_2_PRO_REDUCED_EXPOSURE_GATES,
  idempotencyPolicy: 'reconcile_ambiguous',
} as const satisfies DriverDescriptor;

export const falFluxKontextProDescriptor = {
  descriptorVersion: '2026-07-19.1',
  driverVersion: '1.0.0',
  provider: 'fal',
  routeId: 'fal/flux-kontext-pro/adaptations',
  modelId: 'fal-ai/flux-kontext/pro',
  endpoint: 'https://queue.fal.run/fal-ai/flux-kontext/pro',
  price: { kind: 'image_flat', perImageMicros: 40_000 },
  capabilities: {
    family: 'image',
    tasks: ['adaptation', 'reframe'],
    inputSchemaVersion: 'fal.flux-kontext-pro.input.v1',
    outputSchemaVersion: 'fal.image.output.v1',
  },
  enableGates: CLOSED_GATES,
  idempotencyPolicy: 'reconcile_ambiguous',
} as const satisfies DriverDescriptor;

/**
 * Default economy motion route.
 *
 * fal deprecated Seedance 1.0 Lite; live traffic must call Seedance 1.0 Pro Fast.
 * The catalog `routeId` stays `fal/seedance-1.0-lite/motion` so existing seeded
 * quotes/create_quote plans keep resolving; only the provider model/endpoint move.
 * Provider unit cost is pinned at 720p ($1.00 / 1M video tokens ≈ $0.022/s).
 * Retrieved 2026-07-28 from fal model page.
 */
export const falSeedanceProFastDescriptor = {
  descriptorVersion: '2026-07-28.1',
  driverVersion: '1.0.0',
  provider: 'fal',
  routeId: 'fal/seedance-1.0-lite/motion',
  modelId: 'fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
  endpoint: 'https://queue.fal.run/fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
  price: { kind: 'video_second', perSecondMicros: 22_000, resolution: '720p' },
  capabilities: {
    family: 'video',
    tasks: ['image_to_video', 'motion_clip_9_16'],
    inputSchemaVersion: 'fal.seedance-1-pro-fast.input.v1',
    outputSchemaVersion: 'fal.video.output.v1',
  },
  enableGates: CLOSED_GATES,
  idempotencyPolicy: 'reconcile_ambiguous',
} as const satisfies DriverDescriptor;

/** @deprecated Lite is retired on fal; alias kept for call-site compatibility. */
export const falSeedanceLiteDescriptor = falSeedanceProFastDescriptor;

export const launchDriverDescriptors = [
  openRouterCopyDescriptor,
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceProFastDescriptor,
] as const;
