import { describe, expect, it } from 'vitest';

import {
  extractMcpEnvelope,
  inspectorCallArguments,
  parseInspectorCallOutput,
  redactAndNormalize,
  safeRequestExcerpt,
  semanticFingerprint,
} from '../../tools/mcp-parity-lib';

describe('MCP staging parity evidence helpers', () => {
  it('normalizes request identifiers and redacts every spend or access token before fingerprinting', () => {
    const left = {
      data: {
        confirmationToken: 'live-confirmation-token',
        object_key: 'private/object/key',
      },
      meta: { request_id: 'request-left' },
    };
    const right = {
      data: {
        confirmationToken: 'different-token-on-replay',
        object_key: 'different/private/object/key',
      },
      meta: { request_id: 'request-right' },
    };

    expect(redactAndNormalize(left)).toEqual({
      data: {
        confirmationToken: '<redacted>',
        object_key: '<redacted-private-location>',
      },
      meta: { request_id: '<request-id>' },
    });
    expect(semanticFingerprint(left)).toBe(semanticFingerprint(right));
  });

  it('extracts the same safe envelope from structured and text MCP tool results', () => {
    const envelope = {
      error: {
        code: 'REVISION_CONFLICT',
        message: 'The requested state change conflicts with current state.',
        request_id: 'request-1',
        retryable: false,
      },
    };

    expect(extractMcpEnvelope({ structuredContent: envelope })).toEqual(envelope);
    expect(
      extractMcpEnvelope({ content: [{ type: 'text', text: JSON.stringify(envelope) }] }),
    ).toEqual(envelope);
  });

  it('keeps secrets out of committed request excerpts while preserving the proof-bearing fields', () => {
    expect(
      safeRequestExcerpt('start_run', {
        quote_id: 'quote-1',
        confirmed: true,
        confirmation_token: 'secret-confirmation-token',
        idempotency_key: 'start-1',
      }),
    ).toEqual({
      quote_id: 'quote-1',
      confirmed: true,
      confirmation_token: '<redacted>',
      idempotency_key: 'start-1',
    });
  });

  it('passes Inspector arguments without shell interpolation and retains nested JSON as one argument', () => {
    const args = inspectorCallArguments({
      launcherPath: 'inspector.js',
      endpoint: 'https://example.test/mcp',
      tool: 'apply_canvas_patch',
      argumentsValue: {
        canvas_id: 'canvas-1',
        expected_revision_id: 'revision-1',
        reason: 'Parity vector',
        patch: { upsert_nodes: [], remove_node_ids: [], upsert_edges: [], remove_edge_ids: [] },
        idempotency_key: 'patch-1',
      },
      accessToken: 'ephemeral-token',
    });

    expect(args).toContain(
      'patch={"upsert_nodes":[],"remove_node_ids":[],"upsert_edges":[],"remove_edge_ids":[]}',
    );
    expect(args).toContain('Authorization: Bearer ephemeral-token');
  });

  it('retains Inspector tool-error results that are emitted before its documented exit code 5', () => {
    const result = {
      content: [{ type: 'text', text: '{"error":{"code":"VALIDATION_FAILED"}}' }],
      isError: true,
    };

    expect(
      parseInspectorCallOutput(
        {
          exitCode: 5,
          stdout: JSON.stringify(result),
          stderr: '{"error":{"code":"tool_is_error"}}',
        },
        'Inspector fixture',
      ),
    ).toEqual(result);
    expect(
      parseInspectorCallOutput(
        {
          exitCode: 3_221_226_505,
          stdout: JSON.stringify(result),
          stderr: 'Windows libuv shutdown assertion after result emission',
        },
        'Inspector Windows fixture',
      ),
    ).toEqual(result);
  });
});
