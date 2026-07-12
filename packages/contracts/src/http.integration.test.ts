import { describe, expect, it } from 'vitest';

import openApi from '../openapi/core.v1.json';
import { API_SCHEMA_VERSION, HealthResponseSchema, SERVICE_GENERATION } from './http';

describe('Zod and OpenAPI integration', () => {
  it('keeps the published health example valid against the runtime schema', () => {
    const example =
      openApi.paths['/health'].get.responses['200'].content['application/json'].example;
    expect(HealthResponseSchema.parse(example)).toEqual(example);
    expect(example.schema_version).toBe(API_SCHEMA_VERSION);
    expect(example.generation).toBe(SERVICE_GENERATION);
  });
});
