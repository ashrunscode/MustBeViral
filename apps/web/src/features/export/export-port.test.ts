import { describe, expect, it } from 'vitest';

import { InMemoryExportPort } from './export-port';

describe('InMemoryExportPort', () => {
  it('returns deterministic export row states and immutable receipt lineage', () => {
    const result = new InMemoryExportPort().create({
      expectedRevisionId: '7f3a',
      approvedGroupIds: ['visuals'],
    });
    expect(result.type).toBe('ok');
    if (result.type !== 'ok') return;
    expect(result.rows.map((row) => row.state)).toEqual(['ready', 'ready', 'queued', 'failed']);
    expect(result.receipt.lineage.map((row) => [row.provider, row.model, row.costMicros])).toEqual([
      ['Moonshot', 'kimi-2.6', 1_140_000n],
      ['fal', 'flux-2-klein', 2_340_000n],
      ['Moonshot', 'kimi-2.6', 240_000n],
      ['fal', 'seedance-1.0', 360_000n],
    ]);
  });

  it.each(['review_incomplete', 'conflict'] as const)('returns the %s branch', (scenario) => {
    const result = new InMemoryExportPort(scenario).create({
      expectedRevisionId: '7f3a',
      approvedGroupIds: ['visuals'],
    });
    expect(result.type).toBe(scenario);
  });
});
