import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertOpenRouterRetentionConstraintsHonored,
  buildOpenRouterRequestBody,
  createOpenRouterCopyDescriptor,
  errorFromHttpStatus,
  OPENROUTER_COPY_MODEL_CONFIGS,
  OPENROUTER_REASONING_DISABLED,
  parseOpenRouterCompletion,
  ProviderError,
  type OpenRouterCopyInput,
  type OpenRouterCopyModelConfig,
} from '../../../packages/provider/src/index';

import { loadGoldenBriefRegistry } from './golden-brief-registry';
import {
  evaluateBlindEvalCases,
  type BlindEvalFailure,
  type BlindEvalResult,
  type BlindEvalUsage,
} from './openrouter-blind-eval-lib';

const DEFAULT_MAX_TOKENS = 1_200;
const MAX_EVAL_TOKENS_PER_REQUEST = 2_000;
const MAX_CANDIDATES = OPENROUTER_COPY_MODEL_CONFIGS.length;
const COPY_PACK_REVENUE_MICROS = 450_000;
const EVAL_BRIEF_COUNT = 3;
const LOCAL_DEV_VARS = new URL('../.dev.vars', import.meta.url);

interface CliOptions {
  readonly modelIds: readonly string[];
  readonly outputDirectory: string;
  readonly maxTokens: number;
}

interface EvalSuccessPayload {
  readonly output: string;
  readonly usage: BlindEvalUsage;
}

function requiredArgument(args: readonly string[], name: string): string {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new TypeError(`${name} is required`);
  }
  return value;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseCli(args: readonly string[]): CliOptions {
  const modelsIndex = args.indexOf('--models');
  const modelIds =
    modelsIndex === -1
      ? OPENROUTER_COPY_MODEL_CONFIGS.map((candidate) => candidate.modelId)
      : requiredArgument(args, '--models')
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
  if (modelIds.length < 2 || modelIds.length > MAX_CANDIDATES) {
    throw new TypeError(`--models must contain 2-${MAX_CANDIDATES} comma-separated model ids`);
  }
  if (new Set(modelIds).size !== modelIds.length) {
    throw new TypeError('--models cannot contain duplicates');
  }
  const outputDirectory = requiredArgument(args, '--output');
  const maxTokensIndex = args.indexOf('--max-tokens');
  const maxTokens =
    maxTokensIndex === -1
      ? DEFAULT_MAX_TOKENS
      : parsePositiveInteger(args[maxTokensIndex + 1] ?? '', '--max-tokens');
  if (maxTokens > MAX_EVAL_TOKENS_PER_REQUEST) {
    throw new TypeError(
      `--max-tokens cannot exceed the eval spend cap of ${MAX_EVAL_TOKENS_PER_REQUEST}`,
    );
  }
  return { modelIds, outputDirectory, maxTokens };
}

function configuredCandidates(modelIds: readonly string[]): readonly OpenRouterCopyModelConfig[] {
  return modelIds.map((modelId) => {
    const model = OPENROUTER_COPY_MODEL_CONFIGS.find((candidate) => candidate.modelId === modelId);
    if (model === undefined) {
      throw new TypeError(`Unregistered OpenRouter evaluation candidate: ${modelId}`);
    }
    return model;
  });
}

