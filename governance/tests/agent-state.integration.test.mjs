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
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

import { collectTransitionReceiptErrors } from '../scripts/validate-transition-receipts.mjs';

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
  const statePath = path.join(root, 'PROJECT_STATE.yaml');
  const packetPath = path.join(root, 'docs', 'delivery', 'ACTIVE_WORK_PACKET.yaml');
  const state = YAML.parse(readFileSync(statePath, 'utf8'));
  const packet = YAML.parse(readFileSync(packetPath, 'utf8'));
  // Keep the isolated fixture at receipt-chain genesis as repository authority advances.
  state.active_work_packet = 'WP-R0-002';
  packet.id = 'WP-R0-002';
  packet.depends_on = [];
  writeFileSync(statePath, YAML.stringify(state, { lineWidth: 100 }), 'utf8');
  writeFileSync(packetPath, YAML.stringify(packet, { lineWidth: 100 }), 'utf8');
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

function runAgent(root, action, ...args) {
  return spawnSync(process.execPath, [agentStateScript, action, ...args], {
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
      hostname: hostname(),
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

function supersessionFixture(t) {
  const root = fixture(t);
  const packetPath = 'docs/delivery/ACTIVE_WORK_PACKET.yaml';
  const prefix = 'governance/evidence/WP-R0-002/';
  const decisionPath = `${prefix}decision.yaml`;
  const successorPath = `${prefix}successor.yaml`;
  const proofPath = `${prefix}observation.md`;
  const write = (p, value) => writeFileSync(path.join(root, p), YAML.stringify(value));
  mkdirSync(path.join(root, prefix), { recursive: true });
  const packet = YAML.parse(readFileSync(path.join(root, packetPath), 'utf8'));
  packet.scope.allowed_paths = ['governance/**', 'docs/delivery/**', 'PROJECT_STATE.yaml'];
  packet.steps = [{ id: 'observe', title: 'Observe before release', status: 'current' }];
  packet.handoff.current_step = 'observe';
  packet.handoff.changed_paths = [];
  packet.handoff.last_green_checks = [];
  packet.acceptance = {
    automated: [
      {
        id: 'observation',
        criterion: 'Observation passes',
        status: 'pending',
        evidence: [proofPath],
      },
    ],
    manual: [
      { id: 'traffic', criterion: 'Owner approves traffic', status: 'pending', evidence: [] },
    ],
  };
  packet.quality_gates = [
    { id: 'governance', command: 'pnpm governance:check', status: 'pending', evidence: [] },
  ];
  packet.completion = { successor_packet_id: null, evidence_paths: [], completed_at: null };
  write(packetPath, packet);
  writeFileSync(path.join(root, proofPath), 'Observation is unproved.\n');
  const successor = JSON.parse(JSON.stringify(packet));
  successor.id = 'WP-FULL-001';
  successor.spec_revision = 1;
  successor.status = 'ready';
  successor.depends_on = [packet.id];
  successor.steps[0].status = 'pending';
  successor.acceptance.automated[0].evidence = [];
  successor.external_effects = { remote_mutation: 'none', destructive_remote_actions: false };
  write(successorPath, successor);
  const decision = {
    schema_version: 1,
    action: 'supersede',
    authorized_by: 'repository-owner',
    authorization_source: 'explicit_user_instruction',
    authorized_at: '2026-09-01T00:00:00Z',
    authorization_statement: 'Implement the new platform now.',
    selection_statement: 'Rebaseline now.',
    predecessor_packet_id: packet.id,
    predecessor_spec_revision: packet.spec_revision,
    successor_packet_id: successor.id,
    successor_spec_revision: successor.spec_revision,
    branch: packet.branch,
    source_plan_sha256: 'b'.repeat(64),
    reason: 'Owner changed product direction.',
    carried_release_obligations: [
      'Observation remains unproved.',
      'Traffic approval remains pending.',
    ],
    external_effects: 'none',
  };
  write(decisionPath, decision);
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'authorize fixture supersession']);
  const run = () =>
    runAgent(root, 'supersede', '--successor', successorPath, '--decision', decisionPath);
  return {
    root,
    packet,
    successor,
    decision,
    decisionPath,
    successorPath,
    proofPath,
    packetPath,
    prefix,
    write,
    run,
  };
}

test('actual supersession preserves incomplete acceptance and validates the version 2 receipt', (t) => {
  const f = supersessionFixture(t);
  const original = readFileSync(path.join(f.root, f.packetPath), 'utf8');
  const finish = runAgent(f.root, 'finish', '--successor', f.successorPath);
  assert.notEqual(finish.status, 0);
  assert.match(finish.stderr, /automated acceptance is incomplete/);
  const result = f.run();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const receiptPath = `${f.prefix}transition-receipt.yaml`;
  assert.equal(
    readFileSync(path.join(f.root, `${f.prefix}superseded-work-packet.yaml`), 'utf8'),
    original,
  );
  const receipt = YAML.parse(readFileSync(path.join(f.root, receiptPath), 'utf8'));
  assert.equal(receipt.status, 'superseded');
  assert.deepEqual(receipt.unfinished_step_ids, ['observe']);
  assert.deepEqual(receipt.unproved_acceptance_ids, ['observation', 'traffic']);
  assert.equal(receipt.completed_at, undefined);
  assert.equal(
    YAML.parse(readFileSync(path.join(f.root, f.packetPath), 'utf8')).id,
    f.successor.id,
  );
  assert.deepEqual(collectTransitionReceiptErrors({ root: f.root, receiptPath }), []);
  assertNoTransitionMetadata(f.root);
  git(f.root, ['add', '.']);
  git(f.root, ['commit', '--quiet', '-m', 'retain supersession receipt']);
  const duplicate = f.run();
  assert.notEqual(duplicate.status, 0);
  assert.deepEqual(collectTransitionReceiptErrors({ root: f.root, receiptPath }), []);
});

test('supersession rejects missing or uncommitted owner authorization without changing authority', (t) => {
  const f = supersessionFixture(t);
  const original = readFileSync(path.join(f.root, f.packetPath), 'utf8');
  f.write(f.decisionPath, { ...f.decision, reason: 'Uncommitted change' });
  const dirty = f.run();
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stderr, /clean committed predecessor/);
  const missing = runAgent(f.root, 'supersede', '--successor', f.successorPath);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /requires.*decision/);
  assert.equal(readFileSync(path.join(f.root, f.packetPath), 'utf8'), original);
  assertNoTransitionMetadata(f.root);
});

