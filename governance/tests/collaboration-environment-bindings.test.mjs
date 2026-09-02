import assert from 'node:assert/strict';
import test from 'node:test';

import { readText } from '../scripts/lib.mjs';

const CONFIG_PATH = 'apps/collaboration/wrangler.jsonc';
const REQUIRED_BINDING =
  /"name"\s*:\s*"CANVAS_COORDINATION"[\s\S]*?"class_name"\s*:\s*"CanvasCoordination"/u;

function namedEnvironment(source, name, nextName) {
  const start = source.indexOf(`"${name}":`);
  const end = nextName ? source.indexOf(`"${nextName}":`, start + 1) : source.length;
  assert.ok(start >= 0, `${name} environment must exist`);
  assert.ok(end > start, `${name} environment must be bounded`);
  return source.slice(start, end);
}

test('collaboration Worker declares its Durable Object binding in every environment', () => {
  const source = readText(CONFIG_PATH);
  const envStart = source.indexOf('"env":');
  assert.ok(envStart > 0, 'named environments must exist');

  const defaultEnvironment = source.slice(0, envStart);
  const stagingEnvironment = namedEnvironment(source, 'staging', 'production');
  const productionEnvironment = namedEnvironment(source, 'production');

  for (const [name, environment] of [
    ['default', defaultEnvironment],
    ['staging', stagingEnvironment],
    ['production', productionEnvironment],
  ]) {
    assert.match(environment, REQUIRED_BINDING, `${name} must bind CanvasCoordination`);
  }
});

test('collaboration Worker environment names and route containment stay exact', () => {
  const source = readText(CONFIG_PATH);
  const workerNames = [...source.matchAll(/"name"\s*:\s*"(mustbeviral-v2-[^"]+)"/gu)].map(
    (match) => match[1],
  );

  assert.deepEqual(workerNames, [
    'mustbeviral-v2-development-collaboration',
    'mustbeviral-v2-staging-collaboration',
    'mustbeviral-v2-production-collaboration',
  ]);
  assert.doesNotMatch(source, /"routes?"\s*:/u, 'collaboration Worker must not claim a route');
  assert.match(namedEnvironment(source, 'staging', 'production'), /"workers_dev"\s*:\s*true/u);
});
