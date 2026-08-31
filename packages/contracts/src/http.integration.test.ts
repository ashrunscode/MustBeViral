import { describe, expect, it } from 'vitest';

import openApi from '../openapi/core.v1.json';
import { API_SCHEMA_VERSION, HealthResponseSchema, SERVICE_GENERATION } from './http';
import { P0_AUTHENTICATED_REST_OPERATIONS, P0_REST_OPERATIONS } from './rest';
import { P1B_JWT_MANAGEMENT_OPERATIONS } from './p1b';

const P1B_REST_OPERATIONS = ['issue_oauth_token', ...P1B_JWT_MANAGEMENT_OPERATIONS] as const;

describe('Zod and OpenAPI integration', () => {
  it('keeps the published health example valid against the runtime schema', () => {
    const example =
      openApi.paths['/health'].get.responses['200'].content['application/json'].example;
    expect(HealthResponseSchema.parse(example)).toEqual(example);
    expect(example.schema_version).toBe(API_SCHEMA_VERSION);
    expect(example.generation).toBe(SERVICE_GENERATION);
  });

  it('publishes health and the complete P0/P1b Worker surface from the contract generator', () => {
    const document = openApi as unknown as Readonly<{
      paths: Readonly<
        Record<
          string,
          Readonly<Record<string, Readonly<{ operationId: string; security?: readonly unknown[] }>>>
        >
      >;
    }>;
    const operations = Object.values(document.paths)
      .flatMap((path) => Object.values(path))
      .map((operation) => operation.operationId);

    expect(Object.keys(document.paths)).toHaveLength(28);
    expect(operations).toEqual(['get_health', ...P0_REST_OPERATIONS, ...P1B_REST_OPERATIONS]);
    expect(
      operations.filter((operation) =>
        P0_AUTHENTICATED_REST_OPERATIONS.includes(
          operation as (typeof P0_AUTHENTICATED_REST_OPERATIONS)[number],
        ),
      ),
    ).toHaveLength(18);
    expect(operations).toContain('issue_oauth_token');
    expect(operations).toContain('publish_skill');
  });

  it('publishes exact safe get_run recovery/spend and receipt provider-job lineage fields', () => {
    const schema = JSON.stringify(openApi.components.schemas.GetRunSuccess);
    expect(schema).toContain('"recovery"');
    expect(schema).toContain('"affectedNodeKeys"');
    expect(schema).toContain('"title"');
    expect(schema).toContain('"message"');
    expect(schema).toContain('"nextAction"');
    expect(schema).toContain('"spend"');
    expect(schema).toContain('"authorizedMicros":{"type":"string","pattern":"^\\\\d+$"}');
    expect(schema).toContain('"netMicros":{"type":"string","pattern":"^\\\\d+$"}');
    expect(schema).toContain('"settlementStatus"');
    expect(schema).not.toMatch(/affectedNodes|retainedRunNodeIds|"settlement":|pendingMicros/iu);
    expect(schema).not.toMatch(/normalized_evidence|provider_payload|object_key|signed_url/iu);

    const receiptSchema = JSON.stringify(openApi.components.schemas.GetReceiptSuccess);
    expect(receiptSchema).toContain('"provider_jobs"');
    for (const field of [
      'attempt_id',
      'provider',
      'provider_model_id',
      'route_id',
      'status',
      'captured_micros',
    ]) {
      expect(receiptSchema).toContain(`"${field}"`);
    }
    expect(receiptSchema).toContain('"captured_micros":{"type":"string","pattern":"^\\\\d+$"}');
    expect(receiptSchema).not.toContain('"capture_micros"');
    expect(receiptSchema).not.toMatch(
      /object_key|signed_url|rights_attestation|approved_by|confirmed_by|workspace_id|causative_key|"metadata"|normalized_evidence|provider_request_id/iu,
    );
  });
});
