export const assertionKinds = [
  'offering',
  'location',
  'fact',
  'offer',
  'visual_candidate',
  'language',
] as const;
export const assertionStatuses = ['observed', 'unknown', 'corrected', 'disputed'] as const;
export const assertionMethods = [
  'data_attribute',
  'html_image',
  'html_lang',
  'markdown_section',
  'plaintext_labeled',
  'visible_text',
  'manual',
] as const;

export type AssertionKind = (typeof assertionKinds)[number];
export type AssertionStatus = (typeof assertionStatuses)[number];
export type AssertionMethod = (typeof assertionMethods)[number];

export interface RepresentativeAssertion {
  readonly kind: AssertionKind;
  readonly field_key: string;
  readonly value_text: string | null;
  readonly status: 'observed' | 'unknown';
  readonly excerpt: string;
  readonly locator: string;
  readonly method: AssertionMethod;
  readonly ends_at: string | null;
  readonly reusable: false;
}

const TEXT_LIMIT = 8000;
const EXCERPT_LIMIT = 2000;
const FIELD_LIMIT = 120;
const INJECTION =
  /ignore (previous|all) instructions|you are now|delete_all|grant .{0,80}permission|system prompt|change permission|approved knowledge/iu;
const STEREOTYPE =
  /millennial|boomer|gen[- ]?z|hispanic|latinx|african[- ]american|asian[- ]american|white neighborhood|urban poor|inner city/iu;

function clip(value: string, limit: number): string {
  const text = value.replaceAll(/\s+/gu, ' ').trim();
  return text.length <= limit ? text : text.slice(0, limit);
}

function quote(value: string): string {
  return clip(value, EXCERPT_LIMIT);
}

function fieldKey(value: string, fallback: string): string {
  const slug = clip(value, FIELD_LIMIT)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '');
  return slug.length > 0 ? slug.slice(0, FIELD_LIMIT) : fallback;
}

export function isUntrustedInstruction(text: string): boolean {
  return INJECTION.test(text) || STEREOTYPE.test(text);
}

function observed(
  kind: AssertionKind,
  field: string,
  value: string,
  locator: string,
  method: AssertionMethod,
  endsAt: string | null = null,
): RepresentativeAssertion | null {
  if (isUntrustedInstruction(value) || isUntrustedInstruction(field)) return null;
  const text = clip(value, TEXT_LIMIT);
  if (text.length === 0) return null;
  return {
    kind,
    field_key: fieldKey(field, kind),
    value_text: text,
    status: 'observed',
    excerpt: quote(text),
    locator: clip(locator, 500),
    method,
    ends_at: endsAt,
    reusable: false,
  };
}

function unknown(kind: AssertionKind): RepresentativeAssertion {
  return {
    kind,
    field_key: kind,
    value_text: null,
    status: 'unknown',
    excerpt: `No ${kind.replaceAll('_', ' ')} was supplied.`,
    locator: 'document',
    method: 'visible_text',
    ends_at: null,
    reusable: false,
  };
}

function attributeValue(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'iu'));
  return match?.[1] ?? '';
}

function parseOfferEnd(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/u);
  if (!match) return null;
  return `${match[1]}T00:00:00.000Z`;
}

function labeledHtml(html: string, attr: string, kind: AssertionKind): RepresentativeAssertion[] {
  const items: RepresentativeAssertion[] = [];
  const pattern = new RegExp(
    `<([a-z][a-z0-9]*)\\b([^>]*\\bdata-${attr}\\s*=\\s*["']([^"']+)["'][^>]*)>([\\s\\S]*?)</\\1>`,
    'giu',
  );
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(html)) !== null && items.length < 20) {
    const attrs = match[2] ?? '';
    const name = match[3] ?? '';
    const body = (match[4] ?? '').replaceAll(/<[^>]+>/gu, ' ');
    const ends =
      kind === 'offer' ? parseOfferEnd(attributeValue(attrs, 'data-offer-ends')) : null;
    const item = observed(kind, name, body.length > 0 ? body : name, `data-${attr}:${index}`, 'data_attribute', ends);
    if (item) items.push(item);
    index += 1;
  }
  return items;
}

