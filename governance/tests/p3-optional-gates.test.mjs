import assert from 'node:assert/strict';
import test from 'node:test';

import { listRepositoryFiles, readText, readYaml } from '../scripts/lib.mjs';

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

test('platform implementation follows accepted scope without reviving superseded exclusions', () => {
  const manifest = readYaml('docs/MANIFEST.yaml');
  const lifecycle = (id) => manifest.documents.find((document) => document.id === id)?.status;
  assert.equal(lifecycle('adr-0007-full-platform'), 'accepted');
  assert.equal(lifecycle('adr-0001-dtc-first'), 'superseded');
  assert.equal(lifecycle('codex-finish-mega-prompt'), 'superseded');
  const instructions = `${readText('AGENTS.md')}\n${readText('.agents/skills/build-mustbeviral/SKILL.md')}`;
  assert.doesNotMatch(
    instructions,
    /Agency workflows are deferred|Build only the DTC\/e-commerce-first/i,
  );
  const product = readText('docs/product/PRODUCT_CONTRACT.md');
  assert.doesNotMatch(
    product,
    /Agency-specific operation is deliberately excluded|product does not crawl or import/i,
  );
  assert.match(product, /studio can access multiple client workspaces through explicit grants/i);
  assert.match(readText('docs/architecture/DATA_AUTH_AND_TENANCY.md'), /Enable and force RLS/);
  assert.match(
    readText('docs/product/RELEASE_SCOPE.md'),
    /observation.*traffic ruling remain unproved/i,
  );
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
