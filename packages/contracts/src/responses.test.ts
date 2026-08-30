import { describe, expect, it } from 'vitest';

import {
  ApplyCanvasPatchResultSchema,
  P0_OPERATION_RESPONSE_SCHEMAS,
  P0_REST_OPERATIONS,
  QuoteRunResultSchema,
  StartRunResultSchema,
} from './index';

const timestamp = '2026-08-11T00:00:00.000Z';
const hash = 'a'.repeat(64);
const meta = { request_id: 'request-0001' };
const graph = {
  nodes: [
    {
      id: 'brief-1',
      kind: 'brief' as const,
      parameter_schema_version: 1,
      parameters: {},
    },
  ],
  edges: [],
};
const run = {
  runId: 'run-1',
  projectId: 'project-1',
  canvasId: 'canvas-1',
  canvasRevisionId: 'revision-1',
  quoteId: 'quote-1',
  status: 'succeeded' as const,
  reservationId: 'reservation-1',
};
const runNode = {
  runNodeId: 'run-node-1',
  nodeKey: 'node-1',
  modelRouteId: 'route-1',
  status: 'succeeded' as const,
  dispatchWave: 0,
};
const project = {
  brand_kit_id: null,
  brief_id: null,
  created_at: timestamp,
  created_by: 'user-1',
  id: 'project-1',
  name: 'Project',
  status: 'active',
  updated_at: timestamp,
  workspace_id: 'workspace-1',
};
const artifact = {
  accessibility_description: 'A product still life.',
  approved_at: timestamp,
  approved_by: 'user-1',
  artifact_kind: 'approved_output',
  byte_size: 100,
  canvas_revision_id: 'revision-1',
  content_hash: hash,
  created_at: timestamp,
  id: 'artifact-1',
  mime_type: 'image/png',
  object_key: 'private/object.png',
  project_id: 'project-1',
  rights_attestation: {},
  run_id: 'run-1',
  run_node_id: 'node-1',
  status: 'available',
  updated_at: timestamp,
  workspace_id: 'workspace-1',
};
const receiptArtifact = {
  accessibility_description: artifact.accessibility_description,
  approved_at: artifact.approved_at,
  artifact_kind: artifact.artifact_kind,
  byte_size: artifact.byte_size,
  canvas_revision_id: artifact.canvas_revision_id,
  content_hash: artifact.content_hash,
  created_at: artifact.created_at,
  id: artifact.id,
  mime_type: artifact.mime_type,
  project_id: artifact.project_id,
  run_id: artifact.run_id,
  run_node_id: artifact.run_node_id,
  status: artifact.status,
  updated_at: artifact.updated_at,
};
const quote = {
  quoteId: 'quote-1',
  workspaceId: 'workspace-1',
  canvasRevisionId: 'revision-1',
  priceCatalogVersionId: 'catalog-1',
  currency: 'USD' as const,
  nodeLines: [
    {
      nodeId: 'node-1',
      modelRouteId: 'model-1',
      providerModelId: 'provider/model',
      priceComponents: [
        { unit: 'request' as const, quantity: '1', unitPriceMicros: '400', totalMicros: '400' },
      ],
      totalMicros: '400',
    },
  ],
  maximumChargeMicros: '400',
  createdAt: timestamp,
  expiresAt: timestamp,
};
const handlerQuote = {
  ...quote,
  nodeLines: quote.nodeLines.map((line) => ({
    ...line,
    priceComponents: line.priceComponents.map((component) => ({
      ...component,
      quantity: BigInt(component.quantity),
      unitPriceMicros: BigInt(component.unitPriceMicros),
      totalMicros: BigInt(component.totalMicros),
    })),
    totalMicros: BigInt(line.totalMicros),
  })),
  maximumChargeMicros: BigInt(quote.maximumChargeMicros),
};

