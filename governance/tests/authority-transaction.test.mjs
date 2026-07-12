import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  applyAuthorityWrites,
  createAuthorityTransitionJournal,
  hasAuthorityTransitionJournal,
  recoverAuthorityTransition,
  runAuthorityTransaction,
} from '../scripts/authority-transaction.mjs';

const allowedPaths = new Set(['PROJECT_STATE.yaml', 'docs/delivery/ACTIVE_WORK_PACKET.yaml']);
const allowedPath = (relativePath) => allowedPaths.has(relativePath);

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-authority-'));
  const statePath = path.join(root, 'PROJECT_STATE.yaml');
  const packetPath = path.join(root, 'docs', 'delivery', 'ACTIVE_WORK_PACKET.yaml');
  mkdirSync(path.dirname(packetPath), { recursive: true });
  writeFileSync(statePath, 'state: original\n', 'utf8');
  writeFileSync(packetPath, 'packet: original\n', 'utf8');
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });
  return { root, statePath, packetPath };
}

const writes = () => [
  { path: 'PROJECT_STATE.yaml', content: 'state: next\n' },
  { path: 'docs/delivery/ACTIVE_WORK_PACKET.yaml', content: 'packet: next\n' },
];

test('commits every authority write and removes the journal on success', (t) => {
  const { root, statePath, packetPath } = fixture(t);
  let validations = 0;
  runAuthorityTransaction({
    root,
    writes: writes(),
    allowedPath,
    validate: () => {
      validations += 1;
    },
  });

  assert.equal(readFileSync(statePath, 'utf8'), 'state: next\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: next\n');
  assert.equal(validations, 1);
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('automatically restores every file when a later write fails', (t) => {
  const { root, statePath, packetPath } = fixture(t);
  assert.throws(
    () =>
      runAuthorityTransaction({
        root,
        writes: writes(),
        allowedPath,
        validate: () => {},
        onAfterWrite: ({ index }) => {
          if (index === 0) throw new Error('injected failure after first write');
        },
      }),
    /injected failure/,
  );

  assert.equal(readFileSync(statePath, 'utf8'), 'state: original\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('manual recovery rolls back an interrupted process from its durable journal', (t) => {
  const { root, statePath, packetPath } = fixture(t);
  const pendingWrites = writes();
  createAuthorityTransitionJournal({ root, writes: pendingWrites, allowedPath });
  applyAuthorityWrites({ root, writes: [pendingWrites[0]] });

  assert.equal(hasAuthorityTransitionJournal(root), true);
  assert.equal(readFileSync(statePath, 'utf8'), 'state: next\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');

  recoverAuthorityTransition({ root, allowedPath, validate: () => {} });
  assert.equal(readFileSync(statePath, 'utf8'), 'state: original\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('rejects a forbidden or escaping journal path before changing files', (t) => {
  const { root } = fixture(t);
  assert.throws(
    () =>
      createAuthorityTransitionJournal({
        root,
        writes: [{ path: '../outside.yaml', content: 'unsafe\n' }],
        allowedPath,
      }),
    /unsafe authority path/,
  );
  assert.equal(hasAuthorityTransitionJournal(root), false);
});
