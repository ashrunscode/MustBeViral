import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

const sourceRoot = process.cwd();
const agentStateScript = path.join(sourceRoot, 'governance', 'scripts', 'agent-state.mjs');

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-agent-state-'));
  mkdirSync(path.join(root, 'docs', 'delivery'), { recursive: true });
  mkdirSync(path.join(root, 'governance'), { recursive: true });
  cpSync(path.join(sourceRoot, 'PROJECT_STATE.yaml'), path.join(root, 'PROJECT_STATE.yaml'));
  cpSync(
    path.join(sourceRoot, 'docs', 'delivery', 'ACTIVE_WORK_PACKET.yaml'),
    path.join(root, 'docs', 'delivery', 'ACTIVE_WORK_PACKET.yaml'),
  );
  cpSync(path.join(sourceRoot, 'docs', 'MANIFEST.yaml'), path.join(root, 'docs', 'MANIFEST.yaml'));
  cpSync(path.join(sourceRoot, 'governance', 'schemas'), path.join(root, 'governance', 'schemas'), {
    recursive: true,
  });
  writeFileSync(path.join(root, 'source.txt'), 'before verification\n', 'utf8');
  writeFileSync(
    path.join(root, 'mutate.mjs'),
    "import { writeFileSync } from 'node:fs';\nwriteFileSync('source.txt', 'after verification\\n', 'utf8');\n",
    'utf8',
  );
  git(root, ['init', '--quiet', '-b', 'codex/viralgraph-cleanroom']);
  git(root, ['config', 'user.email', 'tests@mustbeviral.invalid']);
  git(root, ['config', 'user.name', 'MustBeViral Tests']);
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'agent-state fixture']);
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

function runAgent(root, action) {
  return spawnSync(process.execPath, [agentStateScript, action], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MUSTBEVIRAL_TEST_REPO_ROOT: root,
    },
  });
}

function transitionMetadata(root) {
  return {
    lock: path.join(root, '.git', 'mustbeviral-agent-transition.lock'),
    journal: path.join(root, '.git', 'mustbeviral-agent-transition.json'),
    claim: path.join(root, '.git', 'mustbeviral-agent-recovery.lock'),
  };
}

function assertNoTransitionMetadata(root) {
  const metadata = transitionMetadata(root);
  assert.equal(existsSync(metadata.lock), false);
  assert.equal(existsSync(metadata.journal), false);
  assert.equal(existsSync(metadata.claim), false);
}

test('actual agent recovery clears a stale read-only lock and validates authority', (t) => {
  const root = fixture(t);
  const { lock } = transitionMetadata(root);
  mkdirSync(lock, { recursive: true });
  writeFileSync(
    path.join(lock, 'metadata.json'),
    JSON.stringify({
      schema_version: 1,
      nonce: 'stale-preflight-integration',
      pid: 2_147_483_647,
      hostname: process.env.COMPUTERNAME,
      created_at: new Date().toISOString(),
      context: { operation: 'preflight', read_only: true },
    }),
    'utf8',
  );

  const result = runAgent(root, 'recover');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Interrupted authority transition rolled back/);
  assertNoTransitionMetadata(root);
  assert.equal(git(root, ['status', '--porcelain']), '');
});

test('actual agent verification rejects source changes made by a gate', (t) => {
  const root = fixture(t);
  const packetPath = path.join(root, 'docs', 'delivery', 'ACTIVE_WORK_PACKET.yaml');
  const packet = YAML.parse(readFileSync(packetPath, 'utf8'));
  packet.quality_gates = [
    {
      id: 'mutation-fixture',
      command: 'node mutate.mjs',
      status: 'passed',
      evidence: ['governance/evidence/WP-R0-002/scaffold-verification.md'],
    },
  ];
  writeFileSync(packetPath, YAML.stringify(packet, { lineWidth: 100 }), 'utf8');
  git(root, ['add', '--', 'docs/delivery/ACTIVE_WORK_PACKET.yaml']);
  git(root, ['commit', '--quiet', '-m', 'install mutating verification gate']);

  const result = runAgent(root, 'verify');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /authority changed while packet verification was running/);
  assert.equal(readFileSync(path.join(root, 'source.txt'), 'utf8'), 'after verification\n');
  assertNoTransitionMetadata(root);
});
