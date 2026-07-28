import { describe, expect, it, vi } from 'vitest';

import { evaluateBlindEvalCases } from '../../tools/openrouter-blind-eval-lib';

describe('OpenRouter blind evaluation resilience', () => {
  it('records a failed candidate and continues evaluating later candidates', async () => {
    const laterCandidate = vi.fn(async () => ({
      output: 'Healthy copy.',
      usage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        providerReportedCostMicros: 25,
      },
    }));

    const results = await evaluateBlindEvalCases([
      {
        briefId: 'GB-01',
        label: 'A',
        run: async () => {
          throw new Error('candidate rejected reasoning control');
        },
        failure: (error) => ({
          reason: error instanceof Error ? error.message : 'unknown failure',
          usage: null,
        }),
      },
      {
        briefId: 'GB-01',
        label: 'B',
        run: laterCandidate,
        failure: () => ({ reason: 'unexpected failure', usage: null }),
      },
    ]);

    expect(results).toEqual([
      {
        status: 'FAILED',
        briefId: 'GB-01',
        label: 'A',
        reason: 'candidate rejected reasoning control',
        usage: null,
      },
      {
        status: 'SUCCEEDED',
        briefId: 'GB-01',
        label: 'B',
        output: 'Healthy copy.',
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300,
          providerReportedCostMicros: 25,
        },
      },
    ]);
    expect(laterCandidate).toHaveBeenCalledOnce();
  });
});
