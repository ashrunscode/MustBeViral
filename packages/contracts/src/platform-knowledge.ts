import { classifyPublicHttpsUrl } from '@mustbeviral/domain';
import { z } from 'zod';

import { WireTimestampSchema } from './http';
import { uuid, brand, expected, page, version, single, list } from './platform-models';
import {
  SOURCE_CAPTURE_DEADLINE_MS,
  SOURCE_CAPTURE_LEASE_SECONDS,
  SOURCE_CAPTURE_MAX_BYTES,
  SOURCE_DOCUMENT_TEXT_MAX_CHARS,
} from './source-policy';

const url = z
  .string()
  .min(8)
  .max(2048)
  .superRefine((value, context) => {
    if (classifyPublicHttpsUrl(value).ok) return;
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'SOURCE_UNSAFE' });
  });
const mediaType = z.enum(['text/plain', 'text/markdown', 'text/html']);
const jobStatus = z.enum([
  'queued',
  'capturing',
  'awaiting_bytes',
  'captured',
  'duplicate',
  'rejected',
  'failed',
]);
const failureCode = z
  .enum([
    'SOURCE_UNSAFE',
    'SOURCE_UNSUPPORTED',
    'SOURCE_MALFORMED',
    'SOURCE_TOO_LARGE',
    'SOURCE_TIMEOUT',
    'SOURCE_UNREACHABLE',
    'SOURCE_INTERRUPTED',
    'SOURCE_EGRESS_UNAVAILABLE',
  ])
  .nullable();
const sourceKind = z.enum(['website', 'document', 'manual']);
const captureMethod = z.enum(['https_get', 'document_upload', 'manual']);
const fieldKey = z.enum([
  'page_title',
  'meta_description',
  'canonical_url',
  'heading',
  'visible_excerpt',
  'jsonld_text',
  'document_filename',
  'unknown_gap',
]);
const candidateStatus = z.enum(['observed', 'unknown', 'corrected', 'disputed']);
const candidateMethod = z.enum([
  'html_title',
  'meta_description',
  'canonical_link',
  'heading',
  'visible_text',
  'jsonld_text',
  'document_text',
  'manual',
]);
const job = { job_id: uuid };
const source = { source_id: uuid };
const candidate = { candidate_id: uuid };

export const BrandSourceJobRecordSchema = z
  .object({
    id: uuid,
    ...brand,
    kind: sourceKind,
    status: jobStatus,
    request_url: z.string().max(2048),
    normalized_url: z.string().max(2048),
    filename: z.string().max(200),
    media_type: z.string().max(100),
    // Acquired lease generation. Machine record/fail must send this value; never reread it later.
    attempt_count: z.number().int().min(0).max(2_147_483_647),
    lease_expires_at: WireTimestampSchema.nullable(),
    failure_code: failureCode,
    source_id: uuid.nullable(),
    version,
    created_by: uuid,
    created_at: WireTimestampSchema,
    updated_at: WireTimestampSchema,
  })
  .strict();
export const BrandSourceRecordSchema = z
  .object({
    id: uuid,
    ...brand,
    job_id: uuid.nullable(),
    kind: sourceKind,
    method: captureMethod,
    origin_url: z.string().max(2048),
    final_url: z.string().max(2048),
    media_type: z.string().max(100),
    byte_size: z.number().int().min(0).max(2_147_483_647),
    content_sha256: z.string().length(64).nullable(),
    http_status: z.number().int().min(0).max(599).nullable(),
    captured_at: WireTimestampSchema,
    created_by: uuid,
    created_at: WireTimestampSchema,
  })
  .strict();
export const BrandKnowledgeDraftRecordSchema = z
  .object({
    id: uuid,
    ...brand,
    version,
    created_by: uuid,
    updated_by: uuid,
    created_at: WireTimestampSchema,
    updated_at: WireTimestampSchema,
  })
  .strict();
