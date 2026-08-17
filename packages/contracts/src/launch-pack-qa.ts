export const META_ENGAGEMENT_BAIT =
  /(tag a friend|like if|share if|double[- ]?tap if|comment .{0,15} (below|to (get|enter|win))|vote (for|below)|follow (for|to))/iu;

export interface LaunchPackCopyFields {
  readonly primary_text: string;
  readonly headline: string;
  readonly description: string;
}

export type LaunchPackQaSeverity = 'hard' | 'soft';

export interface LaunchPackQaFinding {
  readonly code: string;
  readonly severity: LaunchPackQaSeverity;
  readonly message: string;
}

export function parseLaunchPackCopy(raw: string): LaunchPackCopyFields | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<LaunchPackCopyFields>;
      if (
        typeof parsed.primary_text === 'string' &&
        typeof parsed.headline === 'string' &&
        typeof parsed.description === 'string'
      ) {
        return {
          primary_text: parsed.primary_text.trim(),
          headline: parsed.headline.trim(),
          description: parsed.description.trim(),
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function evaluateLaunchPackCopy(
  fields: LaunchPackCopyFields,
): readonly LaunchPackQaFinding[] {
  const findings: LaunchPackQaFinding[] = [];
  if (fields.primary_text.length === 0) {
    findings.push({
      code: 'COPY_PRIMARY_EMPTY',
      severity: 'hard',
      message: 'Primary text is required.',
    });
  }
  if (fields.primary_text.length > 125) {
    findings.push({
      code: 'COPY_PRIMARY_TOO_LONG',
      severity: 'hard',
      message: `Primary text is ${String(fields.primary_text.length)} characters; Meta visible limit is 125.`,
    });
  }
  if (fields.headline.length > 40) {
    findings.push({
      code: 'COPY_HEADLINE_TOO_LONG',
      severity: 'hard',
      message: `Headline is ${String(fields.headline.length)} characters; Meta visible limit is 40.`,
    });
  }
  if (
    META_ENGAGEMENT_BAIT.test(`${fields.primary_text} ${fields.headline} ${fields.description}`)
  ) {
    findings.push({
      code: 'COPY_ENGAGEMENT_BAIT',
      severity: 'hard',
      message: 'Copy matches Meta engagement-bait phrasing and must be rewritten.',
    });
  }
  return findings;
}
