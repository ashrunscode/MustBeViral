import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  TRANSITION_LOCK,
  TRANSITION_RECOVERY_CLAIM,
  applyAuthorityWrites,
  createAuthorityTransitionJournal,
  hasAuthorityTransitionJournal,
  recoverAuthorityTransition,
  runAuthorityRead,
  runAuthorityTransaction,
} from '../scripts/authority-transaction.mjs';

const allowedPaths = new Set([
  'PROJECT_STATE.yaml',
  'docs/delivery/ACTIVE_WORK_PACKET.yaml',
  'governance/evidence/history.yaml',
]);
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
  {
    path: 'PROJECT_STATE.yaml',
    content: 'state: next\n',
    expected: { existed: true, content: 'state: original\n' },
  },
  {
    path: 'docs/delivery/ACTIVE_WORK_PACKET.yaml',
    content: 'packet: next\n',
    expected: { existed: true, content: 'packet: original\n' },
  },
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

test('read locks are released after both successful and failed reads', (t) => {
  const { root } = fixture(t);
  assert.equal(runAuthorityRead({ root, read: () => 'snapshot' }), 'snapshot');
  assert.equal(hasAuthorityTransitionJournal(root), false);
  assert.throws(
    () =>
      runAuthorityRead({
        root,
        read: () => {
          throw new Error('injected read failure');
        },
      }),
    /injected read failure/,
  );
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
  const journal = createAuthorityTransitionJournal({ root, writes: pendingWrites, allowedPath });
  applyAuthorityWrites({ root, writes: [pendingWrites[0]] });
  const abandonedStateTemp = `${statePath}.tmp-${journal.lock_nonce}`;
  const abandonedJournalTemp = `${path.join(root, '.git', 'mustbeviral-agent-transition.json')}.tmp-${journal.lock_nonce}`;
  writeFileSync(abandonedStateTemp, 'partial state write', 'utf8');
  writeFileSync(abandonedJournalTemp, 'partial journal write', 'utf8');

  assert.equal(hasAuthorityTransitionJournal(root), true);
  assert.equal(readFileSync(statePath, 'utf8'), 'state: next\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');

  assert.throws(
    () => runAuthorityRead({ root, read: () => assert.fail('read must remain blocked') }),
    /interrupted or concurrent authority transition/,
  );

  recoverAuthorityTransition({ root, allowedPath, validate: () => {} });
  assert.equal(readFileSync(statePath, 'utf8'), 'state: original\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');
  assert.equal(hasAuthorityTransitionJournal(root), false);
  assert.equal(existsSync(abandonedStateTemp), false);
  assert.equal(existsSync(abandonedJournalTemp), false);
});

test('recovery refuses to erase an unknown third-party authority edit', (t) => {
  const { root, statePath, packetPath } = fixture(t);
  const pendingWrites = writes();
  createAuthorityTransitionJournal({ root, writes: pendingWrites, allowedPath });
  applyAuthorityWrites({ root, writes: [pendingWrites[0]] });
  writeFileSync(statePath, 'state: outside editor\n', 'utf8');

  assert.throws(
    () => recoverAuthorityTransition({ root, allowedPath, validate: () => {} }),
    /unknown third-party state/,
  );
  assert.equal(readFileSync(statePath, 'utf8'), 'state: outside editor\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');
  assert.equal(hasAuthorityTransitionJournal(root), true);
});

test('a validator cannot rewrite intended authority and report success', (t) => {
  const { root, statePath, packetPath } = fixture(t);
  assert.throws(
    () =>
      runAuthorityTransaction({
        root,
        writes: writes(),
        allowedPath,
        validate: () => writeFileSync(statePath, 'state: validator mutation\n', 'utf8'),
      }),
    /automatic recovery failed.*unknown third-party state/s,
  );
  assert.equal(readFileSync(statePath, 'utf8'), 'state: validator mutation\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: next\n');
  assert.equal(hasAuthorityTransitionJournal(root), true);
});

