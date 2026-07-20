import { describe, expect, it } from 'vitest';

import { P0_MCP_TOOL_NAMES, P0McpToolInputSchemas, p0McpToolCatalog } from './mcp';

describe('private P0 MCP contract', () => {
  it('publishes exactly the five accepted private tools', () => {
    expect(P0_MCP_TOOL_NAMES).toEqual([
      'get_canvas_context',
      'apply_canvas_patch',
      'quote_run',
      'start_run',
      'get_run',
    ]);
    expect(p0McpToolCatalog().map((tool) => tool.name)).toEqual(P0_MCP_TOOL_NAMES);
  });

  it('derives explicit confirmation and idempotency requirements from command schemas', () => {
    expect(() =>
      P0McpToolInputSchemas.start_run.parse({
        quote_id: 'quote-1',
        confirmed: false,
        confirmation_token: 'confirmation-token-1',
        idempotency_key: 'idem-1',
      }),
    ).toThrow();
    expect(() =>
      P0McpToolInputSchemas.apply_canvas_patch.parse({
        canvas_id: 'canvas-1',
        expected_revision_id: 'revision-1',
        reason: 'Fixture update',
        patch: {},
      }),
    ).toThrow();
  });
});
