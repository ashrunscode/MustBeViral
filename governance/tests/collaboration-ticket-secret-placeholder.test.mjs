import assert from 'node:assert/strict';
import test from 'node:test';

import { readText } from '../scripts/lib.mjs';

// The Workers refuse a collaboration ticket secret shorter than 32 characters. The example files
// are copied verbatim (CI copies apps/core/.dev.vars.example to .dev.vars), so their placeholder
// must fail that check: a copied example then fails closed instead of running on a public secret.
const MINIMUM_SECRET_LENGTH = 32;

for (const path of ['apps/core/.dev.vars.example', 'apps/collaboration/.dev.vars.example']) {
  test(`${path} declares an unusable COLLABORATION_TICKET_SECRET placeholder`, () => {
    const lines = readText(path)
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('COLLABORATION_TICKET_SECRET='));
    assert.equal(lines.length, 1, 'the name must be declared exactly once');
    const value = lines[0].slice('COLLABORATION_TICKET_SECRET='.length);
    assert.ok(value.length > 0, 'the placeholder must be non-empty so the name is typed');
    assert.ok(
      value.length < MINIMUM_SECRET_LENGTH,
      `placeholder is ${value.length} characters; it must stay below ${MINIMUM_SECRET_LENGTH}`,
    );
  });
}
