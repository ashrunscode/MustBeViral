import { describe, expect, it } from 'vitest';

import {
  P0_MCP_TOOL_NAMES,
  P1B_MCP_TOOL_NAMES,
  PRODUCTION_MCP_TOOL_NAMES,
  productionMcpToolCatalog,
} from './mcp';

describe('production MCP catalog', () => {
  it('keeps the private P0 proof tools and adds read-only production adapters', () => {
    expect(P0_MCP_TOOL_NAMES).toHaveLength(5);
    expect(P1B_MCP_TOOL_NAMES).toEqual([
      'validate_graph',
      'cancel_run',
      'get_artifact',
      'create_export',
      'explain_model',
      'get_receipt',
    ]);
    expect(PRODUCTION_MCP_TOOL_NAMES).toHaveLength(11);
    expect(productionMcpToolCatalog().map((tool) => tool.name)).toEqual(PRODUCTION_MCP_TOOL_NAMES);
    expect(
      productionMcpToolCatalog().find((tool) => tool.name === 'start_run')?.description,
    ).toMatch(/Never autonomous spend/i);
  });
});
