import { modelPriceUnits } from '@mustbeviral/billing';
import { runNodeStates, runStates } from '@mustbeviral/domain';
import type { GraphSnapshot } from '@mustbeviral/graph';
import { z } from 'zod';

import { GraphSnapshotSchema, IdentifierSchema } from './commands';
import type {
  ApplyCanvasPatchResult,
  CancelRunResult,
  GetCanvasContextResult,
  GetRunResult,
  QuoteRunResult,
  StartRunResult,
  ValidateGraphResult,
} from './handlers';
import {
  ApiErrorEnvelopeSchema,
  createApiSuccessEnvelopeSchema,
  type ApiErrorEnvelope,
  type ApiSuccessEnvelope,
} from './http';
import type { P0RestOperation } from './rest';

const TimestampSchema = z.iso.datetime({ offset: true });
const MicrosSchema = z.number().int().nonnegative();
const WireMicrosSchema = z.string().regex(/^\d+$/u);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

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

export const GraphValidationIssueSchema = z
  .object({
    code: z.enum([
      'INVALID_SNAPSHOT',
      'INVALID_NODE',
      'INVALID_NODE_KIND',
      'INVALID_EDGE',
      'INVALID_EDGE_KIND',
      'DUPLICATE_NODE_ID',
      'DUPLICATE_EDGE_ID',
      'EDGE_ENDPOINT_NOT_FOUND',
      'SELF_EDGE',
      'ILLEGAL_EDGE',
      'CYCLE',
      'BRIEF_ROOT_REQUIRED',
      'MULTIPLE_BRIEF_ROOTS',
      'NON_BRIEF_ROOT',
      'UNREACHABLE_NODE',
    ]),
    message: z.string().min(1),
    node_id: IdentifierSchema.optional(),
    edge_id: IdentifierSchema.optional(),
  })
  .strict();

export const RunRecordSchema = z
  .object({
    runId: IdentifierSchema,
    projectId: IdentifierSchema,
    canvasId: IdentifierSchema,
    canvasRevisionId: IdentifierSchema,
    quoteId: IdentifierSchema,
    status: z.enum(runStates),
    reservationId: IdentifierSchema,
  })
  .strict();

export const RunNodeRecordSchema = z
  .object({
    runNodeId: IdentifierSchema,
    nodeKey: IdentifierSchema,
    modelRouteId: IdentifierSchema.nullable(),
    status: z.enum(runNodeStates),
    dispatchWave: z.number().int().nonnegative(),
  })
  .strict();

export const CanvasContextRecordSchema = z
  .object({
    canvasId: IdentifierSchema,
    projectId: IdentifierSchema,
    headRevisionId: IdentifierSchema,
    graphSchemaVersion: z.number().int().positive(),
    graphSnapshot: GraphSnapshotSchema as z.ZodType<GraphSnapshot>,
    canonicalHash: Sha256Schema,
  })
  .strict();

const QuotePriceComponentSchema = z
  .object({
    unit: z.enum(modelPriceUnits),
    quantity: z.bigint().nonnegative(),
    unitPriceMicros: z.bigint().nonnegative(),
    totalMicros: z.bigint().nonnegative(),
  })
  .strict();

const ImmutableRunQuoteSchema = z
  .object({
    quoteId: IdentifierSchema,
    workspaceId: IdentifierSchema,
    canvasRevisionId: IdentifierSchema,
    priceCatalogVersionId: IdentifierSchema,
    currency: z.literal('USD'),
    nodeLines: z.array(
      z
        .object({
          nodeId: IdentifierSchema,
          modelRouteId: IdentifierSchema,
          providerModelId: z.string().min(1),
          priceComponents: z.array(QuotePriceComponentSchema),
          totalMicros: z.bigint().nonnegative(),
        })
        .strict(),
    ),
    maximumChargeMicros: z.bigint().nonnegative(),
    createdAt: TimestampSchema,
    expiresAt: TimestampSchema,
  })
  .strict();

const WireQuotePriceComponentSchema = QuotePriceComponentSchema.extend({
  quantity: WireMicrosSchema,
  unitPriceMicros: WireMicrosSchema,
  totalMicros: WireMicrosSchema,
}).strict();

const WireImmutableRunQuoteSchema = ImmutableRunQuoteSchema.extend({
  nodeLines: z.array(
    ImmutableRunQuoteSchema.shape.nodeLines.element
      .extend({
        priceComponents: z.array(WireQuotePriceComponentSchema),
        totalMicros: WireMicrosSchema,
      })
      .strict(),
  ),
  maximumChargeMicros: WireMicrosSchema,
}).strict();

