import { describe, expect, it, vi } from 'vitest';
import { createPlatformHandlers, PLATFORM_OPERATIONS } from '@mustbeviral/contracts';

import { createKnowledgeAwarePlatformPort } from '../../src/composition/platform-knowledge';
import { acquiredSourceAttemptCount } from '../../src/composition/source-machine';
import type { CoreBindings } from '../../src/bindings';

const context = {
  actor_id: 'a7000000-0000-4000-8000-000000000001',
  request_id: 'knowledge-port-test',
};
const workspace = 'b7000000-0000-4000-8000-000000000001';
const brand = 'c7000000-0000-4000-8000-000000000001';
const jobId = 'd7000000-0000-4000-8000-000000000001';

function jobRecord(pending: boolean) {
  return {
    id: jobId,
    workspace_id: workspace,
    brand_id: brand,
    kind: 'website',
    status: pending ? 'capturing' : 'captured',
    request_url: 'https://washbodega.example/',
    normalized_url: 'https://washbodega.example/',
    filename: '',
    media_type: pending ? '' : 'text/html',
    attempt_count: 1,
    lease_expires_at: pending ? '2026-09-14T20:00:20.000Z' : null,
    failure_code: null,
    source_id: pending ? null : jobId,
    version: 1,
    created_by: context.actor_id,
    created_at: '2026-09-14T20:00:00.000Z',
    updated_at: '2026-09-14T20:00:00.000Z',
  };
}

