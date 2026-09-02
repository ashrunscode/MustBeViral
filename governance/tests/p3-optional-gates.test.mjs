import assert from 'node:assert/strict';
import test from 'node:test';

import { listRepositoryFiles, readText } from '../scripts/lib.mjs';

const FORBIDDEN_APP_PATH =
  /(?:agency[-_]?portal|white[-_]?label|client[-_]?portal|auto[-_]?publish|social[-_]?publish|multi[-_]?client[-_]?(?:report|reporting))/i;

const ALLOWED_WORKER_NAMES = new Set([
  'mustbeviral-v2-development-core',
  'mustbeviral-v2-staging-core',
  'mustbeviral-v2-production-core',
  'mustbeviral-v2-development-collaboration',
  'mustbeviral-v2-staging-collaboration',
  'mustbeviral-v2-production-collaboration',
]);

function workerNames(source) {
  return [...source.matchAll(/"name"\s*:\s*"(mustbeviral-[^"]+)"/g)].map((match) => match[1]);
}

function stagingSlice(source) {
  const stagingStart = source.indexOf('"staging":');
  const productionStart = source.indexOf('"production":', stagingStart + 1);
  assert.ok(stagingStart >= 0, 'staging env must exist');
  assert.ok(productionStart > stagingStart, 'production env must follow staging');
  return source.slice(stagingStart, productionStart);
}

test('apps have no P4 agency or connected-social implementation files', () => {
  const hits = listRepositoryFiles(['apps/**/*']).filter((file) => FORBIDDEN_APP_PATH.test(file));
  assert.deepEqual(hits, [], 'P4 agency or social-publish files must not appear under apps/');
});

test('Workers remain Core and collaboration only; no executor or BYOK vars', () => {
  const wranglerFiles = listRepositoryFiles(['apps/**/wrangler.jsonc']);
  assert.deepEqual(wranglerFiles.sort(), [
    'apps/collaboration/wrangler.jsonc',
    'apps/core/wrangler.jsonc',
  ]);
  const names = wranglerFiles.flatMap((file) => workerNames(readText(file)));
  assert.ok(names.length > 0, 'wrangler files must declare Worker names');
  for (const name of names) {
    assert.ok(ALLOWED_WORKER_NAMES.has(name), `unexpected Worker name: ${name}`);
    assert.equal(/executor/i.test(name), false, `executor Worker is not authorized: ${name}`);
  }
  for (const file of wranglerFiles) {
    const source = readText(file);
    assert.equal(/\bBYOK\b/.test(source), false, `${file} must not declare BYOK`);
    assert.equal(
      /CUSTOMER_(?:API_KEY|SECRET|TOKEN|PROVIDER)/.test(source),
      false,
      `${file} must not declare customer-supplied provider credentials`,
    );
  }
});

test('staging Core Worker has no Hyperdrive user-path binding', () => {
  const source = readText('apps/core/wrangler.jsonc');
  assert.match(source, /mustbeviral-v2-staging-core/);
  assert.equal(
    /"hyperdrive"\s*:/.test(stagingSlice(source)),
    false,
    'env.staging must not declare a hyperdrive binding until G1-G6 pass',
  );
});
