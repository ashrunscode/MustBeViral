import { launchPackGraphPatch, type MustBeViralRestClient } from '@mustbeviral/contracts';
import type { GraphSnapshot } from '@mustbeviral/graph';

export type BriefBootstrapResult =
  | {
      readonly type: 'ok';
      readonly workspaceId: string;
      readonly projectId: string;
      readonly canvasId: string;
      readonly revisionId: string;
    }
  | { readonly type: 'forbidden' }
  | { readonly type: 'conflict'; readonly message: string }
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export interface BriefBootstrapPort {
  bootstrap(
    input: Readonly<{
      workspaceRef: string;
      campaignName: string;
      graph?: GraphSnapshot;
    }>,
  ): Promise<BriefBootstrapResult>;
}

function stableSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]/gu, '-')
      .slice(0, 60) || 'studio'
  );
}

function stableKey(operation: string, identity: string) {
  return `web-brief-${operation}-${stableSegment(identity)}`;
}

export class WorkerBriefBootstrapPort implements BriefBootstrapPort {
  constructor(private readonly client: MustBeViralRestClient) {}

  async bootstrap(
    input: Readonly<{
      workspaceRef: string;
      campaignName: string;
      graph?: GraphSnapshot;
    }>,
  ): Promise<BriefBootstrapResult> {
    try {
      const existing = await this.client.request('get_workspace', { id: input.workspaceRef });
      let workspaceId: string;
      if ('error' in existing) {
        if (existing.error.code !== 'NOT_FOUND') return this.#mapError(existing.error);
        const created = await this.client.request('create_workspace', {
          idempotencyKey: stableKey('workspace', input.workspaceRef),
          body: { name: input.workspaceRef.replaceAll('-', ' ') },
        });
        if ('error' in created) return this.#mapError(created.error);
        workspaceId = created.data.workspace_id;
      } else {
        workspaceId = existing.data.workspace.id;
      }

      const project = await this.client.request('create_project', {
        id: workspaceId,
        idempotencyKey: stableKey('project', `${workspaceId}-${input.campaignName}`),
        body: { name: input.campaignName },
      });
      if ('error' in project) return this.#mapError(project.error);
      const canvas = await this.client.request('create_canvas', {
        id: project.data.project.id,
        idempotencyKey: stableKey('canvas', project.data.project.id),
        body: { name: `${input.campaignName} canvas` },
      });
      if ('error' in canvas) return this.#mapError(canvas.error);
      if (input.graph === undefined) {
        return {
          type: 'ok',
          workspaceId,
          projectId: project.data.project.id,
          canvasId: canvas.data.canvasId,
          revisionId: canvas.data.revisionId,
        };
      }
      return this.#applyLaunchPack({
        workspaceId,
        projectId: project.data.project.id,
        canvasId: canvas.data.canvasId,
        graph: input.graph,
        campaignName: input.campaignName,
      });
    } catch {
      return {
        type: 'error',
        message: 'Core could not bootstrap this campaign workspace.',
        retryable: true,
      };
    }
  }

  async #applyLaunchPack(input: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly canvasId: string;
    readonly graph: GraphSnapshot;
    readonly campaignName: string;
  }): Promise<BriefBootstrapResult> {
    const context = await this.client.request('get_canvas_context', { id: input.canvasId });
    if ('error' in context) return this.#mapError(context.error);
    const patched = await this.client.request('apply_canvas_patch', {
      id: input.canvasId,
      idempotencyKey: stableKey(
        'graph',
        `${input.canvasId}-${context.data.canvas.headRevisionId}-${stableSegment(input.campaignName)}`,
      ),
      body: {
        expected_revision_id: context.data.canvas.headRevisionId,
        reason: `Apply launch-pack graph for ${input.campaignName}`,
        patch: launchPackGraphPatch(input.graph),
      },
    });
    if ('error' in patched) return this.#mapError(patched.error);
    return {
      type: 'ok',
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      canvasId: input.canvasId,
      revisionId: patched.data.revisionId,
    };
  }

  #mapError(
    error: Readonly<{ code: string; message: string; request_id: string; retryable: boolean }>,
  ): BriefBootstrapResult {
    if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
    if (error.code === 'IDEMPOTENCY_CONFLICT') {
      return { type: 'conflict', message: error.message };
    }
    return {
      type: 'error',
      message: error.message,
      retryable: error.retryable,
      request_id: error.request_id,
    };
  }
}
