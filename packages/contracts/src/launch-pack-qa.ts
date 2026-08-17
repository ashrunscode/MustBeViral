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

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function stripMarkdownDecor(value: string): string {
  return value
    .replace(/^#{1,6}\s+/u, '')
    .replace(/^\*+\s*|\s*\*+$/gu, '')
    .replace(/\*\*/gu, '')
    .replace(/^[-*]\s+/u, '')
    .trim();
}

const MARKDOWN_SPEC_STOP =
  /^(dimensions|material|filter life|odor|care|visual|pricing|key messaging|prohibited|available in|typographic|product proof|construction|no compostable)/iu;

function fromMarkdownCopy(raw: string): LaunchPackCopyFields | null {
  const lines = raw
    .split(/\r?\n/u)
    .map((line) => stripMarkdownDecor(line))
    .filter((line) => line.length > 0 && line !== '---');
  if (lines.length === 0) return null;
  const headline = lines[0] ?? '';
  const primary = lines[1] ?? headline;
  const offer: string[] = [];
  for (const line of lines.slice(2)) {
    if (MARKDOWN_SPEC_STOP.test(line)) break;
    offer.push(line);
    if (offer.join(' ').length >= 220) break;
  }
  const description = offer.join(' ').trim().slice(0, 240);
  if (headline.length === 0 || primary.length === 0) return null;
  return { headline, primary_text: primary, description };
}

export function parseLaunchPackCopy(raw: string, depth = 0): LaunchPackCopyFields | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || depth > 3) return null;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return fromMarkdownCopy(trimmed);
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const primary =
      stringField(parsed.primary_text) ??
      stringField(parsed.primaryText) ??
      stringField(parsed.body);
    const headline = stringField(parsed.headline) ?? stringField(parsed.title);
    if (primary !== undefined && headline !== undefined) {
      return {
        primary_text: primary,
        headline,
        description: stringField(parsed.description) ?? stringField(parsed.support) ?? '',
      };
    }
    const nested = stringField(parsed.text);
    if (nested !== undefined && nested !== trimmed) {
      return parseLaunchPackCopy(nested, depth + 1) ?? fromMarkdownCopy(nested);
    }
    return fromMarkdownCopy(trimmed);
  } catch {
    return fromMarkdownCopy(trimmed);
  }
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
