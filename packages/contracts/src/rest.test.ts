import { describe, expect, it, vi } from 'vitest';

import type { CommandHandlers } from './handlers';
import {
  P0_REST_OPERATIONS,
  createP0ResourceHandlers,
  createP0RestHandlers,
  type P0RestOperation,
  type P0ResourcePort,
} from './rest';

const context = {
  workspace_id: 'workspace-1',
  actor_id: 'actor-1',
  request_id: 'request-1',
} as const;

const minimalInputs = {
  create_workspace: { context, name: 'Workspace', idempotency_key: 'idem-workspace' },
  get_workspace: { context, workspace_id: 'workspace-1' },
  create_project: {
    context,
    workspace_id: 'workspace-1',
    name: 'Project',
    idempotency_key: 'idem-project',
  },
  get_project: { context, project_id: 'project-1' },
  create_canvas: { context, project_id: 'project-1', idempotency_key: 'idem-canvas' },
  get_canvas_context: { context, canvas_id: 'canvas-1' },
  apply_canvas_patch: {
    context,
    canvas_id: 'canvas-1',
    expected_revision_id: 'revision-1',
    reason: 'Apply fixture patch',
    patch: {},
    idempotency_key: 'idem-patch',
  },
  validate_graph: { context, canvas_id: 'canvas-1' },
  quote_run: {
    context,
    canvas_id: 'canvas-1',
    expected_revision_id: 'revision-1',
    idempotency_key: 'idem-quote',
  },
  start_run: {
    context,
    quote_id: 'quote-1',
    confirmed: true,
    confirmation_token: 'confirmation-token',
    idempotency_key: 'idem-start',
  },
  get_run: { context, run_id: 'run-1' },
  cancel_run: {
    context,
    run_id: 'run-1',
    reason: 'Cancel fixture run',
    idempotency_key: 'idem-cancel',
  },
  create_artifact_upload: {
    context,
    project_id: 'project-1',
    content_type: 'image/png',
    byte_size: 1,
    sha256: 'a'.repeat(64),
    purpose: 'fixture',
    idempotency_key: 'idem-upload',
  },
  get_artifact: { context, artifact_id: 'artifact-1' },
  approve_artifacts: {
    context,
    run_id: 'run-1',
    approvals: [{ artifact_id: 'artifact-1', accessibility_description: 'Fixture description.' }],
    idempotency_key: 'idem-approve',
  },
  create_export: {
    context,
    run_id: 'run-1',
    artifact_ids: ['artifact-1'],
    format: 'zip',
    idempotency_key: 'idem-export',
  },
  explain_model: { context, model_id: 'model-1' },
  get_receipt: { context, run_id: 'run-1' },
  ingest_fal_webhook: {
    identity: { provider: 'fal', event_id: 'event-1', dedup_key: 'event-1' },
    event: {},
  },
} as const satisfies Readonly<Record<P0RestOperation, unknown>>;

describe('P0 REST handler binding', () => {
  it('binds every public operation to exactly one shared handler', async () => {
    const called: string[] = [];
    const command = (name: string) =>
      vi.fn(async () => {
        called.push(name);
        return { status: 'ok' as const };
      });
    const commands = {
      applyCanvasPatch: command('apply_canvas_patch'),
      validateGraph: command('validate_graph'),
      quoteRun: command('quote_run'),
      startRun: command('start_run'),
      getRun: command('get_run'),
      getCanvasContext: command('get_canvas_context'),
      cancelRun: command('cancel_run'),
      registerArtifact: command('register_artifact'),
      registerArtifactLineage: command('register_artifact_lineage'),
    } as unknown as CommandHandlers;
    const resource = (name: string) =>
      vi.fn(async () => {
        called.push(name);
        return { status: 'ok' as const };
      });
    const resources: P0ResourcePort = {
      createWorkspace: resource('create_workspace'),
      getWorkspace: resource('get_workspace'),
      createProject: resource('create_project'),
      getProject: resource('get_project'),
      createCanvas: resource('create_canvas'),
      createArtifactUpload: resource('create_artifact_upload'),
      getArtifact: resource('get_artifact'),
      approveArtifacts: resource('approve_artifacts'),
      createExport: resource('create_export'),
      explainModel: resource('explain_model'),
      getReceipt: resource('get_receipt'),
      ingestFalWebhook: resource('ingest_fal_webhook'),
    };
    const handlers = createP0RestHandlers(commands, createP0ResourceHandlers(resources));

    for (const operation of P0_REST_OPERATIONS) {
      await handlers[operation](minimalInputs[operation]);
    }

    expect(Object.keys(handlers)).toEqual(P0_REST_OPERATIONS);
    expect(called).toEqual(P0_REST_OPERATIONS);
  });
});