test('supersession rejects a decision for another revision or branch and rejects external authority expansion', (t) => {
  const f = supersessionFixture(t);
  f.write(f.decisionPath, { ...f.decision, predecessor_spec_revision: 999, branch: 'codex/other' });
  f.successor.external_effects.remote_mutation = 'authorized';
  f.write(f.successorPath, f.successor);
  git(f.root, ['add', '.']);
  git(f.root, ['commit', '--quiet', '-m', 'invalid decision fixture']);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /predecessor revision/);
  assert.match(result.stderr, /current branch/);
  assert.match(result.stderr, /external mutations/);
  assertNoTransitionMetadata(f.root);
});

test('supersession rejects non-owner approval and invalid successor readiness', (t) => {
  const f = supersessionFixture(t);
  f.write(f.decisionPath, { ...f.decision, authorization_source: 'assistant_inference' });
  git(f.root, ['add', '.']);
  git(f.root, ['commit', '--quiet', '-m', 'invalid approval fixture']);
  assert.notEqual(f.run().status, 0);
  f.write(f.decisionPath, f.decision);
  f.successor.steps[0].status = 'completed';
  f.successor.acceptance.automated[0].status = 'passed';
  f.write(f.successorPath, f.successor);
  git(f.root, ['add', '.']);
  git(f.root, ['commit', '--quiet', '-m', 'invalid successor fixture']);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pending steps|pending acceptance/);
  assertNoTransitionMetadata(f.root);
});

test('superseded evidence, snapshot and unfinished-work claims cannot be tampered with', (t) => {
  const f = supersessionFixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const receiptPath = `${f.prefix}transition-receipt.yaml`;
  const snapshotPath = `${f.prefix}superseded-work-packet.yaml`;
  const receipt = YAML.parse(readFileSync(path.join(f.root, receiptPath), 'utf8'));
  f.write(receiptPath, { ...receipt, unfinished_step_ids: [], unproved_acceptance_ids: [] });
  assert.match(
    collectTransitionReceiptErrors({ root: f.root, receiptPath }).join('\n'),
    /unfinished work/,
  );
  f.write(receiptPath, receipt);
  f.write(snapshotPath, { ...f.packet, title: 'Tampered snapshot' });
  assert.match(
    collectTransitionReceiptErrors({ root: f.root, receiptPath }).join('\n'),
    /differs from committed predecessor/,
  );
  f.write(snapshotPath, f.packet);
  writeFileSync(path.join(f.root, f.proofPath), 'Observation is now claimed passed.\n');
  assert.match(
    collectTransitionReceiptErrors({ root: f.root, receiptPath }).join('\n'),
    /superseded evidence is absent or changed/,
  );
});
