import {
  API_SCHEMA_VERSION,
  HealthResponseSchema,
  SERVICE_GENERATION,
} from '@mustbeviral/contracts';
import { Hono } from 'hono';

import type { CoreHonoEnvironment } from '../bindings';

export const healthRoute = new Hono<CoreHonoEnvironment>().get('/', (context) =>
  context.json(
    HealthResponseSchema.parse({
      schema_version: API_SCHEMA_VERSION,
      service: 'mustbeviral-core',
      generation: SERVICE_GENERATION,
      status: 'ok',
      request_id: context.get('requestId'),
    }),
    200,
  ),
);
