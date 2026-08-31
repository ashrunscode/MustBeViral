import { FORBIDDEN_COLLABORATION_ROUTES } from '@mustbeviral/collaboration';

import { CanvasCoordination } from './canvas-coordination';

const CANVAS_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function parseCanvasId(pathname: string): string | null {
  const match = /^\/canvases\/([^/]+)(?:\/.*)?$/u.exec(pathname);
  if (!match?.[1]) return null;
  const canvasId = decodeURIComponent(match[1]);
  return CANVAS_ID_PATTERN.test(canvasId) ? canvasId : null;
}

function coordinationStub(
  env: CollaborationBindings,
  canvasId: string,
): DurableObjectStub<CanvasCoordination> {
  const namespace = env.CANVAS_COORDINATION;
  if (!namespace) {
    throw new Error('CANVAS_COORDINATION binding is not configured');
  }
  return namespace.get(namespace.idFromName(canvasId));
}

async function proxyToCoordination(
  request: Request,
  env: CollaborationBindings,
  canvasId: string,
  suffix: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = suffix;
  url.searchParams.set('canvas_id', canvasId);
  return coordinationStub(env, canvasId).fetch(new Request(url.toString(), request));
}

const worker = {
  async fetch(request: Request, env: CollaborationBindings): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/u, '') || '/';

    if (pathname === '/health') {
      return Response.json({
        data: {
          service: env.SERVICE_NAME,
          generation: env.SERVICE_GENERATION,
          authority: 'draft-only',
        },
      });
    }

    for (const forbidden of FORBIDDEN_COLLABORATION_ROUTES) {
      if (pathname === forbidden || pathname.startsWith(`${forbidden}/`)) {
        return jsonError(
          404,
          'NOT_FOUND',
          'Collaboration worker does not expose revision or billing authority',
        );
      }
    }

    const canvasId = parseCanvasId(pathname);
    if (!canvasId) {
      return jsonError(404, 'NOT_FOUND', 'Unknown collaboration route');
    }

    if (pathname === `/canvases/${canvasId}/snapshot` && request.method === 'GET') {
      return proxyToCoordination(request, env, canvasId, '/snapshot');
    }

    if (pathname === `/canvases/${canvasId}/ws`) {
      return proxyToCoordination(request, env, canvasId, '/ws');
    }

    return jsonError(404, 'NOT_FOUND', 'Unknown collaboration route');
  },
};

export default worker;
export { CanvasCoordination };
