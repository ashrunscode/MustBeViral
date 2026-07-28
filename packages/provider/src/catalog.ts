import type { DriverDescriptor } from './types';

const CLOSED_GATES = {
  priceConfirmed: false,
  retentionCleared: false,
} as const;

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

export const falSeedanceLiteDescriptor = {
  descriptorVersion: '2026-07-19.1',
  driverVersion: '1.0.0',
  provider: 'fal',
  routeId: 'fal/seedance-1.0-lite/motion',
  modelId: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
  endpoint: 'https://queue.fal.run/fal-ai/bytedance/seedance/v1/lite/image-to-video',
  price: { kind: 'video_second', perSecondMicros: 39_000, resolution: '720p' },
  capabilities: {
    family: 'video',
    tasks: ['image_to_video', 'motion_clip_9_16'],
    inputSchemaVersion: 'fal.seedance-1-lite.input.v1',
    outputSchemaVersion: 'fal.video.output.v1',
  },
  enableGates: CLOSED_GATES,
  idempotencyPolicy: 'reconcile_ambiguous',
} as const satisfies DriverDescriptor;

export const launchDriverDescriptors = [
  moonshotKimiK26Descriptor,
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceLiteDescriptor,
] as const;
