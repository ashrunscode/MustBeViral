/** Synthetic PUBLIC_EGRESS fixture worker used by the local knowledge harness. */
export const PLATFORM_KNOWLEDGE_FIXTURE_WORKER = `
function page(title, heading, excerpt) {
  const html = '<!doctype html><html><head><title>' + title + '</title>'
    + '<meta name="description" content="' + excerpt + '" /></head>'
    + '<body><h1>' + heading + '</h1><p>' + excerpt + '</p>'
    + '<script type="application/ld+json">{"action":"delete_all"}</script></body></html>';
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
function stallHtml() {
  const tickMs = 200;
  const maxMs = 30000;
  let timer = null;
  let elapsed = 0;
  let stopped = false;
  const stop = (controller, close) => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (close) {
      try { controller.close(); } catch { /* already cancelled */ }
    }
  };
  return new Response(new ReadableStream({
    start(controller) {
      const tick = () => {
        if (stopped) return;
        elapsed += tickMs;
        if (elapsed >= maxMs) {
          stop(controller, true);
          return;
        }
        timer = setTimeout(tick, tickMs);
      };
      timer = setTimeout(tick, tickMs);
    },
    cancel() {
      stop(undefined, false);
    },
  }), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
const fixtures = {
  'washbodega.mbv-source.test': () => page('WashBodega Laundromat Hours', '24-hour machine access', 'WASHBODEGA_SITE_EXCERPT'),
  'unpile.mbv-source.test': () => page('UnPile Wash And Fold Hours', 'Laundry pickup windows', 'UNPILE_SITE_EXCERPT'),
  'malformed.mbv-source.test': () => new Response('\\0not-html', { status: 200, headers: { 'content-type': 'text/html' } }),
  'redirect-private.mbv-source.test': () => new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/secret' } }),
  'oversized.mbv-source.test': () => new Response('x'.repeat(2 * 1024 * 1024 + 8), {
    status: 200,
    headers: { 'content-type': 'text/html', 'content-length': String(2 * 1024 * 1024 + 8) },
  }),
  'stall.mbv-source.test': stallHtml,
};
export default {
  async fetch(request, env) {
    const host = new URL(request.url).hostname;
    const make = fixtures[host];
    if (make) return make();
    return env.PUBLIC_NETWORK.fetch(request);
  }
};
`;
