import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';

import { readText } from '../scripts/lib.mjs';

function productionSlice(source) {
  const start = source.indexOf('"production":');
  assert.ok(start >= 0, 'production environment must exist');
  return source.slice(start);
}

function unsafeProductionSignals(source) {
  const production = productionSlice(source);
  const signals = [];
  if (/0{24,}/u.test(production)) signals.push('placeholder-id');
  if (/"routes?"\s*:/u.test(production) || /"custom_domain"\s*:\s*true/u.test(production)) {
    signals.push('ungoverned-route');
  }
  if (/"hyperdrive"\s*:/u.test(production)) signals.push('ungated-hyperdrive');
  if (
    /mustbeviral-(?:production|staging)-(?:media|cache)|must-be-viral-(?:db|media)/u.test(
      production,
    )
  ) {
    signals.push('legacy-resource');
  }
  return signals;
}

function missingRequiredProductionBindings(source, worker) {
  const production = productionSlice(source);
  if (
    worker === 'core' &&
    !/"bucket_name"\s*:\s*"mustbeviral-v2-production-media"/u.test(production)
  ) {
    return ['missing-media-bucket'];
  }
  if (
    worker === 'collaboration' &&
    !/"name"\s*:\s*"CANVAS_COORDINATION"[\s\S]*?"class_name"\s*:\s*"CanvasCoordination"/u.test(
      production,
    )
  ) {
    return ['missing-canvas-coordination'];
  }
  return [];
}

function missingDisabledProductionFlags(source) {
  const production = productionSlice(source);
  return ['PROVIDER_RUNS_ENABLED', 'QUEUES_ENABLED'].filter(
    (name) => !new RegExp(`"${name}"\\s*:\\s*"false"`, 'u').test(production),
  );
}

test('unsafe production config signals are detected', () => {
  const fixture = `
    "production": {
      "routes": [{ "pattern": "api.mustbeviral.com", "custom_domain": true }],
      "hyperdrive": [{ "id": "00000000000000000000000000000002" }],
      "bucket_name": "mustbeviral-production-media"
    }
  `;
  assert.deepEqual(unsafeProductionSignals(fixture), [
    'placeholder-id',
    'ungoverned-route',
    'ungated-hyperdrive',
    'legacy-resource',
  ]);
  assert.deepEqual(missingRequiredProductionBindings(fixture, 'core'), ['missing-media-bucket']);
  assert.deepEqual(missingRequiredProductionBindings(fixture, 'collaboration'), [
    'missing-canvas-coordination',
  ]);
  assert.deepEqual(missingDisabledProductionFlags(fixture), [
    'PROVIDER_RUNS_ENABLED',
    'QUEUES_ENABLED',
  ]);
});

test('current V2 production Worker configs stay unrouted and placeholder-free', () => {
  const core = readText('apps/core/wrangler.jsonc');
  const collaboration = readText('apps/collaboration/wrangler.jsonc');

  assert.match(productionSlice(core), /mustbeviral-v2-production-core/u);
  assert.match(productionSlice(core), /mustbeviral-v2-production-media/u);
  assert.match(productionSlice(collaboration), /mustbeviral-v2-production-collaboration/u);
  assert.deepEqual(unsafeProductionSignals(core), []);
  assert.deepEqual(unsafeProductionSignals(collaboration), []);
  assert.deepEqual(missingRequiredProductionBindings(core, 'core'), []);
  assert.deepEqual(missingRequiredProductionBindings(collaboration, 'collaboration'), []);
  assert.deepEqual(missingDisabledProductionFlags(core), []);
  assert.match(
    productionSlice(core),
    /"SUPABASE_URL"\s*:\s*"https:\/\/jjgtlfblsfobdhmtngbz\.supabase\.co"/u,
  );
  assert.match(productionSlice(core), /"workers_dev"\s*:\s*true/u);
  assert.match(productionSlice(core), /"preview_urls"\s*:\s*false/u);
});

test('production MCP admits both canonical site origins and retains the existing origin', () => {
  const production = productionSlice(readText('apps/core/wrangler.jsonc'));
  const configured = /"CORS_ALLOWED_ORIGINS"\s*:\s*"([^"]+)"/u.exec(production)?.[1];
  assert.ok(configured, 'production must declare an explicit origin allow-list');
  const origins = configured.split(',').map((origin) => origin.trim());

  for (const required of [
    'https://mustbeviral.com',
    'https://www.mustbeviral.com',
    'https://mustbeviral-web-production-ashrunscode-projects.vercel.app',
  ]) {
    assert.ok(origins.includes(required), `production must allow ${required}`);
  }
  assert.equal(origins.length, 3, 'A6 adds only the two canonical origins');
  assert.equal(new Set(origins).size, 3, 'approved origins must be unique');
  for (const origin of origins) {
    const url = new URL(origin);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.origin, origin, 'allow-list entries must be exact origins, without paths');
  }
});