function shuffle<T>(values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const current = shuffled[index];
    const swap = shuffled[swapIndex];
    if (current === undefined || swap === undefined) throw new RangeError('shuffle bounds drifted');
    shuffled[index] = swap;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

function opaqueLabel(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadOpenRouterApiKey(): Promise<string> {
  const injected = process.env['OPENROUTER_API_KEY']?.trim();
  if (injected !== undefined && injected.length > 0) return injected;

  let localVariables: string;
  try {
    localVariables = await readFile(fileURLToPath(LOCAL_DEV_VARS), 'utf8');
  } catch {
    throw new TypeError('OPENROUTER_API_KEY is missing from the process and apps/core/.dev.vars');
  }
  const match = /^\s*OPENROUTER_API_KEY\s*=\s*(.+?)\s*$/mu.exec(localVariables);
  const key = match?.[1] === undefined ? '' : stripMatchingQuotes(match[1]);
  if (key.length === 0) {
    throw new TypeError('OPENROUTER_API_KEY is missing from the process and apps/core/.dev.vars');
  }
  return key;
}

function briefPrompt(brief: Awaited<ReturnType<typeof loadGoldenBriefRegistry>>[number]): string {
  return [
    'Create exactly three distinct paid-social ad-copy sets for this synthetic DTC brief.',
    'Each set must contain: Hook, Primary text, Headline, CTA, and Compliance notes.',
    'Use only supplied facts. Preserve every qualification, price term, rights limit, and required disclaimer.',
    'Do not crawl the destination. Do not invent guarantees, unsupported superlatives, scarcity, endorsements, or evidence.',
    'Avoid generic filler. Make the three hooks materially different while staying in the recorded brand voice.',
    '',
    'REGISTERED GOLDEN BRIEF:',
    JSON.stringify(brief, null, 2),
  ].join('\n');
}

async function evaluateCandidate(
  apiKey: string,
  model: OpenRouterCopyModelConfig,
  brief: Awaited<ReturnType<typeof loadGoldenBriefRegistry>>[number],
  maxTokens: number,
): Promise<EvalSuccessPayload> {
  const descriptor = createOpenRouterCopyDescriptor(model);
  const input = {
    task: 'copy',
    messages: [
      {
        role: 'system',
        content:
          'You are a claim-disciplined DTC performance copywriter. Follow the supplied brief exactly.',
      },
      { role: 'user', content: briefPrompt(brief) },
    ],
    maxTokens,
    temperature: 0.5,
  } as const satisfies OpenRouterCopyInput;
  const requestBody = buildOpenRouterRequestBody(descriptor.modelId, input);
  const response = await fetch(descriptor.endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': `blind-eval:${randomUUID()}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(45_000),
  });
  const body = await response.text();
  assertOpenRouterRetentionConstraintsHonored(response.status, body);
  if (!response.ok) throw errorFromHttpStatus('openrouter', response.status, body);
  const completion = parseOpenRouterCompletion(body, {
    modelId: descriptor.modelId,
    reasoning: OPENROUTER_REASONING_DISABLED.reasoning,
  });
  return {
    output: completion.output.text,
    usage: {
      inputTokens: completion.output.usage.inputUnits,
      outputTokens: completion.output.usage.outputUnits,
      totalTokens: completion.output.usage.totalUnits,
      providerReportedCostMicros: completion.output.usage.providerReportedCostMicros,
    },
  };
}

function failureUsage(error: unknown): BlindEvalUsage | null {
  if (!(error instanceof ProviderError)) return null;
  const { details } = error;
  const inputTokens = details['promptTokens'];
  const outputTokens = details['completionTokens'];
  const totalTokens = details['totalTokens'];
  const providerReportedCostMicros = details['providerReportedCostMicros'];
  if (
    typeof inputTokens !== 'number' ||
    typeof outputTokens !== 'number' ||
    typeof totalTokens !== 'number' ||
    typeof providerReportedCostMicros !== 'number'
  ) {
    return null;
  }
  return { inputTokens, outputTokens, totalTokens, providerReportedCostMicros };
}

function candidateFailure(
  error: unknown,
  modelId: string,
  label: string,
): Pick<BlindEvalFailure, 'reason' | 'usage'> {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message.replaceAll(modelId, `Candidate ${label}`)}`
      : 'UnknownError: candidate evaluation failed';
  return { reason: message, usage: failureUsage(error) };
}

function markdownCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll(/\r?\n/gu, ' ');
}

function scoringSheet(results: readonly BlindEvalResult[]): string {
  const rows = results
    .map((result) =>
      result.status === 'FAILED'
        ? `| ${result.briefId} | ${result.label} | FAILED | FAILED | FAILED | FAILED | FAILED | ${markdownCell(result.reason)} |`
        : `| ${result.briefId} | ${result.label} |  |  |  |  |  |  |`,
    )
    .join('\n');
  return `# Blind OpenRouter copy evaluation scoring sheet

Score each criterion from 1 (poor) to 5 (excellent). Review only the anonymized sample files; withhold \`answer-key.json\` and \`cost-report.json\` until scoring is complete.

## Criteria

- Brand-voice fit: the copy sounds like the supplied brand kit and awareness stage.
- Claim discipline: no invented guarantees, unsupported superlatives, unqualified claims, or fabricated urgency.
- Hook strength: distinct, audience-relevant openings with paid-social stopping power.
- Format compliance: exactly three usable sets with Hook, Primary text, Headline, CTA, and Compliance notes.
- Absence of generic filler: specific language grounded in the brief rather than interchangeable marketing prose.

| Brief | Candidate | Brand voice (1-5) | Claim discipline (1-5) | Hook strength (1-5) | Format compliance (1-5) | No generic filler (1-5) | Reviewer notes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${rows}
`;
}

function sampleMarkdown(result: BlindEvalResult): string {
  return `# ${result.briefId} — Candidate ${result.label}

${result.status === 'FAILED' ? `FAILED: ${result.reason}` : result.output.trim()}
`;
}

