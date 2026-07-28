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

/** Default candidates for the blind OpenRouter copy evaluation, in documented review order. */
export const OPENROUTER_COPY_MODEL_CONFIGS = [
  {
    modelId: 'google/gemini-3.5-flash-lite',
    inputPerMillionMicros: 300_000,
    outputPerMillionMicros: 2_500_000,
  },
  {
    modelId: 'openai/gpt-5.6-luna',
    inputPerMillionMicros: 500_000,
    outputPerMillionMicros: 3_000_000,
  },
  {
    modelId: 'anthropic/claude-sonnet-5',
    inputPerMillionMicros: 2_000_000,
    outputPerMillionMicros: 10_000_000,
  },
  {
    modelId: 'openai/gpt-5.4',
    inputPerMillionMicros: 2_500_000,
    outputPerMillionMicros: 15_000_000,
  },
] as const satisfies readonly OpenRouterCopyModelConfig[];

/**
 * Disqualified default candidate: google/gemini-3.6-flash.
 *
 * A live max_tokens=700 probe spent 668 of 696 completion tokens on reasoning, truncated the copy,
 * and cost roughly 10x the viable candidates. It then rejected reasoning.enabled=false by
 * returning no choices array. Keep it out until that behavior is fixed and requalified.
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
  moonshotKimiK26Descriptor,
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceProFastDescriptor,
] as const;
