import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import process from 'node:process';
import { URL } from 'node:url';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');

let hits = 0;
const server = createServer((_request, response) => {
  hits += 1;
  response.end('synthetic-private-target');
});
await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', resolve);
});
const port = server.address().port;
const mf = new Miniflare({
  modules: true,
  compatibilityDate: '2026-07-12',
  compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
  script: `export default { async fetch(request, env) {
    const target = new URL(request.url).searchParams.get('target');
    try {
      const response = await env.PUBLIC_EGRESS.fetch(target, { redirect: 'manual' });
      return Response.json({ status: response.status, text: await response.text() });
    } catch {
      return Response.json({ blocked: true });
    }
  } };`,
  serviceBindings: {
    PUBLIC_EGRESS: {
      network: { allow: ['public'], tlsOptions: { trustBrowserCas: true } },
    },
  },
});

const results = [];
try {
  for (const host of ['127.0.0.1', 'localhost', '[::ffff:127.0.0.1]']) {
    const target = `http://${host}:${port}/fixture`;
    const response = await mf.dispatchFetch(
      `http://probe.local/?target=${encodeURIComponent(target)}`,
    );
    const body = await response.json();
    results.push({ host, ...body });
  }
  const report = {
    runtime: 'installed Miniflare / workerd',
    networkAllow: ['public'],
    syntheticLabel: 'private loopback probe, not a live website verification',
    privateTargetHits: hits,
    results,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (hits !== 0 || results.some((row) => !row.blocked && row.status < 400)) process.exitCode = 1;
} finally {
  await mf.dispose();
  await new Promise((resolve) => {
    server.close(resolve);
  });
}
