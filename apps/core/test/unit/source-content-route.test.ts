import { describe, expect, it, vi, afterEach } from 'vitest';

import { createCoreApp } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';

const actor = 'a7000000-0000-4000-8000-000000000001';
const workspace = 'b7000000-0000-4000-8000-000000000001';
const brand = 'c7000000-0000-4000-8000-000000000001';
const jobId = 'd7000000-0000-4000-8000-000000000001';
const forged = '00000000-0000-4000-8000-00000000dead';
const requestId = 'upload-route-test-1';

function jobRecord(status: 'capturing' | 'awaiting_bytes' | 'captured') {
  return {
    id: jobId,
    workspace_id: workspace,
    brand_id: brand,
    kind: 'document',
    status,
    request_url: '',
    normalized_url: '',
    filename: 'notes.txt',
    media_type: 'text/plain',
    attempt_count: 1,
    lease_expires_at: status === 'capturing' ? '2026-09-14T20:00:20.000Z' : null,
    failure_code: null,
    source_id: status === 'captured' ? jobId : null,
    version: 1,
    created_by: actor,
    created_at: '2026-09-14T20:00:00.000Z',
    updated_at: '2026-09-14T20:00:00.000Z',
  };
}

function captureView(status: 'capturing' | 'awaiting_bytes' | 'captured') {
  return {
    job: jobRecord(status),
    draft: null,
    current_candidates: [],
    next_cursor: null,
    capture_pending: status === 'capturing',
  };
}

function app() {
  return createCoreApp({
    handlers: {} as never,
    jwt: {
      verify: async () => ({
        actorId: actor,
        authenticationMethod: 'supabase_jwt',
      }),
    },
    workspaces: { resolve: async () => workspace },
  });
}

