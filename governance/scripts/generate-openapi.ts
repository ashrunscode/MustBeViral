import { readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

import {
  API_SCHEMA_VERSION,
  ApiErrorEnvelopeSchema,
  ApplyCanvasPatchBodySchema,
  ApproveArtifactsBodySchema,
  CancelRunBodySchema,
  CreateApiKeyBodySchema,
  CreateArtifactUploadBodySchema,
  CreateCanvasBodySchema,
  CreateExportBodySchema,
  CreateOAuthClientBodySchema,
  CreateProjectBodySchema,
  CreateWorkspaceBodySchema,
  EmptyBodySchema,
  HealthResponseSchema,
  IngestFalWebhookResourceInputSchema,
  IssueOAuthTokenBodySchema,
  P0_OPERATION_DATA_SCHEMAS,
  P1B_OPERATION_DATA_SCHEMAS,
  PLATFORM_OPERATIONS,
  PLATFORM_OPERATION_NAMES,
  SOURCE_DOCUMENT_UPLOAD_HTTP,
  platformPathKeys,
  PublishSkillBodySchema,
  QuoteRunBodySchema,
  StartRunBodySchema,
  contractSchemaToJsonSchema,
  createApiSuccessEnvelopeSchema,
  type ContractSchema,
  type P0RestOperation,
  type P1bJwtManagementOperation,
} from '../../packages/contracts/src/index';
import { P1B_ROUTE_TABLE } from '../../apps/core/src/routes/p1b-table';
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
  'create_api_key',
  'create_oauth_client',
  'publish_skill',
]);

const p1bBodySchemas: Partial<
  Readonly<Record<P1bJwtManagementOperation | 'issue_oauth_token', ContractSchema>>
> = {
  create_api_key: CreateApiKeyBodySchema,
  create_oauth_client: CreateOAuthClientBodySchema,
  publish_skill: PublishSkillBodySchema,
  issue_oauth_token: IssueOAuthTokenBodySchema,
};

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

  for (const route of P1B_ROUTE_TABLE) {
    const operationName = schemaName(route.operation);
    const successName = `${operationName}Success`;
    const requestName = `${operationName}Request`;
    schemas[successName] = contractSchemaToJsonSchema(
      createApiSuccessEnvelopeSchema(P1B_OPERATION_DATA_SCHEMAS[route.operation]),
    );
    const bodySchema = p1bBodySchemas[route.operation];
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
    if (route.operation === 'revoke_api_key' || route.operation === 'revoke_oauth_client') {
      parameters.push({
        in: 'header',
        name: 'X-Workspace-Id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      });
    }

    const successStatus = createdOperations.has(route.operation) ? '201' : '200';
    const operation = {
      operationId: route.operation,
      summary: summary(route.operation),
      security:
        route.auth === 'client_credentials' ? [{ clientCredentials: [] }] : [{ bearerAuth: [] }],
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

  for (const name of PLATFORM_OPERATION_NAMES) {
    const definition = PLATFORM_OPERATIONS[name];
    const requestName = `${schemaName(name)}PlatformRequest`;
    const successName = `${schemaName(name)}PlatformResponse`;
    const input = contractSchemaToJsonSchema(definition.input);
    const properties = input.properties as Record<string, unknown>;
    const required = (input.required ?? []) as string[];
    const pathKeys = platformPathKeys(name);
    const mutation = definition.method !== 'GET';
    const parameters: Record<string, unknown>[] = Object.entries(properties)
      .filter(([key]) => pathKeys.includes(key) || !mutation)
      .map(([key, schema]) => ({
        in: pathKeys.includes(key) ? 'path' : 'query',
        name: key,
        required: pathKeys.includes(key) || required.includes(key),
        schema,
      }));
    if (mutation)
      parameters.push({
        in: 'header',
        name: 'Idempotency-Key',
        required: true,
        schema: { type: 'string', minLength: 1, maxLength: 200 },
      });
    schemas[requestName] = {
      ...input,
      properties: Object.fromEntries(
        Object.entries(properties).filter(([key]) => !pathKeys.includes(key)),
      ),
      required: required.filter((key) => !pathKeys.includes(key)),
    };
    schemas[successName] = contractSchemaToJsonSchema(
      createApiSuccessEnvelopeSchema(definition.output),
    );
    const path = `/v1${definition.path}`;
    (paths[path] ??= {})[definition.method.toLowerCase()] = {
      operationId: name,
      summary: summary(name),
      ...(name === 'start_document_capture'
        ? {
            description:
              'CLI and MCP send text_content up to 32768 characters. Larger documents use the REST PUT companion after claim_document_upload. CLI and MCP do not upload raw files.',
          }
        : {}),
      security: [{ bearerAuth: [] }],
      parameters,
      ...(mutation
        ? {
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: { $ref: `#/components/schemas/${requestName}` } },
              },
            },
          }
        : {}),
      responses: {
        [name.startsWith('create_') || name === 'grant_workspace_access' ? '201' : '200']: {
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
  }

  const upload = SOURCE_DOCUMENT_UPLOAD_HTTP;
  const uploadPath = `/v1${upload.path}`;
  const uploadSuccess = 'PutSourceJobContentPlatformResponse';
  schemas[uploadSuccess] = contractSchemaToJsonSchema(
    createApiSuccessEnvelopeSchema(PLATFORM_OPERATIONS.start_website_capture.output),
  );
  (paths[uploadPath] ??= {}).put = {
    operationId: 'put_source_job_content',
    summary: 'Put source job document bytes',
    description: `Authorized raw document upload after claim_document_upload. Bounded to ${String(upload.maxBytes)} bytes, ${upload.mediaTypes.join(', ')}, a ${String(upload.deadlineMs)} ms deadline, and a ${String(upload.leaseSeconds)}s lease. Available on REST and web only. CLI and MCP send start_document_capture.text_content up to ${String(upload.textContentMaxChars)} characters and do not upload raw files.`,
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        in: 'path',
        name: 'workspace_id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        in: 'path',
        name: 'brand_id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        in: 'path',
        name: 'job_id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      {
        in: 'header',
        name: 'X-Request-Id',
        required: false,
        schema: { type: 'string', minLength: 8, maxLength: 128 },
      },
    ],
    requestBody: {
      required: true,
      content: Object.fromEntries(
        upload.mediaTypes.map((mediaType) => [
          mediaType,
          { schema: { type: 'string', format: 'binary', maxLength: upload.maxBytes } },
        ]),
      ),
    },
    responses: {
      '200': {
        description: 'Capture completed.',
        content: {
          'application/json': { schema: { $ref: `#/components/schemas/${uploadSuccess}` } },
        },
      },
      default: {
        description:
          'Typed API error including SOURCE_TIMEOUT, SOURCE_TOO_LARGE, SOURCE_UNSUPPORTED, SOURCE_MALFORMED, SOURCE_INTERRUPTED, FORBIDDEN, and NOT_FOUND.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ApiErrorEnvelope' } },
        },
      },
    },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'MustBeViral Core API',
      version: API_SCHEMA_VERSION,
      description:
        'Typed execution, programmatic access and platform REST contracts for the ViralGraph cleanroom Core Worker.',
    },
    servers: [{ url: '/' }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        clientCredentials: {
          type: 'oauth2',
          flows: {
            clientCredentials: {
              tokenUrl: '/v1/oauth/token',
              scopes: {},
            },
          },
        },
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