describe('knowledge-aware platform port', () => {
  it('accepts only an acquired live attempt generation', () => {
    expect(acquiredSourceAttemptCount({ attempt_count: 1 })).toBe(1);
    expect(acquiredSourceAttemptCount({ attempt_count: 2 })).toBe(2);
    expect(acquiredSourceAttemptCount({ attempt_count: 3 })).toBe(3);
    expect(acquiredSourceAttemptCount({ attempt_count: 0 })).toBeNull();
    expect(acquiredSourceAttemptCount({ attempt_count: 4 })).toBeNull();
    expect(acquiredSourceAttemptCount({})).toBeNull();
  });
  it('keeps completion off the user registry and uses synthetic egress plus machine RPC', async () => {
    expect(Object.hasOwn(PLATFORM_OPERATIONS, 'record_brand_source_capture')).toBe(false);
    const html = '<html><title>WashBodega</title><p>Synthetic fixture page.</p></html>';
    const db = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command')) {
        return Response.json({
          job: jobRecord(true),
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: true,
        });
      }
      if (url.endsWith('/record_brand_source_capture')) {
        const payload = JSON.parse(String(init?.body)) as { p_payload: { source_id: string } };
        return Response.json({
          job: { ...jobRecord(false), source_id: payload.p_payload.source_id },
          draft: {
            id: jobId,
            workspace_id: workspace,
            brand_id: brand,
            version: 1,
            created_by: context.actor_id,
            updated_by: context.actor_id,
            created_at: '2026-09-14T20:00:00.000Z',
            updated_at: '2026-09-14T20:00:00.000Z',
          },
          current_candidates: [],
          next_cursor: null,
          capture_pending: false,
        });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    const publicFetch = vi.fn<typeof fetch>(
      async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    const put = vi.fn(async () => undefined);
    const del = vi.fn(async () => undefined);
    const bindings = {
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
      SUPABASE_SECRET_KEY: 'synthetic-secret',
      MEDIA_BUCKET: { put, delete: del } as unknown as R2Bucket,
    } as CoreBindings;
    const result = await createPlatformHandlers(
      createKnowledgeAwarePlatformPort(bindings, 'synthetic-user-jwt', {
        fetch: db,
        captureEgress: { mode: 'synthetic-test-seam', fetch: publicFetch },
      }),
    ).execute(
      'start_website_capture',
      { workspace_id: workspace, brand_id: brand, url: 'https://washbodega.example/' },
      context,
      'capture-key',
    );
    expect(result.status).toBe('ok');
    expect(publicFetch).toHaveBeenCalledTimes(1);
    expect(new Headers(publicFetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBeNull();
    const machineCall = db.mock.calls.find((call) =>
      String(call[0]).endsWith('/record_brand_source_capture'),
    );
    expect(machineCall).toBeDefined();
    expect(new Headers(machineCall?.[1]?.headers).get('authorization')).toBe(
      'Bearer synthetic-secret',
    );
    expect(new Headers(machineCall?.[1]?.headers).get('apikey')).toBe('synthetic-secret');
    const userCall = db.mock.calls.find((call) =>
      String(call[0]).endsWith('/platform_knowledge_command'),
    );
    expect(new Headers(userCall?.[1]?.headers).get('authorization')).toBe(
      'Bearer synthetic-user-jwt',
    );
    expect(put).toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    const payload = JSON.parse(String(machineCall?.[1]?.body)) as {
      p_payload: { r2_key: string; origin_url: string; source_id: string };
      p_expected_attempt_count: number;
    };
    expect(payload.p_payload.origin_url).toBe('https://washbodega.example/');
    expect(payload.p_payload.r2_key.startsWith('brand-sources/')).toBe(true);
    expect(payload.p_payload.r2_key.endsWith(payload.p_payload.source_id)).toBe(true);
    expect(payload.p_expected_attempt_count).toBe(1);
  });

  it('maps a completed timeout receipt to SOURCE_TIMEOUT instead of ok', async () => {
    const db = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command')) {
        return Response.json({
          job: jobRecord(true),
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: true,
        });
      }
      if (url.endsWith('/fail_brand_source_job')) {
        return Response.json({
          job: {
            ...jobRecord(true),
            status: 'failed',
            failure_code: 'SOURCE_TIMEOUT',
            lease_expires_at: null,
          },
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: false,
        });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    const publicFetch = vi.fn<typeof fetch>(async () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    });
    const result = await createPlatformHandlers(
      createKnowledgeAwarePlatformPort(
        {
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
          SUPABASE_SECRET_KEY: 'synthetic-secret',
          MEDIA_BUCKET: { put: vi.fn(), delete: vi.fn() } as unknown as R2Bucket,
        } as CoreBindings,
        'synthetic-user-jwt',
        {
          fetch: db,
          captureEgress: { mode: 'synthetic-test-seam', fetch: publicFetch },
        },
      ),
    ).execute(
      'start_website_capture',
      { workspace_id: workspace, brand_id: brand, url: 'https://washbodega.example/' },
      context,
      'timeout-key',
    );
    expect(result).toEqual({ status: 'error', code: 'SOURCE_TIMEOUT' });
    const failCall = db.mock.calls.find((call) =>
      String(call[0]).endsWith('/fail_brand_source_job'),
    );
    expect(JSON.parse(String(failCall?.[1]?.body))).toMatchObject({
      p_request_id: context.request_id,
      p_expected_attempt_count: 1,
      p_failure_code: 'SOURCE_TIMEOUT',
    });
  });

  it('does not callback with a guessed generation when acquisition omitted attempt_count', async () => {
    const db = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith('/platform_knowledge_command')) {
        return Response.json({
          job: { ...jobRecord(true), attempt_count: 0 },
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: true,
        });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    const result = await createPlatformHandlers(
      createKnowledgeAwarePlatformPort(
        {
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
          SUPABASE_SECRET_KEY: 'synthetic-secret',
          MEDIA_BUCKET: { put: vi.fn(), delete: vi.fn() } as unknown as R2Bucket,
        } as CoreBindings,
        'synthetic-user-jwt',
        { fetch: db },
      ),
    ).execute(
      'start_website_capture',
      { workspace_id: workspace, brand_id: brand, url: 'https://washbodega.example/' },
      context,
      'missing-generation-key',
    );
    expect(result).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
    expect(db.mock.calls.some((call) => String(call[0]).endsWith('/fail_brand_source_job'))).toBe(
      false,
    );
    expect(
      db.mock.calls.some((call) => String(call[0]).endsWith('/record_brand_source_capture')),
    ).toBe(false);
  });

  it('sends the acquired attempt generation on fail and record without rereading the job', async () => {
    const db = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command')) {
        return Response.json({
          job: { ...jobRecord(true), attempt_count: 2 },
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: true,
        });
      }
      if (url.endsWith('/fail_brand_source_job')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ p_expected_attempt_count: 2 });
        return Response.json({
          job: {
            ...jobRecord(true),
            attempt_count: 2,
            status: 'failed',
            failure_code: 'SOURCE_UNREACHABLE',
            lease_expires_at: null,
          },
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: false,
        });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    const publicFetch = vi.fn<typeof fetch>(async () => {
      throw new Error('unreachable fixture');
    });
    const result = await createPlatformHandlers(
      createKnowledgeAwarePlatformPort(
        {
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
          SUPABASE_SECRET_KEY: 'synthetic-secret',
          MEDIA_BUCKET: { put: vi.fn(), delete: vi.fn() } as unknown as R2Bucket,
        } as CoreBindings,
        'synthetic-user-jwt',
        {
          fetch: db,
          captureEgress: { mode: 'synthetic-test-seam', fetch: publicFetch },
        },
      ),
    ).execute(
      'start_website_capture',
      { workspace_id: workspace, brand_id: brand, url: 'https://washbodega.example/' },
      context,
      'generation-key',
    );
    expect(result).toEqual({ status: 'error', code: 'SOURCE_UNREACHABLE' });
    expect(db.mock.calls.some((call) => String(call[0]).includes('get_source_job'))).toBe(false);
  });

  it('returns a valid awaiting_bytes start without treating it as a completed capture', async () => {
    const db = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith('/platform_knowledge_command')) {
        return Response.json({
          job: {
            ...jobRecord(false),
            kind: 'document',
            status: 'awaiting_bytes',
            request_url: '',
            normalized_url: '',
            filename: 'notes.md',
            media_type: 'text/markdown',
            source_id: null,
            lease_expires_at: null,
          },
          draft: null,
          current_candidates: [],
          next_cursor: null,
          capture_pending: false,
        });
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    const result = await createPlatformHandlers(
      createKnowledgeAwarePlatformPort(
        {
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
          SUPABASE_SECRET_KEY: 'synthetic-secret',
          MEDIA_BUCKET: { put: vi.fn(), delete: vi.fn() } as unknown as R2Bucket,
        } as CoreBindings,
        'synthetic-user-jwt',
        { fetch: db },
      ),
    ).execute(
      'start_document_capture',
      {
        workspace_id: workspace,
        brand_id: brand,
        filename: 'notes.md',
        media_type: 'text/markdown',
      },
      context,
      'doc-start-key',
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.job.status).toBe('awaiting_bytes');
      expect(result.data.capture_pending).toBe(false);
    }
    expect(
      db.mock.calls.some((call) => String(call[0]).endsWith('/record_brand_source_capture')),
    ).toBe(false);
  });

  it('returns FORBIDDEN without a job payload and without running capture', async () => {
    const publicFetch = vi.fn<typeof fetch>();
    const db = vi.fn<typeof fetch>(async () =>
      Response.json({ message: 'FORBIDDEN', code: '42501' }, { status: 403 }),
    );
    const result = await createPlatformHandlers(
      createKnowledgeAwarePlatformPort(
        {
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
          SUPABASE_SECRET_KEY: 'synthetic-secret',
          MEDIA_BUCKET: { put: vi.fn(), delete: vi.fn() } as unknown as R2Bucket,
        } as CoreBindings,
        'synthetic-user-jwt',
        {
          fetch: db,
          captureEgress: { mode: 'synthetic-test-seam', fetch: publicFetch },
        },
      ),
    ).execute(
      'start_website_capture',
      { workspace_id: workspace, brand_id: brand, url: 'https://washbodega.example/' },
      context,
      'denied-key',
    );
    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(publicFetch).not.toHaveBeenCalled();
  });

  it('extracts typed assertions from private R2 bytes without a user capture-complete operation', async () => {
    const sourceId = 'e8000000-0000-4000-8000-000000000001';
    const html =
      '<!doctype html><html lang="en"><body><section data-offering="self-serve wash">Self-serve washers at WashBodega.</section></body></html>';
    const review = {
      record: {
        id: jobId,
        workspace_id: workspace,
        brand_id: brand,
        version: 2,
        created_by: context.actor_id,
        updated_by: context.actor_id,
        created_at: '2026-09-15T00:00:00.000Z',
        updated_at: '2026-09-15T00:00:00.000Z',
      },
      draft_hash: 'a'.repeat(64),
      current_assertions: [],
      current_proposals: [],
      current_questions: [],
      approved_version: null,
      extract_pending: false,
      next_cursor: null,
    };
    const db = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/platform_knowledge_command')) {
        return Response.json({ ...review, extract_pending: true, current_assertions: [] });
      }
      if (url.endsWith('/record_brand_extraction')) {
        const body = JSON.parse(String(init?.body)) as {
          p_assertions: Array<{ kind: string; reusable: boolean }>;
        };
        expect(body.p_assertions.some((item) => item.kind === 'offering')).toBe(true);
        expect(body.p_assertions.every((item) => item.reusable === false)).toBe(true);
        return Response.json(review);
      }
      return Response.json({ message: 'unexpected' }, { status: 500 });
    });
    const get = vi.fn(async () => ({
      arrayBuffer: async () => new TextEncoder().encode(html).buffer,
      httpMetadata: { contentType: 'text/html' },
    }));
    const result = await createPlatformHandlers(
      createKnowledgeAwarePlatformPort(
        {
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
          SUPABASE_SECRET_KEY: 'synthetic-secret',
          MEDIA_BUCKET: { get, put: vi.fn(), delete: vi.fn() } as unknown as R2Bucket,
        } as CoreBindings,
        'synthetic-user-jwt',
        { fetch: db },
      ),
    ).execute(
      'extract_brand_knowledge',
      { workspace_id: workspace, brand_id: brand, source_id: sourceId },
      context,
      'extract-key',
    );
    expect(result.status).toBe('ok');
    expect(get).toHaveBeenCalled();
    expect(Object.hasOwn(PLATFORM_OPERATIONS, 'record_brand_extraction')).toBe(false);
  });
});
