import { z } from 'zod';

export const API_SCHEMA_VERSION = '2026-07-12' as const;
export const SERVICE_GENERATION = 'viralgraph-cleanroom-v2' as const;

export const RequestIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

/** Postgres timestamptz on the wire, including microsecond precision and explicit offsets. */
export const WireTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u,
    'Invalid timestamptz',
  );

export const HealthResponseSchema = z
  .object({
    schema_version: z.literal(API_SCHEMA_VERSION),
    service: z.literal('mustbeviral-core'),
    generation: z.literal(SERVICE_GENERATION),
    status: z.literal('ok'),
    request_id: RequestIdSchema,
  })
  .strict();

export const ApiErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    request_id: RequestIdSchema,
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const ApiErrorEnvelopeSchema = z
  .object({
    error: ApiErrorSchema,
  })
  .strict();

export const ApiSuccessEnvelopeSchema = z
  .object({
    data: z.unknown(),
    meta: z
      .object({
        request_id: RequestIdSchema,
      })
      .strict(),
  })
  .strict();

export function createApiSuccessEnvelopeSchema<DataSchema extends z.ZodType>(
  dataSchema: DataSchema,
) {
  return z
    .object({
      data: dataSchema,
      meta: z
        .object({
          request_id: RequestIdSchema,
        })
        .strict(),
    })
    .strict();
}

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
export type ApiSuccessEnvelope<Data = unknown> = Readonly<{
  data: Data;
  meta: Readonly<{ request_id: string }>;
}>;

export function createApiError(input: ApiError): ApiError {
  return ApiErrorSchema.parse(input);
}

export function createApiErrorEnvelope(input: ApiError): ApiErrorEnvelope {
  return ApiErrorEnvelopeSchema.parse({ error: input });
}
