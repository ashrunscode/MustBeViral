'use client';
import { useCallback, useEffect, useState } from 'react';
import type { MustBeViralRestClient, PlatformInput, PlatformOutput } from '@mustbeviral/contracts';
import { createBrowserCoreClient } from '../../lib/core/browser-client';
import { isSessionExpiredFailure } from '../../lib/core/session-expiry';
import { PlatformRequestError, platformRequest } from './platform-client';
import { isResourceId, type CampaignContext } from './platform-navigation';

/**
 * What Core has said about the records a campaign link names. Each fact comes from a read that
 * Core already authorizes; the frame only checks that the records belong together.
 */
export interface CampaignScopeFacts {
  readonly canvas?: Readonly<{ id: string; projectId: string }> | undefined;
  readonly run?: Readonly<{ id: string; projectId: string; canvasId: string }> | undefined;
  /** Project id to the workspace that owns it. */
  readonly projects: Readonly<Record<string, string>>;
  readonly projectBrand?:
    | Readonly<{ projectId: string; brandId: string | null; state: 'mapped' | 'mapping_required' }>
    | undefined;
}

export type CampaignScopeResult =
  | Readonly<{ status: 'ok' }>
  | Readonly<{ status: 'mismatch'; reason: string }>
  | Readonly<{ status: 'error'; error: unknown }>;

/**
 * One scope: every record a link names must belong to the route workspace, to each other, and,
 * where Core has mapped the project to a brand, to the brand in the link. A project Core has not
 * mapped yet cannot be proven either way and is accepted inside its own workspace.
 */
export function decideCampaignScope(
  workspace: string,
  brandId: string | undefined,
  context: Readonly<{ canvas?: string | undefined; run?: string | undefined }>,
  facts: CampaignScopeFacts,
): CampaignScopeResult {
  if (context.canvas !== undefined) {
    if (facts.canvas === undefined || facts.canvas.id !== context.canvas) {
      return { status: 'mismatch', reason: 'The plan in this link could not be matched.' };
    }
    if (facts.projects[facts.canvas.projectId] !== workspace) {
      return { status: 'mismatch', reason: 'The plan in this link belongs to another workspace.' };
    }
  }
  if (context.run !== undefined) {
    if (facts.run === undefined || facts.run.id !== context.run) {
      return { status: 'mismatch', reason: 'The run in this link could not be matched.' };
    }
    if (facts.projects[facts.run.projectId] !== workspace) {
      return { status: 'mismatch', reason: 'The run in this link belongs to another workspace.' };
    }
    if (context.canvas !== undefined && facts.run.canvasId !== context.canvas) {
      return { status: 'mismatch', reason: 'The run in this link belongs to a different plan.' };
    }
  }
  if (
    brandId !== undefined &&
    facts.projectBrand !== undefined &&
    facts.projectBrand.state === 'mapped' &&
    facts.projectBrand.brandId !== brandId
  ) {
    return { status: 'mismatch', reason: 'This campaign belongs to a different brand.' };
  }
  return { status: 'ok' };
}

type CoreRequest = MustBeViralRestClient['request'];
type ResolveBrand = (
  input: PlatformInput<'resolve_project_brand'>,
) => Promise<PlatformOutput<'resolve_project_brand'>>;

function coreFailure(error: Readonly<{ code: string; message: string }>): CampaignScopeResult {
  return { status: 'error', error: new PlatformRequestError(error.code, error.message) };
}

/** Reads the named records through Core and decides whether they form one scope. */
export async function proveCampaignScope(
  input: Readonly<{
    workspace: string;
    brandId: string | undefined;
    canvasId: string | undefined;
    runId: string | undefined;
    request: CoreRequest;
    resolveBrand: ResolveBrand;
  }>,
): Promise<CampaignScopeResult> {
  try {
    const projects: Record<string, string> = {};
    let canvas: CampaignScopeFacts['canvas'];
    let run: CampaignScopeFacts['run'];
    if (input.canvasId !== undefined) {
      const result = await input.request('get_canvas_context', { id: input.canvasId });
      if ('error' in result) return coreFailure(result.error);
      canvas = { id: result.data.canvas.canvasId, projectId: result.data.canvas.projectId };
    }
    if (input.runId !== undefined) {
      const result = await input.request('get_run', { id: input.runId });
      if ('error' in result) return coreFailure(result.error);
      run = {
        id: result.data.run.runId,
        projectId: result.data.run.projectId,
        canvasId: result.data.run.canvasId,
      };
    }
    const projectIds = [...new Set([canvas?.projectId, run?.projectId])].filter(
      (id): id is string => id !== undefined,
    );
    for (const id of projectIds) {
      const result = await input.request('get_project', { id });
      if ('error' in result) return coreFailure(result.error);
      projects[id] = result.data.project.workspace_id;
    }
    const context = { canvas: input.canvasId, run: input.runId };
    const workspaceDecision = decideCampaignScope(input.workspace, undefined, context, {
      canvas,
      run,
      projects,
    });
    if (workspaceDecision.status !== 'ok') return workspaceDecision;
    const projectId = canvas?.projectId ?? run?.projectId;
    if (input.brandId === undefined || projectId === undefined) return workspaceDecision;
    const mapping = await input.resolveBrand({
      workspace_id: input.workspace,
      project_id: projectId,
    });
    return decideCampaignScope(input.workspace, input.brandId, context, {
      canvas,
      run,
      projects,
      projectBrand: { projectId, brandId: mapping.brand_id, state: mapping.state },
    });
  } catch (error) {
    if (isSessionExpiredFailure(error)) {
      return {
        status: 'error',
        error: new PlatformRequestError('UNAUTHENTICATED', 'Your session ended.'),
      };
    }
    return { status: 'error', error };
  }
}

export type CampaignScopeState = (CampaignScopeResult | Readonly<{ status: 'pending' }>) &
  Readonly<{ retry: () => void }>;

/**
 * Proves the plan and run a campaign link names before the frame renders them. Links without a
 * plan or run have nothing further to prove beyond studio and brand access.
 */
export function useCampaignScope(
  workspace: string,
  context: CampaignContext,
  brandId: string | undefined,
  enabled: boolean,
): CampaignScopeState {
  const canvasId = isResourceId(context.canvas) ? context.canvas : undefined;
  const runId = isResourceId(context.run) ? context.run : undefined;
  const needed = enabled && (canvasId !== undefined || runId !== undefined);
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([workspace, canvasId, runId, brandId, nonce]);
  const [state, setState] = useState<{ key: string; result: CampaignScopeResult } | null>(null);
  useEffect(() => {
    if (!needed) return;
    let current = true;
    void (async () => {
      try {
        const client = createBrowserCoreClient();
        return await proveCampaignScope({
          workspace,
          brandId,
          canvasId,
          runId,
          request: (operation, input) => client.request(operation, input),
          resolveBrand: (input) => platformRequest('resolve_project_brand', input),
        });
      } catch (error) {
        return { status: 'error', error } as const;
      }
    })().then((result) => {
      if (current) setState({ key, result });
    });
    return () => {
      current = false;
    };
    // `key` carries workspace, canvas, run, brand and the retry count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needed]);
  const retry = useCallback(() => setNonce((value) => value + 1), []);
  if (!needed) return { status: 'ok', retry };
  if (state === null || state.key !== key) return { status: 'pending', retry };
  return { ...state.result, retry };
}
