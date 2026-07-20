import { describe, expect, it, vi } from 'vitest';

import type { CommandHandlers } from './handlers';
import {
  P0_REST_OPERATIONS,
  createP0ResourceHandlers,
  createP0RestHandlers,
  type P0ResourcePort,
} from './rest';

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
      createExport: resource('create_export'),
      explainModel: resource('explain_model'),
      getReceipt: resource('get_receipt'),
      ingestFalWebhook: resource('ingest_fal_webhook'),
    };
    const handlers = createP0RestHandlers(commands, createP0ResourceHandlers(resources));

    for (const operation of P0_REST_OPERATIONS) await handlers[operation]({ fixture: true });

    expect(Object.keys(handlers)).toEqual(P0_REST_OPERATIONS);
    expect(called).toEqual(P0_REST_OPERATIONS);
  });
});