function htmlImages(html: string): RepresentativeAssertion[] {
  const items: RepresentativeAssertion[] = [];
  const pattern = /<img\b([^>]*)>/giu;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(html)) !== null && items.length < 20) {
    const attrs = match[1] ?? '';
    const src = attributeValue(attrs, 'src');
    const alt = attributeValue(attrs, 'alt');
    if (!src.startsWith('https://')) {
      index += 1;
      continue;
    }
    const item = observed(
      'visual_candidate',
      alt || src,
      src,
      `img:${index}`,
      'html_image',
    );
    if (item) items.push({ ...item, reusable: false });
    index += 1;
  }
  return items;
}

function htmlLanguage(html: string): RepresentativeAssertion[] {
  const tag = html.match(/<html\b([^>]*)>/iu);
  const lang = tag ? attributeValue(tag[1] ?? '', 'lang') : '';
  const item = observed('language', 'primary_language', lang, 'html[lang]', 'html_lang');
  return item ? [item] : [];
}

function labeledLines(
  text: string,
  method: 'markdown_section' | 'plaintext_labeled',
): RepresentativeAssertion[] {
  const items: RepresentativeAssertion[] = [];
  const labels: ReadonlyArray<readonly [RegExp, AssertionKind]> = [
    [/^(?:#{1,3}\s+|[-*]\s+)?offering:\s*(.+)$/iu, 'offering'],
    [/^(?:#{1,3}\s+|[-*]\s+)?location:\s*(.+)$/iu, 'location'],
    [/^(?:#{1,3}\s+|[-*]\s+)?fact:\s*(.+)$/iu, 'fact'],
    [/^(?:#{1,3}\s+|[-*]\s+)?offer:\s*(.+)$/iu, 'offer'],
    [/^(?:#{1,3}\s+|[-*]\s+)?language:\s*(.+)$/iu, 'language'],
  ];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    for (const [pattern, kind] of labels) {
      const match = trimmed.match(pattern);
      if (!match) continue;
      const raw = match[1] ?? '';
      const [name, rest] = raw.split(/\s+—\s+|\s+-\s+/u, 2);
      let ends: string | null = null;
      if (kind === 'offer') {
        const endMatch = raw.match(/\buntil\s+(\d{4}-\d{2}-\d{2})/iu);
        ends = endMatch ? parseOfferEnd(endMatch[1] ?? '') : null;
      }
      const item = observed(
        kind,
        name ?? kind,
        rest && rest.length > 0 ? rest : raw,
        `line:${index}`,
        method,
        ends,
      );
      if (item) items.push(item);
      break;
    }
  }
  return items;
}

function withUnknowns(found: RepresentativeAssertion[]): RepresentativeAssertion[] {
  const present = new Set(found.map((item) => item.kind));
  const missing = assertionKinds
    .filter((kind) => !present.has(kind))
    .map((kind) => unknown(kind));
  return [...found, ...missing];
}

export function extractRepresentativeAssertions(input: {
  readonly mediaType: 'text/html' | 'text/markdown' | 'text/plain';
  readonly text: string;
}): readonly RepresentativeAssertion[] {
  const text = input.text;
  if (input.mediaType === 'text/html') {
    return withUnknowns([
      ...htmlLanguage(text),
      ...labeledHtml(text, 'offering', 'offering'),
      ...labeledHtml(text, 'location', 'location'),
      ...labeledHtml(text, 'fact', 'fact'),
      ...labeledHtml(text, 'offer', 'offer'),
      ...htmlImages(text),
    ]).slice(0, 40);
  }
  const method = input.mediaType === 'text/markdown' ? 'markdown_section' : 'plaintext_labeled';
  return withUnknowns(labeledLines(text, method)).slice(0, 40);
}

export function assertionsLeakBrand(
  items: readonly RepresentativeAssertion[],
  foreignMarker: string,
): boolean {
  const needle = foreignMarker.toLowerCase();
  return items.some((item) => (item.value_text ?? '').toLowerCase().includes(needle));
}
