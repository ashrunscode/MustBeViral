import { createRequire } from 'node:module';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { URL } from 'node:url';

import { PLATFORM_KNOWLEDGE_FIXTURE_WORKER } from './platform-knowledge-fixture-worker.mjs';

const requireFromRoot = createRequire(new URL('../../../package.json', import.meta.url));
const wranglerRequire = createRequire(requireFromRoot.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');

const STALL_PROBE_MS = 1500;
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createFixtureRuntime() {
  return new Miniflare({
    workers: [
      {
        name: 'fixture-probe',
        modules: true,
        compatibilityDate: '2026-07-12',
        script: `export default {
  async fetch(request, env) {
    const host = new URL(request.url).searchParams.get('host');
    if (!host) return new Response('missing host', { status: 400 });
    return env.FIXTURE.fetch(new Request('http://' + host + '/', { method: 'GET', redirect: 'manual' }));
  }
};`,
        serviceBindings: { FIXTURE: 'source-fixture-egress' },
      },
      {
        name: 'source-fixture-egress',
        modules: true,
        compatibilityDate: '2026-07-12',
        script: PLATFORM_KNOWLEDGE_FIXTURE_WORKER,
        serviceBindings: { PUBLIC_NETWORK: { network: { allow: [] } } },
      },
    ],
  });
}

async function dispatch(mf, host) {
  const started = Date.now();
  const response = await mf.dispatchFetch(`http://probe.local/?host=${encodeURIComponent(host)}`, {
    redirect: 'manual',
  });
  return { response, headerMs: Date.now() - started };
}

try {
  const mf = await createFixtureRuntime();
  try {
    const washbodega = await dispatch(mf, 'washbodega.mbv-source.test');
    const washbodegaHtml = await washbodega.response.text();
    assert(washbodega.response.status === 200, 'WashBodega fixture must return 200');
    assert(
      washbodegaHtml.includes('WashBodega Laundromat Hours'),
      'WashBodega fixture must include the page title',
    );
    results.push({
      host: 'washbodega.mbv-source.test',
      status: washbodega.response.status,
      headerMs: washbodega.headerMs,
      body: 'complete',
    });

    const unpile = await dispatch(mf, 'unpile.mbv-source.test');
    const unpileHtml = await unpile.response.text();
    assert(unpile.response.status === 200, 'UnPile fixture must return 200');
    assert(
      unpileHtml.includes('UnPile Wash And Fold Hours'),
      'UnPile fixture must include the page title',
    );
    results.push({
      host: 'unpile.mbv-source.test',
      status: unpile.response.status,
      headerMs: unpile.headerMs,
      body: 'complete',
    });

    const malformed = await dispatch(mf, 'malformed.mbv-source.test');
    const malformedBytes = new Uint8Array(await malformed.response.arrayBuffer());
    assert(malformed.response.status === 200, 'malformed fixture must return 200');
    assert(malformedBytes[0] === 0, 'malformed fixture must start with a NUL byte');
    results.push({
      host: 'malformed.mbv-source.test',
      status: malformed.response.status,
      headerMs: malformed.headerMs,
      body: 'nul',
    });

    const redirect = await dispatch(mf, 'redirect-private.mbv-source.test');
    assert(redirect.response.status === 302, 'private redirect fixture must return 302');
    assert(
      redirect.response.headers.get('location') === 'https://127.0.0.1/secret',
      'private redirect fixture must target a loopback URL',
    );
    results.push({
      host: 'redirect-private.mbv-source.test',
      status: redirect.response.status,
      headerMs: redirect.headerMs,
      location: redirect.response.headers.get('location'),
    });

    const oversized = await dispatch(mf, 'oversized.mbv-source.test');
    assert(oversized.response.status === 200, 'oversized fixture must return 200');
    const oversizedLimit = 2 * 1024 * 1024 + 8;
    const declared = oversized.response.headers.get('content-length');
    const oversizedBytes = await oversized.response.arrayBuffer();
    assert(
      declared === String(oversizedLimit) || oversizedBytes.byteLength === oversizedLimit,
      `oversized fixture must exceed 2MiB; length ${declared ?? 'none'} bytes ${String(oversizedBytes.byteLength)}`,
    );
    results.push({
      host: 'oversized.mbv-source.test',
      status: oversized.response.status,
      headerMs: oversized.headerMs,
      contentLength: declared,
      byteLength: oversizedBytes.byteLength,
    });

    const stall = await dispatch(mf, 'stall.mbv-source.test');
    assert(stall.response.status === 200, 'stall fixture must return headers with 200');
    assert(
      (stall.response.headers.get('content-type') ?? '').includes('text/html'),
      'stall fixture must advertise HTML',
    );
    const reader = stall.response.body?.getReader();
    assert(reader !== undefined, 'stall fixture must expose a readable body');
    const probeStarted = Date.now();
    const outcome = await Promise.race([
      reader.read().then((chunk) => ({ kind: 'read', chunk, ms: Date.now() - probeStarted })),
      delay(STALL_PROBE_MS).then(() => ({ kind: 'pending', ms: Date.now() - probeStarted })),
    ]);
    const cancelStarted = Date.now();
    await reader.cancel();
    const cancelMs = Date.now() - cancelStarted;
    assert(
      outcome.kind === 'pending',
      `stall body must stay pending for ${String(STALL_PROBE_MS)}ms; got ${outcome.kind} after ${String(outcome.ms)}ms`,
    );
    results.push({
      host: 'stall.mbv-source.test',
      status: stall.response.status,
      headerMs: stall.headerMs,
      body: 'pending',
      pendingMs: outcome.ms,
      cancelMs,
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          runtime: 'installed Miniflare / workerd',
          fixture: 'packages/db/scripts/platform-knowledge-fixture-worker.mjs',
          probeIntervalMs: STALL_PROBE_MS,
          results,
        },
        null,
        2,
      )}\n`,
    );
    process.stdout.write(
      `verify-platform-knowledge-fixtures: stall headers ${String(stall.headerMs)}ms, body pending ${String(outcome.ms)}ms, cancel ${String(cancelMs)}ms\n`,
    );
  } finally {
    await mf.dispose();
  }
} catch (error) {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`verify-platform-knowledge-fixtures failed: ${detail}\n`);
  process.exitCode = 1;
}
