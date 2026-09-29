import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

import { readYaml, repoRoot, validateSchema } from '../scripts/lib.mjs';

const packetPath = 'docs/delivery/ACTIVE_WORK_PACKET.yaml';
const schemaPath = 'governance/schemas/work-packet.schema.json';
const validator = path.join(repoRoot, 'governance/scripts/validate-work-packet.mjs');

test('packet schema accepts literal main and existing codex branch forms', () => {
  for (const branch of [
    'main',
    'codex/viralgraph-cleanroom',
    'codex/w2.3_fix',
    'codex/123/nested',
  ]) {
    const packet = { ...readYaml(packetPath), branch };
    assert.deepEqual(validateSchema(schemaPath, packet, 'packet'), [], branch);
  }
});

test('packet schema rejects unrelated branches and near matches for main', () => {
  for (const branch of [
    '',
    'Main',
    'main/feature',
    'main-extra',
    'refs/heads/main',
    'feature/w2',
    'codex/',
    'codex/Uppercase',
  ]) {
    const packet = { ...readYaml(packetPath), branch };
    assert.ok(
      validateSchema(schemaPath, packet, 'packet').some((error) => error.includes('/branch')),
      branch,
    );
  }
});

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function fixture(t, branch) {
  const directory = mkdtempSync(path.join(tmpdir(), 'mbv-branch-'));
  const root = path.join(directory, 'primary');
  mkdirSync(path.join(root, 'docs/delivery'), { recursive: true });
  mkdirSync(path.join(root, 'governance'), { recursive: true });
  for (const relative of ['PROJECT_STATE.yaml', 'docs/MANIFEST.yaml', 'governance/schemas']) {
    cpSync(path.join(repoRoot, relative), path.join(root, relative), { recursive: true });
  }
  writeFileSync(path.join(root, packetPath), YAML.stringify({ ...readYaml(packetPath), branch }));
  git(root, ['init', '--quiet', '-b', branch]);
  git(root, ['config', 'user.name', 'MustBeViral Tests']);
  git(root, ['config', 'user.email', 'tests@mustbeviral.invalid']);
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'isolated branch validator fixture']);
  t.after(() => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(`${path.resolve(tmpdir())}${path.sep}mbv-branch-`));
    rmSync(resolved, { recursive: true, force: true });
  });
  return { root, linked: path.join(directory, 'linked') };
}

function validate(root) {
  return spawnSync(process.execPath, [validator], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', MUSTBEVIRAL_TEST_REPO_ROOT: root },
  });
}

for (const branch of ['main', 'codex/branch-guard']) {
  test(`actual validator accepts matching ${branch} in one checkout`, (t) => {
    const { root } = fixture(t, branch);
    const result = validate(root);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });

  test(`actual validator still rejects branch mismatch for packet ${branch}`, (t) => {
    const { root } = fixture(t, branch);
    git(root, ['switch', '--quiet', '-c', 'codex/wrong-packet']);
    const result = validate(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /branch codex\/wrong-packet does not match packet branch/);
  });

  test(`actual validator still rejects multiple linked worktrees for ${branch}`, (t) => {
    const { root, linked } = fixture(t, branch);
    git(root, ['worktree', 'add', '--quiet', '-b', 'codex/second-checkout', linked]);
    const result = validate(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /multiple linked worktrees are not allowed/);
  });
}
