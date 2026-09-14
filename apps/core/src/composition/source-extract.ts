import type { KnowledgeCandidateField, KnowledgeCandidateMethod } from '@mustbeviral/contracts';

export interface ExtractedCandidate {
  readonly field_key: KnowledgeCandidateField;
  readonly value_text: string | null;
  readonly status: 'observed' | 'unknown';
  readonly excerpt: string;
  readonly locator: string;
  readonly method: KnowledgeCandidateMethod;
}

const TEXT_LIMIT = 8000;
const EXCERPT_LIMIT = 2000;

interface HtmlRewriteElement {
  getAttribute(name: string): string | null;
}
interface HtmlRewriteText {
  readonly text: string;
}
interface HtmlRewriteHandlers {
  element?(element: HtmlRewriteElement): void;
  text?(chunk: HtmlRewriteText): void;
}
interface HtmlRewriterInstance {
  on(selector: string, handlers: HtmlRewriteHandlers): HtmlRewriterInstance;
  transform(response: Response): Response;
}

function createHtmlRewriter(): HtmlRewriterInstance {
  const ctor = (globalThis as unknown as { HTMLRewriter: new () => HtmlRewriterInstance })
    .HTMLRewriter;
  return new ctor();
}

function clip(value: string, limit: number): string {
  return value.length <= limit ? value : value.slice(0, limit);
}

function quote(value: string): string {
  return clip(value.replaceAll(/\s+/gu, ' ').trim(), EXCERPT_LIMIT);
}

function pushObserved(
  items: ExtractedCandidate[],
  field: KnowledgeCandidateField,
  method: KnowledgeCandidateMethod,
  locator: string,
  value: string,
): void {
  const text = clip(value.replaceAll(/\s+/gu, ' ').trim(), TEXT_LIMIT);
  if (text.length === 0) return;
  items.push({
    field_key: field,
    value_text: text,
    status: 'observed',
    excerpt: quote(text),
    locator,
    method,
  });
}

export async function extractKnowledgeCandidates(input: {
  readonly kind: 'website' | 'document';
  readonly mediaType: string;
  readonly bytes: Uint8Array;
  readonly filename?: string;
}): Promise<readonly ExtractedCandidate[]> {
  const items: ExtractedCandidate[] = [];
  if (input.kind === 'document' && input.filename) {
    pushObserved(items, 'document_filename', 'document_text', 'filename', input.filename);
  }
  const text = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(input.bytes);
  if (input.mediaType === 'text/plain' || input.mediaType === 'text/markdown') {
    pushObserved(items, 'visible_excerpt', 'document_text', 'body', text);
    return items;
  }
  const titleChunks: string[] = [];
  const headings: string[] = [];
  let description = '';
  let canonical = '';
  const jsonld: string[] = [];
  const visible: string[] = [];
  const rewriter = createHtmlRewriter()
    .on('script[type="application/ld+json"]', {
      element() {
        if (jsonld.length < 3) jsonld.push('');
      },
      text(chunk) {
        const last = jsonld.length - 1;
        if (last >= 0) jsonld[last] = `${jsonld[last] ?? ''}${chunk.text}`;
      },
    })
    .on('title', {
      text(chunk) {
        titleChunks.push(chunk.text);
      },
    })
    .on('meta', {
      element(element) {
        const name = (
          element.getAttribute('name') ??
          element.getAttribute('property') ??
          ''
        ).toLowerCase();
        if (name === 'description' || name === 'og:description') {
          description = element.getAttribute('content') ?? description;
        }
      },
    })
    .on('link[rel="canonical"]', {
      element(element) {
        canonical = element.getAttribute('href') ?? canonical;
      },
    })
    .on('h1, h2, h3', {
      element() {
        headings.push('');
      },
      text(chunk) {
        const last = headings.length - 1;
        if (last >= 0) headings[last] = `${headings[last] ?? ''}${chunk.text}`;
      },
    })
    .on('p, li, td, th', {
      text(chunk) {
        if (visible.join('').length < 2000) visible.push(chunk.text);
      },
    });
  await rewriter
    .transform(new Response(input.bytes, { headers: { 'content-type': 'text/html' } }))
    .text();
  pushObserved(items, 'page_title', 'html_title', 'title', titleChunks.join(''));
  pushObserved(
    items,
    'meta_description',
    'meta_description',
    'meta[name=description]',
    description,
  );
  pushObserved(items, 'canonical_url', 'canonical_link', 'link[rel=canonical]', canonical);
  for (const [index, heading] of headings.slice(0, 20).entries()) {
    pushObserved(items, 'heading', 'heading', `heading:${index}`, heading);
  }
  pushObserved(items, 'visible_excerpt', 'visible_text', 'body', visible.join(' '));
  for (const [index, block] of jsonld.entries()) {
    const quoted = quote(block);
    if (quoted.length === 0) continue;
    items.push({
      field_key: 'jsonld_text',
      value_text: clip(block.trim(), TEXT_LIMIT),
      status: 'observed',
      excerpt: quoted,
      locator: `script[type=application/ld+json]:${index}`,
      method: 'jsonld_text',
    });
  }
  if (items.length === 0) {
    items.push({
      field_key: 'unknown_gap',
      value_text: null,
      status: 'unknown',
      excerpt: 'No extractable text was found.',
      locator: 'document',
      method: input.kind === 'document' ? 'document_text' : 'visible_text',
    });
  }
  return items;
}
