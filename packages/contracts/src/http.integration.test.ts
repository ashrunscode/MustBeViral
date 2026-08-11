import { describe, expect, it } from 'vitest';

import openApi from '../openapi/core.v1.json';
import { API_SCHEMA_VERSION, HealthResponseSchema, SERVICE_GENERATION } from './http';
import { P0_AUTHENTICATED_REST_OPERATIONS, P0_REST_OPERATIONS } from './rest';

describe('Zod and OpenAPI integration', () => {
  it('keeps the published health example valid against the runtime schema', () => {
    const example =
      openApi.paths['/health'].get.responses['200'].content['application/json'].example;
    expect(HealthResponseSchema.parse(example)).toEqual(example);
    expect(example.schema_version).toBe(API_SCHEMA_VERSION);
    expect(example.generation).toBe(SERVICE_GENERATION);
  });

  it('publishes health and the complete P0 Worker surface from the contract generator', () => {
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

    expect(Object.keys(document.paths)).toHaveLength(20);
    expect(operations).toEqual(['get_health', ...P0_REST_OPERATIONS]);
    expect(
      operations.filter((operation) =>
        P0_AUTHENTICATED_REST_OPERATIONS.includes(
          operation as (typeof P0_AUTHENTICATED_REST_OPERATIONS)[number],
        ),
      ),
    ).toHaveLength(18);
  });
});
