import { describe, expect, it, vi } from 'vitest';
import { decideCampaignScope, proveCampaignScope } from './campaign-scope';
import { PlatformRequestError } from './platform-client';

const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BRAND_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BRAND_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('decideCampaignScope', () => {
  const facts = {
    canvas: { id: 'canvas-a', projectId: 'project-a' },
    run: { id: 'run-a', projectId: 'project-a', canvasId: 'canvas-a' },
    projects: { 'project-a': WA, 'project-b': WB },
  };

  it('accepts a plan and run that belong to the route workspace and to each other', () => {
    expect(decideCampaignScope(WA, BRAND_A, { canvas: 'canvas-a', run: 'run-a' }, facts)).toEqual({
      status: 'ok',
    });
  });

  it('refuses a run from another workspace even when studio and brand are valid', () => {
    const result = decideCampaignScope(
      WA,
      BRAND_A,
      { run: 'run-b' },
      {
        run: { id: 'run-b', projectId: 'project-b', canvasId: 'canvas-b' },
        projects: facts.projects,
      },
    );
    expect(result).toEqual({
      status: 'mismatch',
      reason: 'The run in this link belongs to another workspace.',
    });
  });

  it('refuses a plan from another workspace', () => {
    const result = decideCampaignScope(
      WA,
      undefined,
      { canvas: 'canvas-b' },
      { canvas: { id: 'canvas-b', projectId: 'project-b' }, projects: facts.projects },
    );
    expect(result.status).toBe('mismatch');
  });

  it('refuses a run that belongs to a different plan than the link names', () => {
    const result = decideCampaignScope(
      WA,
      undefined,
      { canvas: 'canvas-a', run: 'run-x' },
      {
        ...facts,
        run: { id: 'run-x', projectId: 'project-a', canvasId: 'canvas-other' },
      },
    );
    expect(result).toEqual({
      status: 'mismatch',
      reason: 'The run in this link belongs to a different plan.',
    });
  });

  it('refuses a mapped project whose brand is not the brand in the link', () => {
    const result = decideCampaignScope(
      WA,
      BRAND_A,
      { canvas: 'canvas-a' },
      { ...facts, projectBrand: { projectId: 'project-a', brandId: BRAND_B, state: 'mapped' } },
    );
    expect(result).toEqual({
      status: 'mismatch',
      reason: 'This campaign belongs to a different brand.',
    });
  });

  it('accepts a project Core has not mapped to a brand yet, inside its own workspace', () => {
    const result = decideCampaignScope(
      WA,
      BRAND_A,
      { canvas: 'canvas-a' },
      {
        ...facts,
        projectBrand: { projectId: 'project-a', brandId: null, state: 'mapping_required' },
      },
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('refuses when Core returned a different record than the link names', () => {
    const result = decideCampaignScope(WA, undefined, { canvas: 'canvas-z' }, facts);
    expect(result.status).toBe('mismatch');
  });
});

describe('proveCampaignScope', () => {
  const request = vi.fn();
  const resolveBrand = vi.fn();

  it('reads the plan, run and project through Core and resolves the brand mapping', async () => {
    request.mockImplementation(async (operation: string, input: { id: string }) => {
      if (operation === 'get_canvas_context')
        return { data: { canvas: { canvasId: input.id, projectId: 'project-a' } } };
      if (operation === 'get_run')
        return {
          data: { run: { runId: input.id, projectId: 'project-a', canvasId: 'canvas-a' } },
        };
      if (operation === 'get_project') return { data: { project: { workspace_id: WA } } };
      throw new Error(`unexpected ${operation}`);
    });
    resolveBrand.mockResolvedValue({
      workspace_id: WA,
      project_id: 'project-a',
      brand_id: BRAND_A,
      state: 'mapped',
    });
    const result = await proveCampaignScope({
      workspace: WA,
      brandId: BRAND_A,
      canvasId: 'canvas-a',
      runId: 'run-a',
      request: request as never,
      resolveBrand,
    });
    expect(result).toEqual({ status: 'ok' });
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      'get_canvas_context',
      'get_run',
      'get_project',
    ]);
    expect(resolveBrand).toHaveBeenCalledWith({ workspace_id: WA, project_id: 'project-a' });
  });

  it('stops at the workspace mismatch before asking about the brand', async () => {
    request.mockReset();
    resolveBrand.mockReset();
    request.mockImplementation(async (operation: string, input: { id: string }) => {
      if (operation === 'get_run')
        return {
          data: { run: { runId: input.id, projectId: 'project-b', canvasId: 'canvas-b' } },
        };
      if (operation === 'get_project') return { data: { project: { workspace_id: WB } } };
      throw new Error(`unexpected ${operation}`);
    });
    const result = await proveCampaignScope({
      workspace: WA,
      brandId: BRAND_A,
      canvasId: undefined,
      runId: 'run-b',
      request: request as never,
      resolveBrand,
    });
    expect(result.status).toBe('mismatch');
    expect(resolveBrand).not.toHaveBeenCalled();
  });

  it("turns Core's refusal into the matching recovery error", async () => {
    request.mockReset();
    request.mockResolvedValue({
      error: { code: 'FORBIDDEN', message: 'Not permitted.', request_id: 'r1' },
    });
    const result = await proveCampaignScope({
      workspace: WA,
      brandId: undefined,
      canvasId: 'canvas-a',
      runId: undefined,
      request: request as never,
      resolveBrand,
    });
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('expected error');
    expect(result.error).toBeInstanceOf(PlatformRequestError);
    expect((result.error as PlatformRequestError).code).toBe('FORBIDDEN');
  });
});