export const BrandKnowledgeCandidateRecordSchema = z
  .object({
    id: uuid,
    ...brand,
    draft_id: uuid,
    source_id: uuid,
    job_id: uuid.nullable(),
    field_key: fieldKey,
    value_text: z.string().max(8000).nullable(),
    status: candidateStatus,
    excerpt: z.string().max(2000),
    locator: z.string().max(500),
    method: candidateMethod,
    captured_at: WireTimestampSchema,
    supersedes_id: uuid.nullable(),
    created_by: uuid,
    created_at: WireTimestampSchema,
  })
  .strict();
export const KnowledgeDraftViewSchema = z
  .object({
    record: BrandKnowledgeDraftRecordSchema.nullable(),
    current_candidates: z.array(BrandKnowledgeCandidateRecordSchema).max(50),
    next_cursor: z.string().nullable(),
  })
  .strict();
export const SourceCaptureViewSchema = z
  .object({
    job: BrandSourceJobRecordSchema,
    draft: BrandKnowledgeDraftRecordSchema.nullable(),
    current_candidates: z.array(BrandKnowledgeCandidateRecordSchema).max(50),
    next_cursor: z.string().nullable(),
    capture_pending: z.boolean(),
  })
  .strict();

const rpc = 'platform_knowledge' as const;

export const PLATFORM_KNOWLEDGE_OPERATIONS = {
  start_website_capture: {
    rpc,
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/website',
    input: z.object({ ...brand, url }).strict(),
    output: SourceCaptureViewSchema,
  },
  start_document_capture: {
    rpc,
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/documents',
    input: z
      .object({
        ...brand,
        filename: z.string().min(1).max(200),
        media_type: mediaType,
        text_content: z.string().min(1).max(32_768).optional(),
      })
      .strict(),
    output: SourceCaptureViewSchema,
  },
  claim_document_upload: {
    rpc,
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/{job_id}/upload-claim',
    input: z.object({ ...brand, ...job }).strict(),
    output: SourceCaptureViewSchema,
  },
  start_manual_knowledge_draft: {
    rpc,
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/knowledge-drafts/manual',
    input: z.object(brand).strict(),
    output: KnowledgeDraftViewSchema,
  },
  list_latest_source_job: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/latest',
    input: z.object(brand).strict(),
    output: z.object({ record: BrandSourceJobRecordSchema.nullable() }).strict(),
  },
  get_source_job: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/{job_id}',
    input: z.object({ ...brand, ...job }).strict(),
    output: single(BrandSourceJobRecordSchema),
  },
  list_brand_sources: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/sources',
    input: z.object({ ...brand, limit: page.limit, cursor: page.cursor }).strict(),
    output: list(BrandSourceRecordSchema),
  },
  get_brand_source: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/sources/{source_id}',
    input: z.object({ ...brand, ...source }).strict(),
    output: single(BrandSourceRecordSchema),
  },
  get_knowledge_draft: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/knowledge-draft',
    input: z.object({ ...brand, limit: page.limit, cursor: page.cursor }).strict(),
    output: KnowledgeDraftViewSchema,
  },
  correct_knowledge_candidate: {
    rpc,
    method: 'PATCH',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/knowledge-candidates/{candidate_id}',
    input: z
      .object({
        ...brand,
        ...candidate,
        ...expected,
        value_text: z.string().max(4000).nullable(),
        excerpt: z.string().min(1).max(2000),
        locator: z.string().max(500).optional(),
      })
      .strict(),
    output: KnowledgeDraftViewSchema,
  },
} as const;

/** REST/web companion for documents larger than start_document_capture.text_content. Not a CLI/MCP file upload. */
export const SOURCE_DOCUMENT_UPLOAD_HTTP = {
  method: 'PUT',
  path: '/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/{job_id}/content',
  maxBytes: SOURCE_CAPTURE_MAX_BYTES,
  deadlineMs: SOURCE_CAPTURE_DEADLINE_MS,
  leaseSeconds: SOURCE_CAPTURE_LEASE_SECONDS,
  textContentMaxChars: SOURCE_DOCUMENT_TEXT_MAX_CHARS,
  mediaTypes: ['text/plain', 'text/markdown', 'text/html'] as const,
  transports: ['rest', 'web'] as const,
} as const;
