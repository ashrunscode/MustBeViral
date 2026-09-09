import assert from 'node:assert/strict';
import test from 'node:test';

import { readText } from '../scripts/lib.mjs';

test('the accepted roadmap retains every full-platform work unit exactly once', () => {
  const roadmap = readText('docs/delivery/ROADMAP.md');
  const units = [...roadmap.matchAll(/^\|\s*(W\d+\.\d+)\s*\|/gm)].map((match) => match[1]);
  const expected = Array.from({ length: 13 }, (_, wave) =>
    Array.from({ length: 5 }, (_, unit) => `W${wave}.${unit + 1}`),
  ).flat();
  assert.deepEqual(units, expected);
});

test('platform acceptance preserves all golden journeys and pending production obligations', () => {
  const quality = readText('docs/delivery/QUALITY_GATES.md');
  for (const journey of [
    'WashBodega',
    'unrelated second brand',
    'studio and client',
    'creator',
    'partnership',
  ]) {
    assert.ok(quality.includes(journey), `missing acceptance journey: ${journey}`);
  }
  for (const area of [
    'Ingestion',
    'Knowledge',
    'Asset fidelity',
    'Tenancy',
    'Identity',
    'Approval',
    'Publishing',
    'Measurement',
    'Money',
    'Operations',
    'UX',
  ]) {
    assert.match(quality, new RegExp(`\\|\\s*${area}\\s*\\|`));
  }
  assert.match(quality, /WP-P3-009 observation-window and fresh-traffic-decision are pending/);
  assert.match(
    quality,
    /locally verified.*connected staging verified.*authorized production verified/,
  );
});