const successData = {
  create_workspace: { workspace_id: 'workspace-1', role: 'owner' },
  get_workspace: {
    workspace: {
      created_at: timestamp,
      created_by: 'user-1',
      daily_spend_cap_micros: 25_000_000,
      id: 'workspace-1',
      name: 'Workspace',
      per_run_spend_cap_micros: 8_000_000,
      slug: 'workspace',
      status: 'active',
      updated_at: timestamp,
    },
  },
  create_project: { project },
  get_project: { project },
  create_canvas: { canvasId: 'canvas-1', revisionId: 'revision-1', canonicalHash: hash },
  get_canvas_context: {
    canvas: {
      canvasId: 'canvas-1',
      projectId: 'project-1',
      headRevisionId: 'revision-1',
      graphSchemaVersion: 1,
      graphSnapshot: graph,
      canonicalHash: hash,
    },
  },
  apply_canvas_patch: {
    canvasId: 'canvas-1',
    revisionId: 'revision-2',
    canonicalHash: hash,
    affectedDescendants: ['node-1'],
  },
  validate_graph: { canvasId: 'canvas-1', revisionId: 'revision-1', valid: true, issues: [] },
  quote_run: {
    quote,
    confirmationToken: 'confirmation-token-1',
    spend: {
      runCapMicros: '8000000',
      workspaceDayCapMicros: '25000000',
      workspaceDayExposureMicros: '18420000',
    },
  },
  start_run: { run },
  get_run: {
    run,
    nodes: [runNode],
    recovery: null,
    spend: {
      currency: 'USD',
      authorizedMicros: '400',
      capturedMicros: '400',
      releasedMicros: '0',
      refundedMicros: '0',
      netMicros: '400',
      settlementStatus: 'captured',
    },
  },
  cancel_run: { runId: 'run-1', cancellation: 'accepted' },
  create_artifact_upload: {
    artifact_id: 'artifact-1',
    upload_url: 'https://uploads.example.test/exact-key',
    expires_at: timestamp,
  },
  get_artifact: {
    artifact,
    access: {
      url: 'https://core.example.test/v1/artifacts/artifact-1/content?token=review',
      expires_at: timestamp,
      purpose: 'review_preview',
    },
    copy: null,
  },
  approve_artifacts: {
    run_id: 'run-1',
    approved: 1,
    replayed: 0,
    artifacts: [{ artifact_id: 'artifact-1', artifact_kind: 'approved_output' }],
  },
  create_export: {
    artifact: {
      artifact_id: 'export-1',
      project_id: 'project-1',
      run_id: 'run-1',
      canvas_revision_id: 'revision-1',
      artifact_kind: 'export',
      status: 'available',
      object_key: 'exports/run-1.zip',
      content_hash: hash,
      mime_type: 'application/zip',
      byte_size: 200,
    },
    replayed: false,
  },
  explain_model: {
    model: {
      capability: 'copy',
      created_at: timestamp,
      driver_version: '1',
      id: 'model-1',
      input_schema_version: 1,
      output_schema_version: 1,
      provider_model_id: 'provider/model',
      provider_registration_id: 'provider-1',
      route_key: 'copy-primary',
      status: 'active',
      updated_at: timestamp,
    },
  },
  get_receipt: {
    receipt: {
      run: {
        canvas_id: 'canvas-1',
        canvas_revision_hash: hash,
        canvas_revision_id: 'revision-1',
        confirmed_at: timestamp,
        created_at: timestamp,
        dispatch_wave: 1,
        id: 'run-1',
        project_id: 'project-1',
        quote_id: 'quote-1',
        status: 'succeeded',
        updated_at: timestamp,
      },
      reservation: {
        amount_micros: 400,
        captured_micros: 400,
        created_at: timestamp,
        id: 'reservation-1',
        quote_id: 'quote-1',
        refunded_micros: 0,
        released_micros: 0,
        run_id: 'run-1',
        status: 'captured',
        updated_at: timestamp,
      },
      ledger: [
        {
          account_code: 'wallet',
          amount_micros: 400,
          created_at: timestamp,
          direction: 'debit',
          entry_type: 'capture',
          id: 'ledger-1',
          reservation_id: 'reservation-1',
          run_id: 'run-1',
          transaction_id: 'transaction-1',
        },
      ],
      artifacts: [receiptArtifact],
      lineage: [
        {
          child_artifact_id: 'artifact-1',
          created_at: timestamp,
          id: 'lineage-1',
          parent_artifact_id: 'input-1',
          relationship: 'input_to_output',
        },
      ],
      provider_jobs: [
        {
          attempt_id: 'attempt-1',
          provider: 'fal',
          provider_model_id: 'fal-ai/flux-pro',
          route_id: 'fal/flux-pro',
          status: 'succeeded',
          captured_micros: '400',
        },
      ],
    },
  },
  ingest_fal_webhook: {
    accepted: true,
    idempotent: false,
    artifact_id: 'artifact-1',
    run_status: 'succeeded',
    capture_micros: 400,
  },
} as const;

