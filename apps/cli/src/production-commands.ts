import {
  ApplyCanvasPatchBodySchema,
  CreateExportBodySchema,
  QuoteRunBodySchema,
  type MustBeViralRestClient,
  type ProductionMcpToolName,
} from '@mustbeviral/contracts';

import {
  createIdempotencyKey,
  exitCodeForClientResponse,
  parseJsonBody,
  requireConfirmationFlag,
} from './cli-response.js';
import { CLI_EXIT_CODES } from './index.js';

export const PRODUCTION_CLI_COMMANDS = [
  'get-canvas-context',
  'apply-canvas-patch',
  'quote-run',
  'start-run',
  'get-run',
  'validate-graph',
  'cancel-run',
  'get-artifact',
  'create-export',
  'explain-model',
  'get-receipt',
] as const;

export type ProductionCliCommand = (typeof PRODUCTION_CLI_COMMANDS)[number];

export const PRODUCTION_COMMAND_TO_OPERATION = Object.freeze({
  'get-canvas-context': 'get_canvas_context',
  'apply-canvas-patch': 'apply_canvas_patch',
  'quote-run': 'quote_run',
  'start-run': 'start_run',
  'get-run': 'get_run',
  'validate-graph': 'validate_graph',
  'cancel-run': 'cancel_run',
  'get-artifact': 'get_artifact',
  'create-export': 'create_export',
  'explain-model': 'explain_model',
  'get-receipt': 'get_receipt',
} satisfies Record<ProductionCliCommand, ProductionMcpToolName>);

export interface CommandFlags {
  readonly bodyJson?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly confirmationToken?: string | undefined;
  readonly confirmed?: boolean;
  readonly confirm?: boolean;
  readonly reason?: string | undefined;
}

export interface CommandResult {
  readonly exitCode: number;
  readonly payload: unknown;
}

export async function runProductionCommand(
  client: MustBeViralRestClient,
  command: ProductionCliCommand,
  args: readonly string[],
  flags: CommandFlags,
): Promise<CommandResult> {
  switch (command) {
    case 'get-canvas-context': {
      const canvasId = args[0];
      if (canvasId === undefined) {
        throw new Error('Usage: mbv get-canvas-context <canvas-id>');
      }
      const payload = await client.request('get_canvas_context', { id: canvasId });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'get-run': {
      const runId = args[0];
      if (runId === undefined) {
        throw new Error('Usage: mbv get-run <run-id>');
      }
      const payload = await client.request('get_run', { id: runId });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'get-artifact': {
      const artifactId = args[0];
      if (artifactId === undefined) {
        throw new Error('Usage: mbv get-artifact <artifact-id>');
      }
      const payload = await client.request('get_artifact', { id: artifactId });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'explain-model': {
      const modelId = args[0];
      if (modelId === undefined) {
        throw new Error('Usage: mbv explain-model <model-id>');
      }
      const payload = await client.request('explain_model', { id: modelId });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'get-receipt': {
      const runId = args[0];
      if (runId === undefined) {
        throw new Error('Usage: mbv get-receipt <run-id>');
      }
      const payload = await client.request('get_receipt', { id: runId });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'validate-graph': {
      const canvasId = args[0];
      if (canvasId === undefined) {
        throw new Error('Usage: mbv validate-graph <canvas-id>');
      }
      const payload = await client.request('validate_graph', { id: canvasId, body: {} });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'apply-canvas-patch': {
      const canvasId = args[0];
      if (canvasId === undefined) {
        throw new Error('Usage: mbv apply-canvas-patch <canvas-id> --body-json <json>');
      }
      const body = ApplyCanvasPatchBodySchema.parse(
        parseJsonBody(flags.bodyJson, 'apply-canvas-patch'),
      );
      const payload = await client.request('apply_canvas_patch', {
        id: canvasId,
        body,
        idempotencyKey: createIdempotencyKey(flags.idempotencyKey),
      });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'quote-run': {
      const canvasId = args[0];
      if (canvasId === undefined) {
        throw new Error('Usage: mbv quote-run <canvas-id> --body-json <json>');
      }
      const body = QuoteRunBodySchema.parse(parseJsonBody(flags.bodyJson, 'quote-run'));
      const payload = await client.request('quote_run', {
        id: canvasId,
        body,
        idempotencyKey: createIdempotencyKey(flags.idempotencyKey),
      });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'start-run': {
      requireConfirmationFlag(flags.confirmed === true, 'start-run');
      const quoteId = args[0];
      const confirmationToken = flags.confirmationToken;
      if (quoteId === undefined || confirmationToken === undefined) {
        throw new Error('Usage: mbv start-run <quote-id> --confirmation-token <token> --confirmed');
      }
      const payload = await client.request('start_run', {
        id: quoteId,
        body: {
          confirmed: true,
          confirmation_token: confirmationToken,
        },
        idempotencyKey: createIdempotencyKey(flags.idempotencyKey),
      });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'cancel-run': {
      requireConfirmationFlag(flags.confirm === true, 'cancel-run');
      const runId = args[0];
      if (runId === undefined) {
        throw new Error('Usage: mbv cancel-run <run-id> --confirm [--reason <reason>]');
      }
      const payload = await client.request('cancel_run', {
        id: runId,
        body: { reason: flags.reason ?? 'Operator requested cancellation' },
        idempotencyKey: createIdempotencyKey(flags.idempotencyKey),
      });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    case 'create-export': {
      const runId = args[0];
      if (runId === undefined) {
        throw new Error('Usage: mbv create-export <run-id> --body-json <json>');
      }
      const body = CreateExportBodySchema.parse(parseJsonBody(flags.bodyJson, 'create-export'));
      const payload = await client.request('create_export', {
        id: runId,
        body,
        idempotencyKey: createIdempotencyKey(flags.idempotencyKey),
      });
      return { exitCode: exitCodeForClientResponse(payload), payload };
    }
    default: {
      const exhaustive: never = command;
      throw new Error(`Unhandled production command: ${String(exhaustive)}`);
    }
  }
}

export function isProductionCliCommand(value: string): value is ProductionCliCommand {
  return (PRODUCTION_CLI_COMMANDS as readonly string[]).includes(value);
}

export function usageErrorExitCode(error: unknown): number {
  if (error instanceof Error && /Usage:|requires --/u.test(error.message)) {
    return CLI_EXIT_CODES.usage;
  }
  return CLI_EXIT_CODES.internal;
}