function bindings(
  fetchImpl: typeof fetch,
  extras: { put?: ReturnType<typeof vi.fn>; del?: ReturnType<typeof vi.fn> } = {},
) {
  return {
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
    SUPABASE_SECRET_KEY: 'synthetic-secret',
    MEDIA_BUCKET: {
      put: extras.put ?? vi.fn(async () => undefined),
      delete: extras.del ?? vi.fn(async () => undefined),
    },
    fetch: fetchImpl,
  } as unknown as CoreBindings;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('document upload HTTP route', () => {
  it('claims with brand write, ignores caller headers, and completes with the same request id', async () => {
    const put = vi.fn(async () => undefined);
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command')) {
        const body = JSON.parse(String(init?.body)) as {
          p_operation: string;
          p_request_id: string;
          p_idempotency_key: string;
        };
        expect(body.p_operation).toBe('claim_document_upload');
        expect(body.p_request_id).toBe(requestId);
        expect(body.p_idempotency_key).toBe(requestId);
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer user-jwt');
        return Response.json(captureView('capturing'));
      }
      if (url.endsWith('/record_brand_source_capture')) {
        const body = JSON.parse(String(init?.body)) as {
          p_request_id: string;
          p_expected_attempt_count: number;
          p_payload: { media_type: string };
        };
        expect(body.p_request_id).toBe(requestId);
        expect(body.p_expected_attempt_count).toBe(1);
        expect(body.p_payload.media_type).toBe('text/plain');
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer synthetic-secret');
        return Response.json(captureView('captured'));
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${jobId}/content`,
      {
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-jwt',
          'content-type': 'application/pdf',
          'x-source-filename': 'forged.bin',
          'x-request-id': requestId,
        },
        body: 'WashBodega laundry hours stay posted on the door.',
      },
      bindings(fetchImpl, { put }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { job: { status: string } } };
    expect(payload.data.job.status).toBe('captured');
    expect(put).toHaveBeenCalled();
    expect(
      fetchImpl.mock.calls.some((call) => String(call[0]).endsWith('/platform_knowledge_command')),
    ).toBe(true);
  });

  it('propagates the claimed attempt generation on persist and fail', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command')) {
        return Response.json({
          ...captureView('capturing'),
          job: { ...jobRecord('capturing'), attempt_count: 2 },
        });
      }
      if (url.endsWith('/fail_brand_source_job')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          p_request_id: requestId,
          p_expected_attempt_count: 2,
          p_failure_code: 'SOURCE_TOO_LARGE',
        });
        return Response.json(captureView('capturing'));
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${jobId}/content`,
      {
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-jwt',
          'x-request-id': requestId,
          'content-length': String(2 * 1024 * 1024 + 8),
        },
        body: 'x',
      },
      bindings(fetchImpl),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'SOURCE_TOO_LARGE',
    );
  });

  it('denies a viewer before reading the body', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith('/platform_knowledge_command')) {
        return Response.json({ message: 'FORBIDDEN', code: '42501' }, { status: 403 });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${jobId}/content`,
      {
        method: 'PUT',
        headers: { authorization: 'Bearer user-jwt', 'x-request-id': requestId },
        body: 'should-not-complete',
      },
      bindings(fetchImpl),
    );
    expect(response.status).toBe(403);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect(
      fetchImpl.mock.calls.some((call) => String(call[0]).endsWith('/record_brand_source_capture')),
    ).toBe(false);
  });

  it('hides a forged job id', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith('/platform_knowledge_command')) {
        return Response.json({ message: 'NOT_FOUND', code: 'P0002' }, { status: 404 });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${forged}/content`,
      {
        method: 'PUT',
        headers: { authorization: 'Bearer user-jwt', 'x-request-id': requestId },
        body: 'forged',
      },
      bindings(fetchImpl),
    );
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('maps a failed persist receipt to the public failure code without a job payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command'))
        return Response.json(captureView('capturing'));
      if (url.endsWith('/record_brand_source_capture')) {
        return Response.json({
          job: {
            ...jobRecord('captured'),
            status: 'failed',
            failure_code: 'SOURCE_MALFORMED',
            source_id: null,
          },
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: false,
        });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${jobId}/content`,
      {
        method: 'PUT',
        headers: { authorization: 'Bearer user-jwt', 'x-request-id': requestId },
        body: 'WashBodega laundry hours stay posted on the door.',
      },
      bindings(fetchImpl),
    );
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string }; data?: unknown };
    expect(payload.error.code).toBe('SOURCE_MALFORMED');
    expect(payload.data).toBeUndefined();
  });

  it('maps an incomplete persist receipt to SOURCE_INTERRUPTED without a job payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command'))
        return Response.json(captureView('capturing'));
      if (url.endsWith('/record_brand_source_capture'))
        return Response.json(captureView('capturing'));
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${jobId}/content`,
      {
        method: 'PUT',
        headers: { authorization: 'Bearer user-jwt', 'x-request-id': requestId },
        body: 'WashBodega laundry hours stay posted on the door.',
      },
      bindings(fetchImpl),
    );
    expect(response.status).toBe(409);
    const payload = (await response.json()) as { error: { code: string }; data?: unknown };
    expect(payload.error.code).toBe('SOURCE_INTERRUPTED');
    expect(payload.data).toBeUndefined();
  });

  it('rejects an oversized payload after a successful claim', async () => {
    const fail = vi.fn(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command'))
        return Response.json(captureView('capturing'));
      if (url.endsWith('/fail_brand_source_job')) {
        fail();
        return Response.json(captureView('capturing'));
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${jobId}/content`,
      {
        method: 'PUT',
        headers: {
          authorization: 'Bearer user-jwt',
          'x-request-id': requestId,
          'content-length': String(2 * 1024 * 1024 + 8),
        },
        body: 'x',
      },
      bindings(fetchImpl),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'SOURCE_TOO_LARGE',
    );
    expect(fail).toHaveBeenCalled();
  });

  it('times out a stalled upload body after claim using the capture deadline', async () => {
    const fail = vi.fn(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command'))
        return Response.json(captureView('capturing'));
      if (url.endsWith('/fail_brand_source_job')) {
        fail();
        return Response.json(captureView('capturing'));
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    vi.stubGlobal('fetch', fetchImpl);
    const body = new ReadableStream<Uint8Array>({
      start() {
        // Stalled fixture: the abort race must interrupt reader.read().
      },
    });
    const started = Date.now();
    const response = await app().request(
      `http://core.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/${jobId}/content`,
      {
        method: 'PUT',
        headers: { authorization: 'Bearer user-jwt', 'x-request-id': requestId },
        body,
        duplex: 'half',
      } as RequestInit,
      bindings(fetchImpl),
    );
    expect(response.status).toBe(504);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'SOURCE_TIMEOUT',
    );
    expect(fail).toHaveBeenCalled();
    expect(Date.now() - started).toBeGreaterThan(9_000);
    expect(Date.now() - started).toBeLessThan(15_000);
  }, 20_000);
});
