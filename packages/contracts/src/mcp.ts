import { z } from 'zod';

import {
  ApplyCanvasPatchInputSchema,
  CancelRunInputSchema,
  GetCanvasContextInputSchema,
  GetRunInputSchema,
  QuoteRunInputSchema,
  StartRunInputSchema,
  ValidateGraphInputSchema,
} from './commands';
import {
  CreateExportResourceInputSchema,
  ExplainModelResourceInputSchema,
  GetArtifactResourceInputSchema,
  GetReceiptResourceInputSchema,
} from './rest';
import type { P0RestHandlers } from './rest';

export const P0_MCP_TOOL_NAMES = [
  'get_canvas_context',
  'apply_canvas_patch',
  'quote_run',
  'start_run',
  'get_run',
] as const;

export const P1B_MCP_TOOL_NAMES = [
  'validate_graph',
  'cancel_run',
  'get_artifact',
  'create_export',
  'explain_model',
  'get_receipt',
] as const;

export const PRODUCTION_MCP_TOOL_NAMES = [...P0_MCP_TOOL_NAMES, ...P1B_MCP_TOOL_NAMES] as const;

export type P0McpToolName = (typeof P0_MCP_TOOL_NAMES)[number];
export type P1bMcpToolName = (typeof P1B_MCP_TOOL_NAMES)[number];
export type ProductionMcpToolName = (typeof PRODUCTION_MCP_TOOL_NAMES)[number];

export const P0McpToolInputSchemas = {
  get_canvas_context: GetCanvasContextInputSchema.omit({ context: true }),
  apply_canvas_patch: ApplyCanvasPatchInputSchema.omit({ context: true }),
  quote_run: QuoteRunInputSchema.omit({ context: true }),
  start_run: StartRunInputSchema.omit({ context: true }),
  get_run: GetRunInputSchema.omit({ context: true }),
} as const satisfies Readonly<Record<P0McpToolName, z.ZodType>>;

export const P1bMcpToolInputSchemas = {
  validate_graph: ValidateGraphInputSchema.omit({ context: true }),
  cancel_run: CancelRunInputSchema.omit({ context: true }),
  get_artifact: GetArtifactResourceInputSchema.omit({ context: true }),
  create_export: CreateExportResourceInputSchema.omit({ context: true }),
  explain_model: ExplainModelResourceInputSchema.omit({ context: true }),
  get_receipt: GetReceiptResourceInputSchema.omit({ context: true }),
} as const satisfies Readonly<Record<P1bMcpToolName, z.ZodType>>;

export const ProductionMcpToolInputSchemas = {
  ...P0McpToolInputSchemas,
  ...P1bMcpToolInputSchemas,
} as const satisfies Readonly<Record<ProductionMcpToolName, z.ZodType>>;

const descriptions: Readonly<Record<ProductionMcpToolName, string>> = {
  get_canvas_context: 'Read the authorized canvas head revision and safe catalog context.',
  apply_canvas_patch: 'Apply an expected-revision graph patch using an idempotency key.',
  quote_run: 'Create an immutable run quote for an expected canvas revision.',
  start_run:
    'Start a paid run only with an unexpired quote, explicit confirmed=true, confirmation token, and idempotency key. Never autonomous spend.',
  get_run: 'Read authorized run progress, artifacts, costs, and recovery state.',
  validate_graph:
    'Validate the current graph snapshot and return issues plus affected descendants.',
  cancel_run: 'Request cancellation for an authorized run using an idempotency key.',
  get_artifact: 'Read artifact metadata and short-lived access when authorized.',
  create_export:
    'Create a private export for approved artifacts. Requires explicit artifact selection.',
  explain_model: 'Explain a catalog model capability, route, and price context.',
  get_receipt: 'Read the immutable usage receipt for an authorized run.',
};

export interface P0McpToolCatalogEntry {
  readonly name: ProductionMcpToolName;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export function p0McpToolCatalog(): readonly P0McpToolCatalogEntry[] {
  return P0_MCP_TOOL_NAMES.map((name) => ({
    name,
    description: descriptions[name],
    inputSchema: z.toJSONSchema(P0McpToolInputSchemas[name], {
      target: 'draft-2020-12',
    }) as Readonly<Record<string, unknown>>,
  }));
}

export function productionMcpToolCatalog(): readonly P0McpToolCatalogEntry[] {
  return PRODUCTION_MCP_TOOL_NAMES.map((name) => ({
    name,
    description: descriptions[name],
    inputSchema: z.toJSONSchema(ProductionMcpToolInputSchemas[name], {
      target: 'draft-2020-12',
    }) as Readonly<Record<string, unknown>>,
  }));
}

export function p0McpHandlers(handlers: P0RestHandlers) {
  return Object.fromEntries(P0_MCP_TOOL_NAMES.map((name) => [name, handlers[name]])) as Pick<
    P0RestHandlers,
    P0McpToolName
  >;
}

export function productionMcpHandlers(handlers: P0RestHandlers) {
  return Object.fromEntries(
    PRODUCTION_MCP_TOOL_NAMES.map((name) => [name, handlers[name as keyof P0RestHandlers]]),
  ) as Pick<P0RestHandlers, ProductionMcpToolName>;
}