const ForbiddenResultSchema = z.object({ status: z.literal('forbidden') }).strict();
const NotFoundResultSchema = z.object({ status: z.literal('not_found') }).strict();
const ConflictResultSchema = z
  .object({
    status: z.literal('conflict'),
    reason: z.enum(['revision', 'run_state', 'quote_stale', 'idempotency']),
    actual: z.string().optional(),
  })
  .strict();
const GraphInvalidResultSchema = z
  .object({ status: z.literal('graph_invalid'), issues: z.array(GraphValidationIssueSchema) })
  .strict();
const ExpiredQuoteResultSchema = z
  .object({
    status: z.literal('expired_quote'),
    quoteId: IdentifierSchema,
    expiredAt: TimestampSchema,
  })
  .strict();
const CapExceededResultSchema = z
  .object({
    status: z.literal('cap_exceeded'),
    tier: z.enum(['run', 'workspace_day', 'global_day']),
    capMicros: z.bigint().nonnegative(),
    currentExposureMicros: z.bigint().nonnegative(),
    requestedMicros: z.bigint().nonnegative(),
    projectedMicros: z.bigint().nonnegative(),
  })
  .strict();
const InsufficientBalanceResultSchema = z
  .object({
    status: z.literal('cap_exceeded'),
    tier: z.literal('available_balance'),
    availableMicros: z.bigint().nonnegative(),
    requestedMicros: z.bigint().nonnegative(),
  })
  .strict();

export const ApplyCanvasPatchResultSchema = z.union([
  z
    .object({
      status: z.literal('ok'),
      canvasId: IdentifierSchema,
      revisionId: IdentifierSchema,
      canonicalHash: Sha256Schema,
      affectedDescendants: z.array(IdentifierSchema),
    })
    .strict(),
  ForbiddenResultSchema,
  NotFoundResultSchema,
  ConflictResultSchema,
  GraphInvalidResultSchema,
]);

export const ValidateGraphResultSchema = z.union([
  z
    .object({
      status: z.literal('ok'),
      canvasId: IdentifierSchema,
      revisionId: IdentifierSchema,
      valid: z.boolean(),
      issues: z.array(GraphValidationIssueSchema),
    })
    .strict(),
  ForbiddenResultSchema,
  NotFoundResultSchema,
]);

