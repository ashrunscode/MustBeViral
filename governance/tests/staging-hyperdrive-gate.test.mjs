import assert from 'node:assert/strict';
import test from 'node:test';

import { readText } from '../scripts/lib.mjs';

test('staging Core Worker has no Hyperdrive user-path binding', () => {
  const source = readText('apps/core/wrangler.jsonc');
  const stagingStart = source.indexOf('"staging":');
  const productionStart = source.indexOf('"production":', stagingStart + 1);
  assert.ok(stagingStart >= 0, 'staging env must exist');
  assert.ok(productionStart > stagingStart, 'production env must follow staging');
  assert.match(source, /mustbeviral-v2-staging-core/);
  assert.equal(
    /"hyperdrive"\s*:/.test(source.slice(stagingStart, productionStart)),
    false,
    'env.staging must not declare a hyperdrive binding until G1-G6 pass',
  );
});
