import { readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

import {
  API_SCHEMA_VERSION,
  ApiErrorEnvelopeSchema,
  ApplyCanvasPatchBodySchema,
  ApproveArtifactsBodySchema,
  CancelRunBodySchema,
  CreateArtifactUploadBodySchema,
  CreateCanvasBodySchema,
  CreateExportBodySchema,
  CreateProjectBodySchema,
  CreateWorkspaceBodySchema,
  EmptyBodySchema,
  HealthResponseSchema,
  IngestFalWebhookResourceInputSchema,
  P0_OPERATION_DATA_SCHEMAS,
  QuoteRunBodySchema,
  StartRunBodySchema,
  contractSchemaToJsonSchema,
  createApiSuccessEnvelopeSchema,
  type ContractSchema,
  type P0RestOperation,
} from '../../packages/contracts/src/index';
import { V1_ROUTE_TABLE } from '../../apps/core/src/routes/v1-table';

const outputPath = 'packages/contracts/openapi/core.v1.json';

const bodySchemas: Partial<Readonly<Record<P0RestOperation, ContractSchema>>> = {
  create_workspace: CreateWorkspaceBodySchema,
  create_project: CreateProjectBodySchema,
  create_canvas: CreateCanvasBodySchema,
  apply_canvas_patch: ApplyCanvasPatchBodySchema,
  validate_graph: EmptyBodySchema,
  quote_run: QuoteRunBodySchema,
  start_run: StartRunBodySchema,
  cancel_run: CancelRunBodySchema,
  create_artifact_upload: CreateArtifactUploadBodySchema,
  approve_artifacts: ApproveArtifactsBodySchema,
  create_export: CreateExportBodySchema,
  ingest_fal_webhook: IngestFalWebhookResourceInputSchema.shape.event,
};

const createdOperations = new Set([
  'create_workspace',
  'create_project',
  'create_canvas',
  'start_run',
  'create_artifact_upload',
  'create_export',
]);

function schemaName(operation: string): string {
  return operation
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function summary(operation: string): string {
  const words = operation.replaceAll('_', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function buildOpenApi() {
  const schemas: Record<string, unknown> = {
    HealthResponse: contractSchemaToJsonSchema(HealthResponseSchema),
    ApiErrorEnvelope: contractSchemaToJsonSchema(ApiErrorEnvelopeSchema),
  };
  const paths: Record<string, Record<string, unknown>> = {
    '/health': {
      get: {
        operationId: 'get_health',
        summary: 'Get service health',
        responses: {
          '200': {
            description: 'The Core Worker is healthy.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  schema_version: API_SCHEMA_VERSION,
                  service: 'mustbeviral-core',
                  generation: 'viralgraph-cleanroom-v2',
                  status: 'ok',
                  request_id: 'health-request-0001',
                },
              },
            },
          },
        },
      },
    },
  };

  for (const route of V1_ROUTE_TABLE) {
    const operationName = schemaName(route.operation);
    const successName = `${operationName}Success`;
    const requestName = `${operationName}Request`;
    schemas[successName] = contractSchemaToJsonSchema(
      createApiSuccessEnvelopeSchema(P0_OPERATION_DATA_SCHEMAS[route.operation]),
    );
    const bodySchema = bodySchemas[route.operation];
    if (bodySchema !== undefined) {
      schemas[requestName] = contractSchemaToJsonSchema(bodySchema);
    }

    const path = `/v1${route.path.replace(':id', '{id}')}`;
    const parameters: unknown[] = [
      {
        in: 'header',
        name: 'X-Request-Id',
        required: false,
        schema: { type: 'string', minLength: 8, maxLength: 128 },
      },
    ];
    if (route.path.includes(':id')) {
      parameters.push({
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', minLength: 1, maxLength: 200 },
      });
    }
    if (route.mutation && route.auth === 'supabase_jwt') {
      parameters.push({
        in: 'header',
        name: 'Idempotency-Key',
        required: true,
        schema: { type: 'string', minLength: 1, maxLength: 200 },
      });
    }

    const successStatus =
      route.auth === 'fal_signature'
        ? '202'
        : createdOperations.has(route.operation)
          ? '201'
          : '200';
    const operation = {
      operationId: route.operation,
      summary: summary(route.operation),
      security: route.auth === 'supabase_jwt' ? [{ bearerAuth: [] }] : [{ falSignature: [] }],
      parameters,
      ...(bodySchema === undefined
        ? {}
        : {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: { $ref: `#/components/schemas/${requestName}` } },
              },
            },
          }),
      responses: {
        [successStatus]: {
          description: 'Operation completed.',
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${successName}` } },
          },
        },
        default: {
          description: 'Operation failed with a typed API error.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' } },
          },
        },
      },
    };
    (paths[path] ??= {})[route.method.toLowerCase()] = operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'MustBeViral Core API',
      version: API_SCHEMA_VERSION,
      description: 'Typed P0 REST contract for the ViralGraph cleanroom Core Worker.',
    },
    servers: [{ url: '/' }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        falSignature: { type: 'apiKey', in: 'header', name: 'X-Fal-Signature' },
      },
      schemas,
    },
  } as const;
}

async function main() {
  const prettierConfig = await resolveConfig(outputPath);
  const content = await format(JSON.stringify(buildOpenApi()), {
    ...prettierConfig,
    filepath: outputPath,
    parser: 'json',
  });
  if (process.argv.includes('--check')) {
    const current = readFileSync(outputPath, 'utf8');
    if (current !== content) {
      console.error(`Generated OpenAPI drift: ${outputPath}`);
      process.exitCode = 1;
    } else {
      console.log(`Generated OpenAPI is current: ${outputPath}.`);
    }
  } else {
    writeFileSync(outputPath, content, 'utf8');
    console.log(`Generated OpenAPI updated: ${outputPath}.`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
