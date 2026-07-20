import { z } from 'zod';

const IdentifierSchema = z.string().min(1).max(200);
const IdempotencyKeySchema = z.string().min(1).max(200);
const TimestampSchema = z.iso.datetime({ offset: true });

export const HandlerContextSchema = z
  .object({
    workspace_id: IdentifierSchema,
    actor_id: IdentifierSchema,
    request_id: z.string().min(1).max(200),
  })
  .strict();

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export const GraphNodeSchema = z
  .object({
    id: IdentifierSchema,
    kind: z.enum([
      'brief',
      'brand_context',
      'planner_text',
      'image_generation',
      'image_edit',
      'video_generation',
      'qa',
      'output_export',
      'group',
    ]),
    parameter_schema_version: z.number().int().positive(),
    parameters: z.record(z.string(), JsonValueSchema),
  })
  .strict();

export const GraphEdgeSchema = z
  .object({
    id: IdentifierSchema,
    kind: z.literal('dependency'),
    source_node_id: IdentifierSchema,
    target_node_id: IdentifierSchema,
  })
  .strict();

export const GraphSnapshotSchema = z
  .object({ nodes: z.array(GraphNodeSchema), edges: z.array(GraphEdgeSchema) })
  .strict();

export const GraphPatchSchema = z
  .object({
    upsert_nodes: z.array(GraphNodeSchema).default([]),
    remove_node_ids: z.array(IdentifierSchema).default([]),
    upsert_edges: z.array(GraphEdgeSchema).default([]),
    remove_edge_ids: z.array(IdentifierSchema).default([]),
  })
  .strict();

export const ApplyCanvasPatchInputSchema = z
  .object({
    context: HandlerContextSchema,
    canvas_id: IdentifierSchema,
    expected_revision_id: IdentifierSchema,
    reason: z.string().min(1).max(500),
    patch: GraphPatchSchema,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const ValidateGraphInputSchema = z
  .object({ context: HandlerContextSchema, canvas_id: IdentifierSchema })
  .strict();

export const QuoteRunInputSchema = z
  .object({
    context: HandlerContextSchema,
    canvas_id: IdentifierSchema,
    expected_revision_id: IdentifierSchema,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const StartRunInputSchema = z
  .object({
    context: HandlerContextSchema,
    quote_id: IdentifierSchema,
    confirmed: z.literal(true),
    confirmation_token: z.string().min(16).max(500),
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const GetRunInputSchema = z
  .object({ context: HandlerContextSchema, run_id: IdentifierSchema })
  .strict();

export const GetCanvasContextInputSchema = z
  .object({ context: HandlerContextSchema, canvas_id: IdentifierSchema })
  .strict();

export const CancelRunInputSchema = z
  .object({
    context: HandlerContextSchema,
    run_id: IdentifierSchema,
    reason: z.string().min(1).max(500),
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const RegisterArtifactInputSchema = z
  .object({
    context: HandlerContextSchema,
    run_id: IdentifierSchema,
    run_node_id: IdentifierSchema.nullable(),
    artifact_id: IdentifierSchema,
    kind: z.string().min(1).max(100),
    object_key: z.string().min(1).max(1024),
    content_type: z.string().min(1).max(200),
    byte_size: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const RegisterArtifactLineageInputSchema = z
  .object({
    context: HandlerContextSchema,
    parent_artifact_id: IdentifierSchema,
    child_artifact_id: IdentifierSchema,
    relation: z.string().min(1).max(100),
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export type HandlerContext = z.infer<typeof HandlerContextSchema>;
export type GraphPatch = z.infer<typeof GraphPatchSchema>;
export type ApplyCanvasPatchInput = z.input<typeof ApplyCanvasPatchInputSchema>;
export type ValidateGraphInput = z.infer<typeof ValidateGraphInputSchema>;
export type QuoteRunInput = z.infer<typeof QuoteRunInputSchema>;
export type StartRunInput = z.infer<typeof StartRunInputSchema>;
export type GetRunInput = z.infer<typeof GetRunInputSchema>;
export type GetCanvasContextInput = z.infer<typeof GetCanvasContextInputSchema>;
export type CancelRunInput = z.infer<typeof CancelRunInputSchema>;
export type RegisterArtifactInput = z.infer<typeof RegisterArtifactInputSchema>;
export type RegisterArtifactLineageInput = z.infer<typeof RegisterArtifactLineageInputSchema>;

export { IdempotencyKeySchema, IdentifierSchema, TimestampSchema };
