export interface BlindEvalUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly providerReportedCostMicros: number;
}

export interface BlindEvalSuccess {
  readonly status: 'SUCCEEDED';
  readonly briefId: string;
  readonly label: string;
  readonly output: string;
  readonly usage: BlindEvalUsage;
}

export interface BlindEvalFailure {
  readonly status: 'FAILED';
  readonly briefId: string;
  readonly label: string;
  readonly reason: string;
  readonly usage: BlindEvalUsage | null;
}

export type BlindEvalResult = BlindEvalSuccess | BlindEvalFailure;

interface BlindEvalSuccessPayload {
  readonly output: string;
  readonly usage: BlindEvalUsage;
}

export interface BlindEvalCase {
  readonly briefId: string;
  readonly label: string;
  readonly run: () => Promise<BlindEvalSuccessPayload>;
  readonly failure: (error: unknown) => Readonly<{
    reason: string;
    usage: BlindEvalUsage | null;
  }>;
}

export async function evaluateBlindEvalCases(
  cases: readonly BlindEvalCase[],
): Promise<BlindEvalResult[]> {
  const results: BlindEvalResult[] = [];
  for (const candidateCase of cases) {
    try {
      const result = await candidateCase.run();
      results.push({
        status: 'SUCCEEDED',
        briefId: candidateCase.briefId,
        label: candidateCase.label,
        ...result,
      });
    } catch (error) {
      results.push({
        status: 'FAILED',
        briefId: candidateCase.briefId,
        label: candidateCase.label,
        ...candidateCase.failure(error),
      });
    }
  }
  return results;
}