describe('P0 REST response contracts', () => {
  it('parses a live-shaped receipt whose timestamps carry microsecond offsets', () => {
    const liveTimestamp = '2026-08-15T22:21:34.848859+00:00';
    const parsed = P0_OPERATION_RESPONSE_SCHEMAS.get_receipt.safeParse({
      data: {
        receipt: {
          ...successData.get_receipt.receipt,
          run: {
            ...successData.get_receipt.receipt.run,
            created_at: liveTimestamp,
            updated_at: liveTimestamp,
            confirmed_at: liveTimestamp,
          },
          reservation: {
            ...successData.get_receipt.receipt.reservation,
            created_at: liveTimestamp,
            updated_at: liveTimestamp,
          },
          ledger: successData.get_receipt.receipt.ledger.map((entry) => ({
            ...entry,
            created_at: liveTimestamp,
          })),
          artifacts: successData.get_receipt.receipt.artifacts.map((entry) => ({
            ...entry,
            created_at: liveTimestamp,
            updated_at: liveTimestamp,
          })),
          lineage: successData.get_receipt.receipt.lineage.map((entry) => ({
            ...entry,
            created_at: liveTimestamp,
          })),
        },
      },
      meta,
    });
    expect(parsed.success).toBe(true);
  });

  it('parses a discriminated success envelope for every registered operation', () => {
    expect(Object.keys(P0_OPERATION_RESPONSE_SCHEMAS)).toEqual(P0_REST_OPERATIONS);
    for (const operation of P0_REST_OPERATIONS) {
      expect(
        P0_OPERATION_RESPONSE_SCHEMAS[operation].safeParse({
          data: successData[operation],
          meta,
        }).success,
        operation,
      ).toBe(true);
    }
  });

  it('pins safe recovery, integer-micros settlement, and strict raw-data exclusion on get_run', () => {
    const recovery = {
      data: {
        ...successData.get_run,
        run: { ...run, status: 'failed' as const },
        nodes: [
          runNode,
          {
            runNodeId: 'run-node-2',
            nodeKey: 'image-2',
            modelRouteId: 'route-1',
            status: 'failed' as const,
            dispatchWave: 1,
            providerErrorCode: 'content_policy_violation',
          },
        ],
        recovery: {
          kind: 'content_policy_violation' as const,
          affectedNodeKeys: ['image-2'],
          title: 'Image blocked',
          message:
            'The image provider blocked this branch as a content-policy violation. 1 completed branch was kept and remains reviewable.',
          nextAction:
            'Edit the brief or visual direction, then request a new quote. Do not resubmit the same prompt.',
        },
        spend: {
          currency: 'USD',
          authorizedMicros: '4550000',
          capturedMicros: '150000',
          releasedMicros: '4400000',
          refundedMicros: '0',
          netMicros: '150000',
          settlementStatus: 'partially_captured',
        },
      },
      meta,
    };
    expect(P0_OPERATION_RESPONSE_SCHEMAS.get_run.safeParse(recovery).success).toBe(true);
    expect(
      P0_OPERATION_RESPONSE_SCHEMAS.get_run.safeParse({
        ...recovery,
        data: {
          ...recovery.data,
          spend: { ...recovery.data.spend, capturedMicros: 150_000 },
        },
      }).success,
    ).toBe(false);
    expect(
      P0_OPERATION_RESPONSE_SCHEMAS.get_run.safeParse({
        ...recovery,
        data: {
          ...recovery.data,
          provider_payload: { msg: 'secret', url: 'https://signed.example.test/object' },
        },
      }).success,
    ).toBe(false);
  });

  it('pins safe receipt provider-job lineage and rejects raw provider fields or numeric micros', () => {
    const receipt = { data: successData.get_receipt, meta };
    expect(P0_OPERATION_RESPONSE_SCHEMAS.get_receipt.safeParse(receipt).success).toBe(true);
    const providerJob = successData.get_receipt.receipt.provider_jobs[0];
    if (providerJob === undefined) throw new Error('Missing receipt provider-job fixture');
    expect(
      P0_OPERATION_RESPONSE_SCHEMAS.get_receipt.safeParse({
        data: {
          receipt: {
            ...successData.get_receipt.receipt,
            provider_jobs: [{ ...providerJob, captured_micros: 400 }],
          },
        },
        meta,
      }).success,
    ).toBe(false);
    expect(
      P0_OPERATION_RESPONSE_SCHEMAS.get_receipt.safeParse({
        data: {
          receipt: {
            ...successData.get_receipt.receipt,
            provider_jobs: [
              {
                ...providerJob,
                provider_request_id: 'private-request',
                normalized_evidence: { msg: 'raw provider message' },
                url: 'https://signed.example.test/object?token=secret',
                object_key: 'private/customer/object',
              },
            ],
          },
        },
        meta,
      }).success,
    ).toBe(false);
    expect(
      P0_OPERATION_RESPONSE_SCHEMAS.get_receipt.safeParse({
        data: {
          receipt: {
            ...successData.get_receipt.receipt,
            artifacts: [
              {
                ...successData.get_receipt.receipt.artifacts[0],
                object_key: 'private/customer/object',
                rights_attestation: { evidence: 'raw customer/provider payload' },
                signed_url: 'https://signed.example.test/object?token=secret',
              },
            ],
          },
        },
        meta,
      }).success,
    ).toBe(false);
    expect(
      P0_OPERATION_RESPONSE_SCHEMAS.get_receipt.safeParse({
        data: {
          receipt: {
            ...successData.get_receipt.receipt,
            ledger: [
              {
                ...successData.get_receipt.receipt.ledger[0],
                metadata: { provider_request_id: 'private-request' },
                causative_key: 'private-causative-key',
              },
            ],
          },
        },
        meta,
      }).success,
    ).toBe(false);
  });

  it('parses the common error envelope and rejects success drift per operation', () => {
    const error = {
      error: {
        code: 'NOT_FOUND',
        message: 'The resource was not found.',
        request_id: 'request-0001',
        retryable: false,
      },
    };
    for (const operation of P0_REST_OPERATIONS) {
      expect(P0_OPERATION_RESPONSE_SCHEMAS[operation].safeParse(error).success).toBe(true);
      expect(
        P0_OPERATION_RESPONSE_SCHEMAS[operation].safeParse({ data: {}, meta }).success,
        operation,
      ).toBe(false);
    }
  });

  it('pins the hand-written handler failure unions and bigint quote/cap truth', () => {
    expect(
      ApplyCanvasPatchResultSchema.parse({
        status: 'conflict',
        reason: 'revision',
        actual: 'revision-2',
      }),
    ).toBeDefined();
    expect(
      QuoteRunResultSchema.parse({
        status: 'graph_invalid',
        issues: [{ code: 'CYCLE', message: 'The graph contains a cycle.' }],
      }),
    ).toBeDefined();
    expect(
      QuoteRunResultSchema.parse({
        status: 'ok',
        quote: handlerQuote,
        confirmationToken: 'confirmation-token-1',
        spend: {
          runCapMicros: 8_000_000n,
          workspaceDayCapMicros: 25_000_000n,
          workspaceDayExposureMicros: 18_420_000n,
        },
      }),
    ).toBeDefined();
    expect(
      StartRunResultSchema.parse({
        status: 'cap_exceeded',
        tier: 'workspace_day',
        capMicros: 25_000_000n,
        currentExposureMicros: 24_900_000n,
        requestedMicros: 400_000n,
        projectedMicros: 25_300_000n,
      }),
    ).toBeDefined();
    expect(
      StartRunResultSchema.safeParse({
        status: 'cap_exceeded',
        tier: 'workspace_daily',
        limitMicros: 25_000_000n,
        requestedMicros: 400_000n,
      }).success,
    ).toBe(false);
  });
});
