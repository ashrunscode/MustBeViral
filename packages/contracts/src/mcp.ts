import { z } from 'zod';

import {
  ApplyCanvasPatchInputSchema,
  GetCanvasContextInputSchema,
  GetRunInputSchema,
  QuoteRunInputSchema,
  StartRunInputSchema,
} from './commands';
import type { P0RestHandlers } from './rest';

export const P0_MCP_TOOL_NAMES = [
  'get_canvas_context',
  'apply_canvas_patch',
  'quote_run',
  'start_run',
  'get_run',
] as const;

export type P0McpToolName = (typeof P0_MCP_TOOL_NAMES)[number];

export const P0McpToolInputSchemas = {
  get_canvas_context: GetCanvasContextInputSchema.omit({ context: true }),
  apply_canvas_patch: ApplyCanvasPatchInputSchema.omit({ context: true }),
  quote_run: QuoteRunInputSchema.omit({ context: true }),
  start_run: StartRunInputSchema.omit({ context: true }),
  get_run: GetRunInputSchema.omit({ context: true }),
} as const satisfies Readonly<Record<P0McpToolName, z.ZodType>>;

const descriptions: Readonly<Record<P0McpToolName, string>> = {
  get_canvas_context: 'Read the authorized canvas head revision and safe catalog context.',
  apply_canvas_patch: 'Apply an expected-revision graph patch using an idempotency key.',
  quote_run: 'Create an immutable run quote for an expected canvas revision.',
  start_run:
    'Start a paid run only with an unexpired quote, explicit confirmed=true, confirmation token, and idempotency key.',
  get_run: 'Read authorized run progress, artifacts, costs, and recovery state.',
};

export interface P0McpToolCatalogEntry {
  readonly name: P0McpToolName;
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

export function p0McpHandlers(handlers: P0RestHandlers) {
  return Object.fromEntries(P0_MCP_TOOL_NAMES.map((name) => [name, handlers[name]])) as Pick<
    P0RestHandlers,
    P0McpToolName
  >;
}
