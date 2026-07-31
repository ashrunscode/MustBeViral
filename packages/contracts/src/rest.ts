import { z } from 'zod';

import { HandlerContextSchema, IdempotencyKeySchema, IdentifierSchema } from './commands';
import type { CommandHandlers } from './handlers';
import type { HandlerPorts } from './ports';

export const P0_REST_OPERATIONS = [
  'create_workspace',
  'get_workspace',
  'create_project',
  'get_project',
  'create_canvas',
  'get_canvas_context',
  'apply_canvas_patch',
  'validate_graph',
  'quote_run',
  'start_run',
  'get_run',
  'cancel_run',
  'create_artifact_upload',
  'get_artifact',
  'approve_artifacts',
  'create_export',
  'explain_model',
  'get_receipt',
  'ingest_fal_webhook',
] as const;

export type P0RestOperation = (typeof P0_REST_OPERATIONS)[number];

export const CreateWorkspaceBodySchema = z
  .object({ name: z.string().trim().min(1).max(120) })
  .strict();
export const CreateProjectBodySchema = z
  .object({ name: z.string().trim().min(1).max(160) })
  .strict();
export const CreateCanvasBodySchema = z
  .object({ name: z.string().trim().min(1).max(160).optional() })
  .strict();
export const CreateArtifactUploadBodySchema = z
  .object({
    project_id: IdentifierSchema,
    content_type: z.string().min(1).max(200),
    byte_size: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    purpose: z.string().min(1).max(100),
  })
  .strict();
export const CreateExportBodySchema = z
  .object({
    artifact_ids: z.array(z.string().min(1).max(200)).min(1).max(100),
    format: z.enum(['zip', 'json']),
  })
  .strict();