function costReport(results: readonly BlindEvalResult[], labels: readonly string[]): unknown {
  const candidates = labels.map((label) => {
    const requests = results.filter((result) => result.label === label);
    const succeeded = requests.filter((result) => result.status === 'SUCCEEDED');
    const failed = requests.filter((result) => result.status === 'FAILED');
    const requestsWithUsage = requests.filter(
      (result): result is BlindEvalResult & { readonly usage: BlindEvalUsage } =>
        result.usage !== null,
    );
    const inputTokens = requestsWithUsage.reduce(
      (sum, result) => sum + result.usage.inputTokens,
      0,
    );
    const outputTokens = requestsWithUsage.reduce(
      (sum, result) => sum + result.usage.outputTokens,
      0,
    );
    const totalTokens = requestsWithUsage.reduce(
      (sum, result) => sum + result.usage.totalTokens,
      0,
    );
    const totalCostMicros = requestsWithUsage.reduce(
      (sum, result) => sum + result.usage.providerReportedCostMicros,
      0,
    );
    const reliable = failed.length === 0 && succeeded.length > 0;
    const projectedPerPackCopyCostMicros = reliable
      ? Math.ceil(totalCostMicros / succeeded.length)
      : null;
    const marginMicros =
      projectedPerPackCopyCostMicros === null
        ? null
        : COPY_PACK_REVENUE_MICROS - projectedPerPackCopyCostMicros;
    return {
      label,
      requests: requests.map((result) =>
        result.status === 'FAILED'
          ? {
              briefId: result.briefId,
              status: result.status,
              reason: result.reason,
              ...(result.usage === null ? {} : result.usage),
            }
          : {
              briefId: result.briefId,
              status: result.status,
              ...result.usage,
            },
      ),
      totals: {
        successfulRequests: succeeded.length,
        failedRequests: failed.length,
        unreportedUsageRequests: requests.length - requestsWithUsage.length,
        inputTokens,
        outputTokens,
        totalTokens,
        providerReportedCostMicros: totalCostMicros,
      },
      projection: {
        method: 'mean provider-reported cost of a three-copy-set brief evaluation',
        projectedPerPackCopyCostMicros,
        copyPackRevenueMicros: COPY_PACK_REVENUE_MICROS,
        marginMicros,
        marginBasisPoints:
          marginMicros === null
            ? null
            : Math.round((marginMicros * 10_000) / COPY_PACK_REVENUE_MICROS),
        economicallyQualified:
          projectedPerPackCopyCostMicros !== null &&
          projectedPerPackCopyCostMicros <= COPY_PACK_REVENUE_MICROS,
        reliabilityQualified: reliable,
        disqualificationReason: reliable ? null : 'candidate_failed_one_or_more_requests',
      },
    };
  });
  return {
    schemaVersion: 2,
    currency: 'USD',
    integerUnit: 'micros',
    costSource: 'openrouter_usage.cost',
    providerReportedEvalCostMicros: candidates.reduce(
      (sum, candidate) => sum + candidate.totals.providerReportedCostMicros,
      0,
    ),
    candidates,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const candidates = configuredCandidates(options.modelIds);
  const apiKey = await loadOpenRouterApiKey();
  const briefs = (await loadGoldenBriefRegistry()).slice(0, EVAL_BRIEF_COUNT);
  if (briefs.map((brief) => brief.briefId).join(',') !== 'GB-01,GB-02,GB-03') {
    throw new TypeError('Blind evaluation must use the first three registered golden briefs');
  }

  const blindedCandidates = shuffle(candidates).map((model, index) => ({
    model,
    label: opaqueLabel(index),
  }));
  const cases = briefs.flatMap((brief) =>
    shuffle(blindedCandidates).map((candidate) => ({
      briefId: brief.briefId,
      label: candidate.label,
      run: () => evaluateCandidate(apiKey, candidate.model, brief, options.maxTokens),
      failure: (error: unknown) =>
        candidateFailure(error, candidate.model.modelId, candidate.label),
    })),
  );
  const results = await evaluateBlindEvalCases(cases);

  const outputDirectory = resolve(options.outputDirectory);
  const samplesDirectory = resolve(outputDirectory, 'samples');
  await mkdir(samplesDirectory, { recursive: true });
  for (const result of shuffle(results)) {
    await writeFile(
      resolve(samplesDirectory, `${result.briefId}-${result.label}.md`),
      sampleMarkdown(result),
      'utf8',
    );
  }
  const labels = blindedCandidates.map((candidate) => candidate.label);
  await writeFile(
    resolve(outputDirectory, 'answer-key.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        mappings: blindedCandidates.map(({ label, model }) => ({
          label,
          modelId: model.modelId,
        })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(resolve(outputDirectory, 'scoring-sheet.md'), scoringSheet(results), 'utf8');
  await writeFile(
    resolve(outputDirectory, 'cost-report.json'),
    `${JSON.stringify(costReport(results, labels), null, 2)}\n`,
    'utf8',
  );
  console.log(`Blind evaluation written to ${outputDirectory}`);
}

await main();
