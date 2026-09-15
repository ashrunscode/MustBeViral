import { describe, expect, it, vi } from 'vitest';

import {
  BrandAssertionRecordSchema,
  createPlatformHandlers,
  mapCompletedSourceCapture,
  PLATFORM_ERRORS,
  PLATFORM_OPERATION_NAMES,
  PLATFORM_OPERATIONS,
  SOURCE_DOCUMENT_UPLOAD_HTTP,
  type PlatformPort,
} from './platform';
import { createPlatformRestClient, platformMcpToolCatalog } from './platform-transports';

const context = { actor_id: 'a7000000-0000-4000-8000-000000000001', request_id: 'knowledge-test' };
const brand = {
  workspace_id: 'b7000000-0000-4000-8000-000000000001',
  brand_id: 'c7000000-0000-4000-8000-000000000001',
};

describe('brand knowledge contracts', () => {
  it('registers knowledge operations on the shared platform_knowledge RPC', () => {
    expect(PLATFORM_OPERATIONS.start_website_capture.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.start_document_capture.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.claim_document_upload.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.list_latest_source_job.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.correct_knowledge_candidate.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.get_knowledge_draft.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATION_NAMES.indexOf('list_latest_source_job')).toBeLessThan(
      PLATFORM_OPERATION_NAMES.indexOf('get_source_job'),
    );
  });
  it.each([
    { url: 'http://example.test' },
    { url: 'https://user:pass@example.test' },
    { url: 'https://127.0.0.1/' },
    { url: 'javascript:alert(1)' },
  ])('rejects unsafe website capture as SOURCE_UNSAFE before the port: %s', async (invalid) => {
    const execute = vi.fn<PlatformPort['execute']>();
    expect(
      await createPlatformHandlers({ execute }).execute(
        'start_website_capture',
        { ...brand, ...invalid },
        context,
        'key',
      ),
    ).toEqual({ status: 'error', code: 'SOURCE_UNSAFE' });
    expect(PLATFORM_ERRORS.SOURCE_UNSAFE.httpStatus).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
  it('maps unsafe website URLs to SOURCE_UNSAFE on the REST client without calling fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = createPlatformRestClient({
      baseUrl: 'https://platform.test',
      getAccessToken: async () => 'synthetic-session',
      fetch: fetchImpl,
      createRequestId: () => 'knowledge-test',
    });
    expect(
      await client.execute('start_website_capture', { ...brand, url: 'https://127.0.0.1/' }, 'key'),
    ).toEqual({
      error: {
        code: 'SOURCE_UNSAFE',
        message: PLATFORM_ERRORS.SOURCE_UNSAFE.message,
        request_id: 'knowledge-test',
        retryable: false,
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('documents the REST PUT companion on MCP start_document_capture and keeps CLI/MCP text-only', () => {
    const tool = platformMcpToolCatalog().find((entry) => entry.name === 'start_document_capture');
    expect(tool?.description).toMatch(/REST PUT companion/u);
    expect(tool?.description).toMatch(/do not upload raw files/iu);
    expect(SOURCE_DOCUMENT_UPLOAD_HTTP.transports).toEqual(['rest', 'web']);
  });
  it('rejects unknown website capture fields as VALIDATION_FAILED', async () => {
    const execute = vi.fn<PlatformPort['execute']>();
    expect(
      await createPlatformHandlers({ execute }).execute(
        'start_website_capture',
        { ...brand, url: 'https://example.test', approved: true },
        context,
        'key',
      ),
    ).toEqual({ status: 'error', code: 'VALIDATION_FAILED' });
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([
    'application/pdf',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])('rejects unsupported document type %s at the contract', (media_type) => {
    expect(
      PLATFORM_OPERATIONS.start_document_capture.input.safeParse({
        ...brand,
        filename: 'guide.pdf',
        media_type,
      }).success,
    ).toBe(false);
  });
  it('accepts bounded text documents and manual drafts without a website', () => {
    expect(
      PLATFORM_OPERATIONS.start_document_capture.input.parse({
        ...brand,
        filename: 'notes.md',
        media_type: 'text/markdown',
        text_content: 'Pickup windows are unconfirmed.',
      }).filename,
    ).toBe('notes.md');
    expect(PLATFORM_OPERATIONS.start_manual_knowledge_draft.input.parse(brand)).toEqual(brand);
  });
  it('bounds current candidate pages instead of allowing unbounded draft payloads', () => {
    const candidate = {
      id: brand.brand_id,
      workspace_id: brand.workspace_id,
      brand_id: brand.brand_id,
      draft_id: brand.brand_id,
      source_id: brand.brand_id,
      job_id: null,
      field_key: 'heading',
      value_text: 'One',
      status: 'observed',
      excerpt: 'One',
      locator: 'heading:0',
      method: 'heading',
      captured_at: '2026-09-14T20:00:00.000Z',
      supersedes_id: null,
      created_by: context.actor_id,
      created_at: '2026-09-14T20:00:00.000Z',
    };
    expect(
      PLATFORM_OPERATIONS.get_knowledge_draft.output.safeParse({
        record: null,
        current_candidates: Array.from({ length: 51 }, () => candidate),
        next_cursor: null,
      }).success,
    ).toBe(false);
    expect(
      PLATFORM_OPERATIONS.get_knowledge_draft.output.safeParse({
        record: null,
        current_candidates: [candidate],
        next_cursor: null,
      }).success,
    ).toBe(true);
  });
  it('does not expose a user-callable capture completion operation', () => {
    expect(Object.hasOwn(PLATFORM_OPERATIONS, 'complete_source_capture')).toBe(false);
    expect(Object.hasOwn(PLATFORM_OPERATIONS, 'record_brand_source_capture')).toBe(false);
    expect(
      PLATFORM_OPERATIONS.claim_document_upload.input.parse({ ...brand, job_id: brand.brand_id }),
    ).toEqual({
      ...brand,
      job_id: brand.brand_id,
    });
    expect(
      PLATFORM_OPERATIONS.list_latest_source_job.output.safeParse({ record: null }).success,
    ).toBe(true);
    expect(SOURCE_DOCUMENT_UPLOAD_HTTP.method).toBe('PUT');
    expect(SOURCE_DOCUMENT_UPLOAD_HTTP.path).toBe(
      '/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/{job_id}/content',
    );
    expect(SOURCE_DOCUMENT_UPLOAD_HTTP.transports).toEqual(['rest', 'web']);
  });
  it('maps completed capture failures to public platform errors without a payload', () => {
    const job = {
      id: brand.brand_id,
      workspace_id: brand.workspace_id,
      brand_id: brand.brand_id,
      kind: 'website',
      status: 'failed',
      request_url: 'https://stall.example/',
      normalized_url: 'https://stall.example/',
      filename: '',
      media_type: '',
      attempt_count: 1,
      lease_expires_at: null,
      failure_code: 'SOURCE_TIMEOUT',
      source_id: null,
      version: 2,
      created_by: context.actor_id,
      created_at: '2026-09-14T20:00:00.000Z',
      updated_at: '2026-09-14T20:00:00.000Z',
    };
    const view = {
      job,
      draft: null,
      current_candidates: [],
      next_cursor: null,
      capture_pending: false,
    };
    const mapped = mapCompletedSourceCapture(view);
    expect(mapped).toEqual({ status: 'error', code: 'SOURCE_TIMEOUT' });
    expect(mapped).not.toHaveProperty('data');
    expect(PLATFORM_ERRORS.SOURCE_TIMEOUT.httpStatus).toBe(504);
    expect(PLATFORM_ERRORS.SOURCE_TIMEOUT.retryable).toBe(true);
    expect(
      mapCompletedSourceCapture({
        ...view,
        job: { ...job, status: 'capturing', failure_code: null },
      }),
    ).toEqual({
      status: 'error',
      code: 'SOURCE_INTERRUPTED',
    });
    expect(
      mapCompletedSourceCapture({
        ...view,
        job: {
          ...job,
          status: 'captured',
          failure_code: null,
          source_id: brand.brand_id,
          media_type: 'text/html',
        },
      }).status,
    ).toBe('ok');
  });
  it('registers extract, propose, question, approve and pin operations without capture completion', () => {
    expect(PLATFORM_OPERATIONS.extract_brand_knowledge.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.propose_brand_knowledge.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.correct_brand_assertion.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.ask_brand_knowledge_questions.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.answer_brand_knowledge_question.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.approve_brand_version.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.pin_brand_version.rpc).toBe('platform_knowledge');
    expect(PLATFORM_OPERATIONS.get_brand_version_pin.rpc).toBe('platform_knowledge');
    expect(Object.hasOwn(PLATFORM_OPERATIONS, 'import_brand_catalog')).toBe(false);
    expect(Object.hasOwn(PLATFORM_OPERATIONS, 'monitor_brand_changes')).toBe(false);
    expect(PLATFORM_ERRORS.EXPIRED_OFFER.httpStatus).toBe(409);
    expect(PLATFORM_ERRORS.CONTRADICTORY_KNOWLEDGE.httpStatus).toBe(409);
    expect(
      PLATFORM_OPERATIONS.approve_brand_version.input.safeParse({
        ...brand,
        expected_version: 1,
        draft_hash: 'a'.repeat(64),
      }).success,
    ).toBe(true);
    expect(
      BrandAssertionRecordSchema.safeParse({
        id: brand.brand_id,
        workspace_id: brand.workspace_id,
        brand_id: brand.brand_id,
        draft_id: brand.brand_id,
        source_id: brand.brand_id,
        job_id: null,
        kind: 'visual_candidate',
        field_key: 'storefront',
        value_text: 'https://washbodega.example/storefront.jpg',
        status: 'observed',
        excerpt: 'storefront',
        locator: 'img:0',
        method: 'html_image',
        captured_at: '2026-09-15T00:00:00.000Z',
        ends_at: null,
        reusable: false,
        supersedes_id: null,
        created_by: context.actor_id,
        created_at: '2026-09-15T00:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      BrandAssertionRecordSchema.safeParse({
        id: brand.brand_id,
        workspace_id: brand.workspace_id,
        brand_id: brand.brand_id,
        draft_id: brand.brand_id,
        source_id: brand.brand_id,
        job_id: null,
        kind: 'visual_candidate',
        field_key: 'storefront',
        value_text: 'https://washbodega.example/storefront.jpg',
        status: 'observed',
        excerpt: 'storefront',
        locator: 'img:0',
        method: 'html_image',
        captured_at: '2026-09-15T00:00:00.000Z',
        ends_at: null,
        reusable: true,
        supersedes_id: null,
        created_by: context.actor_id,
        created_at: '2026-09-15T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });
  it('keeps knowledge draft reads nullable and fails closed when unavailable', async () => {
    expect(
      await createPlatformHandlers({
        execute: async () => ({
          status: 'ok',
          data: { record: null, current_candidates: [], next_cursor: null },
        }),
      }).execute('get_knowledge_draft', brand, context),
    ).toEqual({ status: 'ok', data: { record: null, current_candidates: [], next_cursor: null } });
    expect(
      await createPlatformHandlers({
        execute: async () => {
          throw new Error('unavailable');
        },
      }).execute('get_knowledge_draft', brand, context),
    ).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });
});