export const QuoteRunResultSchema = z.union([
  z
    .object({
      status: z.literal('ok'),
      quote: ImmutableRunQuoteSchema,
      confirmationToken: z.string().min(16).max(500),
      spend: z
        .object({
          runCapMicros: z.bigint().nonnegative(),
          workspaceDayCapMicros: z.bigint().nonnegative(),
          workspaceDayExposureMicros: z.bigint().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  ForbiddenResultSchema,
  NotFoundResultSchema,
  ConflictResultSchema,
  GraphInvalidResultSchema,
]);

export const StartRunResultSchema = z.union([
  z.object({ status: z.literal('ok'), run: RunRecordSchema }).strict(),
  ForbiddenResultSchema,
  NotFoundResultSchema,
  ConflictResultSchema,
  ExpiredQuoteResultSchema,
  CapExceededResultSchema,
  InsufficientBalanceResultSchema,
]);

export const GetRunResultSchema = z.union([
  z
    .object({ status: z.literal('ok'), run: RunRecordSchema, nodes: z.array(RunNodeRecordSchema) })
    .strict(),
  ForbiddenResultSchema,
  NotFoundResultSchema,
]);

export const GetCanvasContextResultSchema = z.union([
  z.object({ status: z.literal('ok'), canvas: CanvasContextRecordSchema }).strict(),
  ForbiddenResultSchema,
  NotFoundResultSchema,
]);

export const CancelRunResultSchema = z.union([
  z
    .object({
      status: z.literal('ok'),
      runId: IdentifierSchema,
      cancellation: z.literal('accepted'),
    })
    .strict(),
  ForbiddenResultSchema,
  NotFoundResultSchema,
  ConflictResultSchema,
]);

// Compile-time equality complements the runtime parity suite: either side drifting fails typecheck.
type DeepMutable<Value> = Value extends bigint
  ? bigint
  : Value extends readonly (infer Entry)[]
    ? DeepMutable<Entry>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: DeepMutable<Exclude<Value[Key], undefined>> }
      : Value;
type Compatible<Left, Right> = [Left] extends [Right] ? true : false;
type Assert<Condition extends true> = Condition;
export type HandlerResultSchemaParity = readonly [
  Assert<
    Compatible<
      DeepMutable<z.infer<typeof ApplyCanvasPatchResultSchema>>,
      DeepMutable<ApplyCanvasPatchResult>
    >
  >,
  Assert<
    Compatible<
      DeepMutable<z.infer<typeof ValidateGraphResultSchema>>,
      DeepMutable<ValidateGraphResult>
    >
  >,
  Assert<
    Compatible<DeepMutable<z.infer<typeof QuoteRunResultSchema>>, DeepMutable<QuoteRunResult>>
  >,
  Assert<
    Compatible<DeepMutable<z.infer<typeof StartRunResultSchema>>, DeepMutable<StartRunResult>>
  >,
  Assert<Compatible<DeepMutable<z.infer<typeof GetRunResultSchema>>, DeepMutable<GetRunResult>>>,
  Assert<
    Compatible<
      DeepMutable<z.infer<typeof GetCanvasContextResultSchema>>,
      DeepMutable<GetCanvasContextResult>
    >
  >,
  Assert<
    Compatible<DeepMutable<z.infer<typeof CancelRunResultSchema>>, DeepMutable<CancelRunResult>>
  >,
];

const WorkspaceSchema = z
  .object({
    created_at: TimestampSchema,
    created_by: IdentifierSchema,
    daily_spend_cap_micros: MicrosSchema,
    id: IdentifierSchema,
    name: z.string().min(1),
    per_run_spend_cap_micros: MicrosSchema,
    slug: z.string().min(1),
    status: z.string().min(1),
    updated_at: TimestampSchema,
  })
  .strict();

const ProjectSchema = z
  .object({
    brand_kit_id: IdentifierSchema.nullable(),
    brief_id: IdentifierSchema.nullable(),
    created_at: TimestampSchema,
    created_by: IdentifierSchema,
    id: IdentifierSchema,
    name: z.string().min(1),
    status: z.string().min(1),
    updated_at: TimestampSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

const ArtifactSchema = z
  .object({
    accessibility_description: z.string().nullable(),
    approved_at: TimestampSchema.nullable(),
    approved_by: IdentifierSchema.nullable(),
    artifact_kind: z.string().min(1),
    byte_size: MicrosSchema,
    canvas_revision_id: IdentifierSchema.nullable(),
    content_hash: Sha256Schema.nullable(),
    created_at: TimestampSchema,
    id: IdentifierSchema,
    mime_type: z.string().min(1),
    object_key: z.string().min(1),
    project_id: IdentifierSchema,
    rights_attestation: JsonValueSchema,
    run_id: IdentifierSchema.nullable(),
    run_node_id: IdentifierSchema.nullable(),
    status: z.string().min(1),
    updated_at: TimestampSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

const RunRowSchema = z
  .object({
    canvas_id: IdentifierSchema,
    canvas_revision_hash: Sha256Schema,
    canvas_revision_id: IdentifierSchema,
    confirmed_at: TimestampSchema,
    confirmed_by: IdentifierSchema,
    created_at: TimestampSchema,
    dispatch_epoch: z.number().int().nonnegative(),
    dispatch_wave: z.number().int().positive(),
    id: IdentifierSchema,
    project_id: IdentifierSchema,
    quote_id: IdentifierSchema,
    status: z.enum(runStates),
    updated_at: TimestampSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

const ReservationSchema = z
  .object({
    amount_micros: MicrosSchema,
    captured_micros: MicrosSchema,
    created_at: TimestampSchema,
    id: IdentifierSchema,
    quote_id: IdentifierSchema,
    refunded_micros: MicrosSchema,
    released_micros: MicrosSchema,
    run_id: IdentifierSchema,
    status: z.string().min(1),
    updated_at: TimestampSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

const LedgerEntrySchema = z
  .object({
    account_code: z.string().min(1),
    amount_micros: MicrosSchema,
    causative_key: z.string().min(1),
    created_at: TimestampSchema,
    direction: z.string().min(1),
    entry_type: z.string().min(1),
    id: IdentifierSchema,
    metadata: JsonValueSchema,
    reservation_id: IdentifierSchema.nullable(),
    run_id: IdentifierSchema.nullable(),
    transaction_id: IdentifierSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

const LineageSchema = z
  .object({
    child_artifact_id: IdentifierSchema,
    created_at: TimestampSchema,
    id: IdentifierSchema,
    parent_artifact_id: IdentifierSchema,
    relationship: z.string().min(1),
    workspace_id: IdentifierSchema,
  })
  .strict();

const ModelRouteSchema = z
  .object({
    capability: z.string().min(1),
    created_at: TimestampSchema,
    driver_version: z.string().min(1),
    id: IdentifierSchema,
    input_schema_version: z.number().int().positive(),
    output_schema_version: z.number().int().positive(),
    provider_model_id: z.string().min(1),
    provider_registration_id: IdentifierSchema,
    route_key: z.string().min(1),
    status: z.string().min(1),
    updated_at: TimestampSchema,
  })
  .strict();

const ExportArtifactSchema = z
  .object({
    artifact_id: IdentifierSchema,
    project_id: IdentifierSchema,
    run_id: IdentifierSchema,
    canvas_revision_id: IdentifierSchema,
    artifact_kind: z.literal('export'),
    status: z.literal('available'),
    object_key: z.string().min(1),
    content_hash: Sha256Schema,
    mime_type: z.string().min(1),
    byte_size: MicrosSchema,
  })
  .strict();

const operationDataSchemas = {
  create_workspace: z.object({ workspace_id: IdentifierSchema, role: z.literal('owner') }).strict(),
  get_workspace: z.object({ workspace: WorkspaceSchema }).strict(),
  create_project: z.object({ project: ProjectSchema }).strict(),
  get_project: z.object({ project: ProjectSchema }).strict(),
  create_canvas: z
    .object({
      canvasId: IdentifierSchema,
      revisionId: IdentifierSchema,
      canonicalHash: Sha256Schema,
    })
    .strict(),
  get_canvas_context: GetCanvasContextResultSchema.options[0].omit({ status: true }),
  apply_canvas_patch: ApplyCanvasPatchResultSchema.options[0].omit({ status: true }),
  validate_graph: ValidateGraphResultSchema.options[0].omit({ status: true }),
  quote_run: QuoteRunResultSchema.options[0]
    .omit({ status: true })
    .extend({
      quote: WireImmutableRunQuoteSchema,
      spend: z
        .object({
          runCapMicros: WireMicrosSchema,
          workspaceDayCapMicros: WireMicrosSchema,
          workspaceDayExposureMicros: WireMicrosSchema,
        })
        .strict(),
    })
    .strict(),
  start_run: StartRunResultSchema.options[0].omit({ status: true }),
  get_run: GetRunResultSchema.options[0].omit({ status: true }),
  cancel_run: CancelRunResultSchema.options[0].omit({ status: true }),
  create_artifact_upload: z
    .object({
      artifact_id: IdentifierSchema,
      upload_url: z.url({ protocol: /^https?$/u }),
      expires_at: TimestampSchema,
    })
    .strict(),
  get_artifact: z.object({ artifact: ArtifactSchema }).strict(),
  approve_artifacts: z
    .object({
      run_id: IdentifierSchema,
      approved: z.number().int().nonnegative(),
      replayed: z.number().int().nonnegative(),
      artifacts: z.array(
        z
          .object({ artifact_id: IdentifierSchema, artifact_kind: z.literal('approved_output') })
          .strict(),
      ),
    })
    .strict(),
  create_export: z.object({ artifact: ExportArtifactSchema, replayed: z.boolean() }).strict(),
  explain_model: z.object({ model: ModelRouteSchema }).strict(),
  get_receipt: z
    .object({
      receipt: z
        .object({
          run: RunRowSchema,
          reservation: ReservationSchema.nullable(),
          ledger: z.array(LedgerEntrySchema),
          artifacts: z.array(ArtifactSchema),
          lineage: z.array(LineageSchema),
        })
        .strict(),
    })
    .strict(),
  ingest_fal_webhook: z.union([
    z
      .object({
        accepted: z.literal(true),
        idempotent: z.literal(true),
        run_status: z.enum(runStates),
      })
      .strict(),
    z
      .object({
        accepted: z.literal(true),
        idempotent: z.boolean(),
        artifact_id: IdentifierSchema,
        run_status: z.enum(runStates),
        capture_micros: MicrosSchema,
      })
      .strict(),
  ]),
} as const satisfies Readonly<Record<P0RestOperation, z.ZodType>>;

export const P0_OPERATION_DATA_SCHEMAS = operationDataSchemas;

export const P0_OPERATION_RESPONSE_SCHEMAS = Object.fromEntries(
  Object.entries(operationDataSchemas).map(([operation, dataSchema]) => [
    operation,
    z.union([createApiSuccessEnvelopeSchema(dataSchema), ApiErrorEnvelopeSchema]),
  ]),
) as unknown as {
  readonly [Operation in P0RestOperation]: z.ZodType;
};

export type P0OperationData<Operation extends P0RestOperation> = z.infer<
  (typeof P0_OPERATION_DATA_SCHEMAS)[Operation]
>;
export type P0OperationResponse<Operation extends P0RestOperation> =
  ApiSuccessEnvelope<P0OperationData<Operation>> | ApiErrorEnvelope;

export type ContractSchema = z.ZodType;

export function contractSchemaToJsonSchema(
  schema: ContractSchema,
): Readonly<Record<string, unknown>> {
  const document = { ...z.toJSONSchema(schema, { unrepresentable: 'any' }) };
  Reflect.deleteProperty(document, '$schema');
  return document;
}
