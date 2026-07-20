import { z } from 'zod';

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

export type P0HandlerResult = Readonly<{
  status:
    | 'ok'
    | 'forbidden'
    | 'not_found'
    | 'conflict'
    | 'expired_quote'
    | 'cap_exceeded'
    | 'graph_invalid'
    | 'provider_unavailable';
  reason?: 'revision' | 'run_state' | 'quote_stale' | 'idempotency';
  tier?: string;
}>;

export type P0RestHandler = (input: unknown) => Promise<P0HandlerResult>;

export type P0RestHandlers = Readonly<Record<P0RestOperation, P0RestHandler>>;

export interface P0ResourceHandlers {
  readonly createWorkspace: P0RestHandler;
  readonly getWorkspace: P0RestHandler;
  readonly createProject: P0RestHandler;
  readonly getProject: P0RestHandler;
  readonly createCanvas: P0RestHandler;
  readonly createArtifactUpload: P0RestHandler;
  readonly getArtifact: P0RestHandler;
  readonly createExport: P0RestHandler;
  readonly explainModel: P0RestHandler;
  readonly getReceipt: P0RestHandler;
  readonly ingestFalWebhook: P0RestHandler;
}

/** The thirteenth P0 handler port, covering resource operations outside graph execution. */
export type P0ResourcePort = P0ResourceHandlers;

export interface P0HandlerPorts extends HandlerPorts {
  readonly resources: P0ResourcePort;
}

export function createP0ResourceHandlers(port: P0ResourcePort): P0ResourceHandlers {
  return {
    createWorkspace: (input) => port.createWorkspace(input),
    getWorkspace: (input) => port.getWorkspace(input),
    createProject: (input) => port.createProject(input),
    getProject: (input) => port.getProject(input),
    createCanvas: (input) => port.createCanvas(input),
    createArtifactUpload: (input) => port.createArtifactUpload(input),
    getArtifact: (input) => port.getArtifact(input),
    createExport: (input) => port.createExport(input),
    explainModel: (input) => port.explainModel(input),
    getReceipt: (input) => port.getReceipt(input),
    ingestFalWebhook: (input) => port.ingestFalWebhook(input),
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
    create_export: resources.createExport,
    explain_model: resources.explainModel,
    get_receipt: resources.getReceipt,
    ingest_fal_webhook: resources.ingestFalWebhook,
  };
}
