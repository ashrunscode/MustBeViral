import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

const sourceRoot = process.cwd();
const validatorScript = path.join(sourceRoot, 'governance', 'scripts', 'validate-diff-scope.mjs');

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function write(root, relativePath, content) {
  const destination = path.join(root, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, content, 'utf8');
}

function packetText(allowedPaths) {
  return YAML.stringify(
    {
      id: 'WP-TEST-001',
      scope: {
        allowed_paths: allowedPaths,
        forbidden_paths: ['forbidden/**'],
      },
    },
    { lineWidth: 100 },
  );
}

function commit(root, message) {
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function fixture(t, allowedPaths = ['allowed/**']) {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-diff-scope-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'tests@mustbeviral.invalid']);
  git(root, ['config', 'user.name', 'MustBeViral Tests']);
  write(root, 'docs/delivery/ACTIVE_WORK_PACKET.yaml', packetText(allowedPaths));
  const base = commit(root, 'base packet');
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });
  return { root, base };
}

function validate(root, base, head) {
  const args = [validatorScript, '--base', base];
  if (head) args.push('--head', head);
  return spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MUSTBEVIRAL_TEST_REPO_ROOT: root,
    },
  });
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

test('committed out-of-scope file fails against the base packet', (t) => {
  const { root, base } = fixture(t);
  write(root, 'outside/implementation.txt', 'out of scope\n');
  const head = commit(root, 'out-of-scope implementation');

  const result = validate(root, base, head);

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /outside base packet WP-TEST-001: outside\/implementation\.txt/);
});

test('same-range scope amendment cannot authorize its own implementation', (t) => {
  const { root, base } = fixture(t);
  write(root, 'docs/delivery/ACTIVE_WORK_PACKET.yaml', packetText(['allowed/**', 'expanded/**']));
  write(root, 'expanded/implementation.txt', 'same range\n');
  const head = commit(root, 'broaden scope and implement');

  const result = validate(root, base, head);

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /outside base packet WP-TEST-001: expanded\/implementation\.txt/);
});

test('separate amendment range authorizes implementation in a later range', (t) => {
  const { root, base } = fixture(t);
  write(root, 'docs/delivery/ACTIVE_WORK_PACKET.yaml', packetText(['allowed/**', 'expanded/**']));
  const amendment = commit(root, 'broaden scope separately');

  const amendmentResult = validate(root, base, amendment);
  assert.equal(amendmentResult.status, 0, output(amendmentResult));

  write(root, 'expanded/implementation.txt', 'later range\n');
  const implementation = commit(root, 'implement in expanded scope');
  const implementationResult = validate(root, amendment, implementation);

  assert.equal(implementationResult.status, 0, output(implementationResult));
});

test('authority-transition write paths are exempt from base packet scope', (t) => {
  const { root, base } = fixture(t);
  write(root, 'PROJECT_STATE.yaml', 'active_work_packet: WP-TEST-002\n');
  write(root, 'docs/delivery/ACTIVE_WORK_PACKET.yaml', packetText(['successor-only/**']));
  write(
    root,
    'governance/evidence/WP-TEST-001/transition-receipt.yaml',
    'packet_id: WP-TEST-001\n',
  );
  write(root, 'governance/evidence/WP-TEST-001/completed-work-packet.yaml', 'id: WP-TEST-001\n');
  const head = commit(root, 'transition authority');

  const result = validate(root, base, head);

  assert.equal(result.status, 0, output(result));
});