export const ApproveArtifactsBodySchema = z
  .object({
    approvals: z
      .array(
        z
          .object({
            artifact_id: IdentifierSchema,
            // Required, not optional: the WCAG gate demands user-editable descriptive text at the
            // approval boundary, and the RPC refuses an empty one.
            accessibility_description: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

const ContextInputSchema = z.object({ context: HandlerContextSchema }).strict();

export const CreateWorkspaceResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    name: CreateWorkspaceBodySchema.shape.name,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const GetWorkspaceResourceInputSchema = ContextInputSchema.extend({
  workspace_id: IdentifierSchema,
}).strict();

export const CreateProjectResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    workspace_id: IdentifierSchema,
    name: CreateProjectBodySchema.shape.name,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const GetProjectResourceInputSchema = ContextInputSchema.extend({
  project_id: IdentifierSchema,
}).strict();

export const CreateCanvasResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    project_id: IdentifierSchema,
    name: CreateCanvasBodySchema.shape.name,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const CreateArtifactUploadResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    ...CreateArtifactUploadBodySchema.shape,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const GetArtifactResourceInputSchema = ContextInputSchema.extend({
  artifact_id: IdentifierSchema,
}).strict();

export const CreateExportResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    run_id: IdentifierSchema,
    ...CreateExportBodySchema.shape,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const ApproveArtifactsResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    run_id: IdentifierSchema,
    ...ApproveArtifactsBodySchema.shape,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const ExplainModelResourceInputSchema = ContextInputSchema.extend({
  model_id: IdentifierSchema,
}).strict();

export const GetReceiptResourceInputSchema = ContextInputSchema.extend({
  run_id: IdentifierSchema,
}).strict();

export const IngestFalWebhookResourceInputSchema = z
  .object({
    identity: z
      .object({
        provider: z.literal('fal'),
        event_id: IdentifierSchema,
        dedup_key: IdentifierSchema,
      })
      .strict(),
    event: z.unknown(),
  })
  .strict();

export type CreateWorkspaceResourceInput = z.infer<typeof CreateWorkspaceResourceInputSchema>;
export type GetWorkspaceResourceInput = z.infer<typeof GetWorkspaceResourceInputSchema>;
export type CreateProjectResourceInput = z.infer<typeof CreateProjectResourceInputSchema>;
export type GetProjectResourceInput = z.infer<typeof GetProjectResourceInputSchema>;
export type CreateCanvasResourceInput = z.infer<typeof CreateCanvasResourceInputSchema>;
export type CreateArtifactUploadResourceInput = z.infer<
  typeof CreateArtifactUploadResourceInputSchema
>;
export type GetArtifactResourceInput = z.infer<typeof GetArtifactResourceInputSchema>;
export type CreateExportResourceInput = z.infer<typeof CreateExportResourceInputSchema>;
export type ApproveArtifactsResourceInput = z.infer<typeof ApproveArtifactsResourceInputSchema>;
export type ExplainModelResourceInput = z.infer<typeof ExplainModelResourceInputSchema>;
export type GetReceiptResourceInput = z.infer<typeof GetReceiptResourceInputSchema>;
export type IngestFalWebhookResourceInput = z.infer<typeof IngestFalWebhookResourceInputSchema>;

export type P0HandlerResult = Readonly<{
  status:
    | 'ok'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'expired_quote'
    | 'cap_exceeded'
    | 'graph_invalid'
    | 'provider_unavailable'
    | 'rate_limited'
    | 'provider_ambiguous';
  reason?: 'revision' | 'run_state' | 'quote_stale' | 'idempotency' | 'approval';
  tier?: string;
  retry_after_seconds?: number;
  reconcile_state?: string;
}>;

export type P0RestHandler = (input: unknown) => Promise<P0HandlerResult>;

export type P0ResourceHandler<Input> = (input: Input) => Promise<P0HandlerResult>;

export type P0RestHandlers = Readonly<Record<P0RestOperation, P0RestHandler>>;

export interface P0ResourceHandlers {
  readonly createWorkspace: P0RestHandler;
  readonly getWorkspace: P0RestHandler;
  readonly createProject: P0RestHandler;
  readonly getProject: P0RestHandler;
  readonly createCanvas: P0RestHandler;
  readonly createArtifactUpload: P0RestHandler;
  readonly getArtifact: P0RestHandler;
  readonly approveArtifacts: P0RestHandler;
  readonly createExport: P0RestHandler;
  readonly explainModel: P0RestHandler;
  readonly getReceipt: P0RestHandler;
  readonly ingestFalWebhook: P0RestHandler;
}

/** The thirteenth P0 handler port, covering resource operations outside graph execution. */
export interface P0ResourcePort {
  readonly createWorkspace: P0ResourceHandler<CreateWorkspaceResourceInput>;
  readonly getWorkspace: P0ResourceHandler<GetWorkspaceResourceInput>;
  readonly createProject: P0ResourceHandler<CreateProjectResourceInput>;
  readonly getProject: P0ResourceHandler<GetProjectResourceInput>;
  readonly createCanvas: P0ResourceHandler<CreateCanvasResourceInput>;
  readonly createArtifactUpload: P0ResourceHandler<CreateArtifactUploadResourceInput>;
  readonly getArtifact: P0ResourceHandler<GetArtifactResourceInput>;
  readonly approveArtifacts: P0ResourceHandler<ApproveArtifactsResourceInput>;
  readonly createExport: P0ResourceHandler<CreateExportResourceInput>;
  readonly explainModel: P0ResourceHandler<ExplainModelResourceInput>;
  readonly getReceipt: P0ResourceHandler<GetReceiptResourceInput>;
  readonly ingestFalWebhook: P0ResourceHandler<IngestFalWebhookResourceInput>;
}

export interface P0HandlerPorts extends HandlerPorts {
  readonly resources: P0ResourcePort;
}

export function createP0ResourceHandlers(port: P0ResourcePort): P0ResourceHandlers {
  return {
    createWorkspace: (input) =>
      port.createWorkspace(CreateWorkspaceResourceInputSchema.parse(input)),
    getWorkspace: (input) => port.getWorkspace(GetWorkspaceResourceInputSchema.parse(input)),
    createProject: (input) => port.createProject(CreateProjectResourceInputSchema.parse(input)),
    getProject: (input) => port.getProject(GetProjectResourceInputSchema.parse(input)),
    createCanvas: (input) => port.createCanvas(CreateCanvasResourceInputSchema.parse(input)),
    createArtifactUpload: (input) =>
      port.createArtifactUpload(CreateArtifactUploadResourceInputSchema.parse(input)),
    getArtifact: (input) => port.getArtifact(GetArtifactResourceInputSchema.parse(input)),
    approveArtifacts: (input) =>
      port.approveArtifacts(ApproveArtifactsResourceInputSchema.parse(input)),
    createExport: (input) => port.createExport(CreateExportResourceInputSchema.parse(input)),
    explainModel: (input) => port.explainModel(ExplainModelResourceInputSchema.parse(input)),
    getReceipt: (input) => port.getReceipt(GetReceiptResourceInputSchema.parse(input)),
    ingestFalWebhook: (input) =>
      port.ingestFalWebhook(IngestFalWebhookResourceInputSchema.parse(input)),
  };
}

/**
 * The only REST-to-handler binding. Transports consume this map and never
 * reproduce command, authorization, billing, or revision behavior.
 */
export function createP0RestHandlers(
  commands: CommandHandlers,
  resources: P0ResourceHandlers,
): P0RestHandlers {
  return {
    create_workspace: resources.createWorkspace,
    get_workspace: resources.getWorkspace,
    create_project: resources.createProject,
    get_project: resources.getProject,
    create_canvas: resources.createCanvas,
    get_canvas_context: commands.getCanvasContext,
    apply_canvas_patch: commands.applyCanvasPatch,
    validate_graph: commands.validateGraph,
    quote_run: commands.quoteRun,
    start_run: commands.startRun,
    get_run: commands.getRun,
    cancel_run: commands.cancelRun,
    create_artifact_upload: resources.createArtifactUpload,
    get_artifact: resources.getArtifact,
    approve_artifacts: resources.approveArtifacts,
    create_export: resources.createExport,
    explain_model: resources.explainModel,
    get_receipt: resources.getReceipt,
    ingest_fal_webhook: resources.ingestFalWebhook,
  };
}