test('recovery without an interrupted transition fails without creating a lock', (t) => {
  const { root } = fixture(t);
  assert.throws(
    () => recoverAuthorityTransition({ root, allowedPath, validate: () => {} }),
    /no interrupted authority transition exists/,
  );
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('a live recovery claim excludes a second recovery process', (t) => {
  const { root } = fixture(t);
  const claimPath = path.join(root, TRANSITION_RECOVERY_CLAIM);
  mkdirSync(claimPath, { recursive: true });
  writeFileSync(
    path.join(claimPath, 'metadata.json'),
    JSON.stringify({
      schema_version: 1,
      nonce: 'live-recovery-fixture',
      pid: process.pid,
      hostname: hostname(),
      created_at: new Date().toISOString(),
    }),
    'utf8',
  );
  assert.throws(
    () => recoverAuthorityTransition({ root, allowedPath, validate: () => {} }),
    /recovery process .* is still running/,
  );
  assert.equal(existsSync(claimPath), true);
});

test('exactly one process claims and completes stale recovery', async (t) => {
  const { root, statePath, packetPath } = fixture(t);
  const pendingWrites = writes();
  createAuthorityTransitionJournal({ root, writes: pendingWrites, allowedPath });
  applyAuthorityWrites({ root, writes: [pendingWrites[0]] });
  const lockMetadataPath = path.join(root, TRANSITION_LOCK, 'metadata.json');
  const lock = JSON.parse(readFileSync(lockMetadataPath, 'utf8'));
  writeFileSync(lockMetadataPath, JSON.stringify({ ...lock, pid: 2_147_483_647 }), 'utf8');

  const moduleUrl = pathToFileURL(
    path.join(process.cwd(), 'governance', 'scripts', 'authority-transaction.mjs'),
  ).href;
  const program = `
    import { recoverAuthorityTransition } from ${JSON.stringify(moduleUrl)};
    try {
      recoverAuthorityTransition({
        root: ${JSON.stringify(root)},
        allowedPath: (value) => ${JSON.stringify([...allowedPaths])}.includes(value),
        validate: () => {},
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  `;
  const runRecovery = () =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, ['--input-type=module', '--eval', program], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('close', (status) => resolve({ status, stderr }));
    });
  const results = await Promise.all([runRecovery(), runRecovery()]);
  assert.equal(results.filter((result) => result.status === 0).length, 1, JSON.stringify(results));
  assert.equal(readFileSync(statePath, 'utf8'), 'state: original\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('recovers a read-only preflight crash that left only the lock', (t) => {
  const { root } = fixture(t);
  const lockPath = path.join(root, TRANSITION_LOCK);
  mkdirSync(lockPath, { recursive: true });
  writeFileSync(
    path.join(lockPath, 'metadata.json'),
    JSON.stringify({
      schema_version: 1,
      nonce: 'preflight-fixture',
      pid: 2_147_483_647,
      hostname: hostname(),
      created_at: new Date().toISOString(),
      context: { operation: 'preflight' },
    }),
    'utf8',
  );
  let validated = false;
  recoverAuthorityTransition({
    root,
    allowedPath,
    assertRecoveryContext: (context) => assert.equal(context.operation, 'preflight'),
    validate: () => {
      validated = true;
    },
  });
  assert.equal(validated, true);
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('rejects a forbidden or escaping journal path before changing files', (t) => {
  const { root } = fixture(t);
  assert.throws(
    () =>
      createAuthorityTransitionJournal({
        root,
        writes: [
          {
            path: '../outside.yaml',
            content: 'unsafe\n',
            expected: { existed: false, content: null },
          },
        ],
        allowedPath,
      }),
    /unsafe authority path/,
  );
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('rejects a stale writer after another transition commits', (t) => {
  const { root, statePath, packetPath } = fixture(t);
  const staleWrites = writes();

  runAuthorityTransaction({ root, writes: writes(), allowedPath, validate: () => {} });

  assert.throws(
    () =>
      runAuthorityTransaction({
        root,
        writes: staleWrites.map((write) => ({
          ...write,
          content: write.content.replace('next', 'stale overwrite'),
        })),
        allowedPath,
        validate: () => {},
      }),
    /authority source changed after it was loaded/,
  );

  assert.equal(readFileSync(statePath, 'utf8'), 'state: next\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: next\n');
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('a stale transition cannot overwrite an expected-absent history artifact', (t) => {
  const { root } = fixture(t);
  const historyPath = 'governance/evidence/history.yaml';
  const winnerWrites = [
    {
      path: historyPath,
      content: 'winner: true\n',
      expected: { existed: false, content: null },
    },
    ...writes(),
  ];
  const staleWrites = winnerWrites.map((write) => ({
    ...write,
    content: write.content.replace('winner: true', 'stale: true'),
  }));
  runAuthorityTransaction({ root, writes: winnerWrites, allowedPath, validate: () => {} });

  assert.throws(
    () => runAuthorityTransaction({ root, writes: staleWrites, allowedPath, validate: () => {} }),
    /authority source changed after it was loaded/,
  );
  assert.equal(readFileSync(path.join(root, historyPath), 'utf8'), 'winner: true\n');
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('checks caller context while holding the transition lock', (t) => {
  const { root, statePath, packetPath } = fixture(t);
  assert.throws(
    () =>
      runAuthorityTransaction({
        root,
        writes: writes(),
        allowedPath,
        assertExpectedContext: () => {
          throw new Error('Git HEAD changed after authority was loaded');
        },
      }),
    /Git HEAD changed/,
  );
  assert.equal(readFileSync(statePath, 'utf8'), 'state: original\n');
  assert.equal(readFileSync(packetPath, 'utf8'), 'packet: original\n');
  assert.equal(hasAuthorityTransitionJournal(root), false);
});

test('resolves transition metadata through Git for a linked worktree', (t) => {
  const mainRoot = mkdtempSync(path.join(tmpdir(), 'mustbeviral-main-'));
  const worktreeRoot = `${mainRoot}-worktree`;
  const git = (cwd, args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  git(mainRoot, ['init', '--quiet']);
  git(mainRoot, ['config', 'user.email', 'tests@mustbeviral.invalid']);
  git(mainRoot, ['config', 'user.name', 'MustBeViral Tests']);
  mkdirSync(path.join(mainRoot, 'docs', 'delivery'), { recursive: true });
  writeFileSync(path.join(mainRoot, 'PROJECT_STATE.yaml'), 'state: original\n', 'utf8');
  writeFileSync(
    path.join(mainRoot, 'docs', 'delivery', 'ACTIVE_WORK_PACKET.yaml'),
    'packet: original\n',
    'utf8',
  );
  git(mainRoot, ['add', '.']);
  git(mainRoot, ['commit', '--quiet', '-m', 'fixture']);
  git(mainRoot, ['worktree', 'add', '--quiet', '--detach', worktreeRoot]);
  t.after(() => {
    try {
      git(mainRoot, ['worktree', 'remove', '--force', worktreeRoot]);
    } catch {
      rmSync(worktreeRoot, { recursive: true, force: true });
    }
    rmSync(mainRoot, { recursive: true, force: true });
  });

  const linkedWrites = writes().map((write) => ({
    ...write,
    expected: {
      existed: true,
      content: readFileSync(path.join(worktreeRoot, write.path), 'utf8'),
    },
  }));
  runAuthorityTransaction({
    root: worktreeRoot,
    writes: linkedWrites,
    allowedPath,
    validate: () => {},
  });

  assert.equal(
    readFileSync(path.join(worktreeRoot, 'PROJECT_STATE.yaml'), 'utf8'),
    'state: next\n',
  );
  assert.equal(
    readFileSync(path.join(worktreeRoot, 'docs', 'delivery', 'ACTIVE_WORK_PACKET.yaml'), 'utf8'),
    'packet: next\n',
  );
  const lockPath = path.resolve(
    worktreeRoot,
    git(worktreeRoot, ['rev-parse', '--git-common-dir']),
    'mustbeviral-agent-transition.lock',
  );
  const journalPath = path.resolve(
    worktreeRoot,
    git(worktreeRoot, ['rev-parse', '--git-path', 'mustbeviral-agent-transition.json']),
  );
  assert.equal(existsSync(lockPath), false);
  assert.equal(existsSync(journalPath), false);

  const mainWrites = writes().map((write) => ({
    ...write,
    expected: {
      existed: true,
      content: readFileSync(path.join(mainRoot, write.path), 'utf8'),
    },
  }));
  const mainGitDir = path.resolve(mainRoot, git(mainRoot, ['rev-parse', '--git-dir']));
  const worktreeGitDir = path.resolve(worktreeRoot, git(worktreeRoot, ['rev-parse', '--git-dir']));
  createAuthorityTransitionJournal({
    root: mainRoot,
    writes: mainWrites,
    allowedPath,
    lockContext: {
      operation: 'finish',
      branch: git(mainRoot, ['branch', '--show-current']),
      head: git(mainRoot, ['rev-parse', 'HEAD']),
      gitDir: mainGitDir,
    },
  });
  assert.throws(
    () => runAuthorityRead({ root: worktreeRoot, read: () => assert.fail('lock must be common') }),
    /interrupted or concurrent authority transition/,
  );
  assert.throws(
    () =>
      recoverAuthorityTransition({
        root: worktreeRoot,
        allowedPath,
        validate: () => {},
        assertRecoveryContext: (context) => {
          if (context.gitDir !== worktreeGitDir) throw new Error('wrong worktree recovery');
        },
      }),
    /wrong worktree recovery/,
  );
  assert.equal(hasAuthorityTransitionJournal(mainRoot), true);
  recoverAuthorityTransition({
    root: mainRoot,
    allowedPath,
    validate: () => {},
    assertRecoveryContext: (context) => assert.equal(context.gitDir, mainGitDir),
  });
  assert.equal(hasAuthorityTransitionJournal(worktreeRoot), false);
});
