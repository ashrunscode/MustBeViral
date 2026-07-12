import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  gitChangedPaths,
  gitWorktreeFingerprint,
  inspectHeadEvidence,
} from '../scripts/git-evidence.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function repository(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-evidence-'));
  const evidenceDirectory = path.join(root, 'governance', 'evidence', 'WP-R0-001');
  mkdirSync(evidenceDirectory, { recursive: true });
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'tests@mustbeviral.invalid']);
  git(root, ['config', 'user.name', 'MustBeViral Tests']);
  const evidencePath = 'governance/evidence/WP-R0-001/proof.md';
  writeFileSync(path.join(root, evidencePath), 'committed proof\n', 'utf8');
  git(root, ['add', '--', evidencePath]);
  git(root, ['commit', '--quiet', '-m', 'test evidence']);
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });
  return { root, evidencePath };
}

test('binds evidence to the exact committed HEAD blob', (t) => {
  const { root, evidencePath } = repository(t);
  const inspection = inspectHeadEvidence({ root, relativePath: evidencePath });
  assert.equal(inspection.exists, true);
  assert.equal(inspection.headContained, true);
  assert.equal(inspection.contentMatchesHead, true);
  assert.match(inspection.sha256, /^[a-f0-9]{64}$/);
  assert.match(inspection.gitBlobOid, /^[a-f0-9]{40}$/);
});

test('detects modified tracked and staged-new evidence before finish', (t) => {
  const { root, evidencePath } = repository(t);
  writeFileSync(path.join(root, evidencePath), 'modified proof\n', 'utf8');
  const modified = inspectHeadEvidence({ root, relativePath: evidencePath });
  assert.equal(modified.headContained, true);
  assert.equal(modified.contentMatchesHead, false);

  const stagedPath = 'governance/evidence/WP-R0-001/staged.md';
  writeFileSync(path.join(root, stagedPath), 'staged only\n', 'utf8');
  git(root, ['add', '--', stagedPath]);
  const staged = inspectHeadEvidence({ root, relativePath: stagedPath });
  assert.equal(staged.exists, true);
  assert.equal(staged.headContained, false);
  assert.deepEqual(gitChangedPaths(root), [evidencePath, stagedPath]);
});

test('reports an unrelated dirty path so finish cannot launder it', (t) => {
  const { root } = repository(t);
  writeFileSync(path.join(root, 'outside-scope.txt'), 'not authorized\n', 'utf8');
  assert.deepEqual(gitChangedPaths(root), ['outside-scope.txt']);
});

test('fingerprints content changes even when the dirty path set is unchanged', (t) => {
  const { root, evidencePath } = repository(t);
  writeFileSync(path.join(root, evidencePath), 'first dirty value\n', 'utf8');
  const first = gitWorktreeFingerprint(root);
  writeFileSync(path.join(root, evidencePath), 'second dirty value\n', 'utf8');
  const second = gitWorktreeFingerprint(root);
  assert.notEqual(second, first);
  assert.deepEqual(gitChangedPaths(root), [evidencePath]);

  writeFileSync(path.join(root, 'untracked.txt'), 'first untracked value\n', 'utf8');
  const third = gitWorktreeFingerprint(root);
  writeFileSync(path.join(root, 'untracked.txt'), 'second untracked value\n', 'utf8');
  assert.notEqual(gitWorktreeFingerprint(root), third);
});

test('can exclude transaction targets while still detecting unrelated changes', (t) => {
  const { root, evidencePath } = repository(t);
  const baseline = gitWorktreeFingerprint(root, { excludePaths: [evidencePath] });
  writeFileSync(path.join(root, evidencePath), 'transaction-owned change\n', 'utf8');
  assert.equal(gitWorktreeFingerprint(root, { excludePaths: [evidencePath] }), baseline);
  writeFileSync(path.join(root, 'unrelated.txt'), 'parallel change\n', 'utf8');
  assert.notEqual(gitWorktreeFingerprint(root, { excludePaths: [evidencePath] }), baseline);
});
