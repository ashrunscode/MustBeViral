import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import {
  recoverAuthorityTransition,
  runAuthorityRead,
  runAuthorityTransaction,
} from './authority-transaction.mjs';
import {
  command,
  currentBranch,
  fromRoot,
  pathMatches,
  readText,
  repoRoot,
  validateSchema,
} from './lib.mjs';
import { gitChangedPaths, gitWorktreeFingerprint, inspectHeadEvidence } from './git-evidence.mjs';
import {
  buildSuccessorState,
  closePredecessorPacket,
  collectSuccessorTransitionErrors,
  createTransitionReceipt,
  evidencePathsForPacket,
} from './packet-transition.mjs';
import { validateTransitionReceipts } from './validate-transition-receipts.mjs';
import { collectPacketErrors, validateWorkPacket } from './validate-work-packet.mjs';

const STATE_PATH = 'PROJECT_STATE.yaml';
const PACKET_PATH = 'docs/delivery/ACTIVE_WORK_PACKET.yaml';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function yaml(value) {
  return YAML.stringify(value, { lineWidth: 100 });
}

function load() {
  const stateText = readText(STATE_PATH);
  const packetText = readText(PACKET_PATH);
  const manifestText = readText('docs/MANIFEST.yaml');
  return {
    state: YAML.parse(stateText),
    packet: YAML.parse(packetText),
    manifest: YAML.parse(manifestText),
    loadedAuthority: {
      stateText,
      packetText,
      manifestText,
      branch: currentBranch(),
      head: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim(),
      gitDir: path.resolve(
        repoRoot,
        execFileSync('git', ['rev-parse', '--git-dir'], {
          cwd: repoRoot,
          encoding: 'utf8',
        }).trim(),
      ),
      changedPaths: gitChangedPaths(repoRoot),
      worktreeFingerprint: gitWorktreeFingerprint(repoRoot),
      stableFiles: [{ path: 'docs/MANIFEST.yaml', content: manifestText }],
      evidenceFiles: [],
    },
  };
}

function isAuthorityTransitionPath(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  return (
    normalized === STATE_PATH ||
    normalized === PACKET_PATH ||
    /^governance\/evidence\/[A-Z0-9][A-Z0-9._-]+\/(?:transition-receipt|completed-work-packet)\.yaml$/.test(
      normalized,
    )
  );
}

function ensureCurrentAuthorityValid() {
  const errors = validateWorkPacket({ checkDiff: false });
  errors.push(...validateTransitionReceipts());
  if (errors.length) throw new Error(errors.join('\n'));
}

function expectedExisting(content) {
  return { existed: true, content };
}

function expectedAbsent() {
  return { existed: false, content: null };
}

function assertGitContext(context) {
  const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  if (currentBranch() !== context?.branch) {
    throw new Error('Git branch changed after authority was loaded');
  }
  if (currentHead !== context?.head) {
    throw new Error('Git HEAD changed after authority was loaded');
  }
  const currentGitDir = path.resolve(
    repoRoot,
    execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim(),
  );
  if (currentGitDir !== context?.gitDir) {
    throw new Error('Git worktree changed after authority was loaded');
  }
}

function assertStableInputsUnchanged(loadedAuthority, transactionWorktree) {
  assertGitContext(loadedAuthority);
  for (const expected of loadedAuthority.stableFiles) {
    if (!existsSync(fromRoot(expected.path)) || readText(expected.path) !== expected.content) {
      throw new Error(`authority input changed after it was loaded: ${expected.path}`);
    }
  }
  for (const expected of loadedAuthority.evidenceFiles) {
    const inspection = inspectEvidence(expected.path);
    if (
      inspection.sha256 !== expected.sha256 ||
      !inspection.headContained ||
      !inspection.contentMatchesHead
    ) {
      throw new Error(`authority evidence changed after it was loaded: ${expected.path}`);
    }
  }
  if (
    transactionWorktree &&
    gitWorktreeFingerprint(repoRoot, {
      excludePaths: transactionWorktree.writePaths,
    }) !== transactionWorktree.fingerprint
  ) {
    throw new Error('non-authority worktree content changed during the authority transition');
  }
}

function assertInitialInputsUnchanged(loadedAuthority) {
  assertStableInputsUnchanged(loadedAuthority);
  const currentChanges = gitChangedPaths(repoRoot);
  if (JSON.stringify(currentChanges) !== JSON.stringify(loadedAuthority.changedPaths)) {
    throw new Error('Git worktree changed after authority was loaded');
  }
  if (gitWorktreeFingerprint(repoRoot) !== loadedAuthority.worktreeFingerprint) {
    throw new Error('Git worktree content changed after authority was loaded');
  }
}

function persistAuthority({ writes, loadedAuthority, validate = ensureCurrentAuthorityValid }) {
  const transactionWorktree = {
    writePaths: writes.map((write) => write.path),
    fingerprint: gitWorktreeFingerprint(repoRoot, {
      excludePaths: writes.map((write) => write.path),
    }),
  };
  runAuthorityTransaction({
    root: repoRoot,
    writes,
    allowedPath: isAuthorityTransitionPath,
    validate,
    assertInitialContext: () => {
      assertInitialInputsUnchanged(loadedAuthority);
      ensureCurrentAuthorityValid();
    },
    assertExpectedContext: () => assertStableInputsUnchanged(loadedAuthority, transactionWorktree),
    assertRecoveryContext: () => assertGitContext(loadedAuthority),
    lockContext: {
      operation: process.argv[2],
      branch: loadedAuthority.branch,
      head: loadedAuthority.head,
      gitDir: loadedAuthority.gitDir,
    },
  });
}

function inspectEvidence(relativePath) {
  return inspectHeadEvidence({ root: repoRoot, relativePath });
}

function validateProspectiveAuthority({ state, packet, manifest }) {
  const errors = [
    ...validateSchema('governance/schemas/project-state.schema.json', state, 'PROJECT_STATE'),
    ...validateSchema('governance/schemas/work-packet.schema.json', packet, 'ACTIVE_WORK_PACKET'),
    ...collectPacketErrors({
      state,
      packet,
      manifest,
      branch: currentBranch(),
      changes: [],
    }),
  ];
  if (errors.length) throw new Error([...new Set(errors)].join('\n'));
}

function start() {
  const { state, packet, manifest, loadedAuthority } = load();
  if (packet.status !== 'ready') throw new Error(`packet must be ready, found ${packet.status}`);
  if (state.decisions_pending.length || state.blockers.length) {
    throw new Error('project has unresolved decisions or blockers');
  }
  const first = packet.steps.find((step) => step.status === 'pending');
  if (!first) throw new Error('packet has no pending step');

  const nextPacket = JSON.parse(JSON.stringify(packet));
  const nextState = JSON.parse(JSON.stringify(state));
  nextPacket.status = 'in_progress';
  nextPacket.steps.find((step) => step.id === first.id).status = 'current';
  nextPacket.handoff.current_step = first.id;
  nextPacket.handoff.next_action = first.title;
  nextState.project_state = 'active';
  nextState.phase.state = 'in_progress';
  nextState.next_action = first.title;
  validateProspectiveAuthority({ state: nextState, packet: nextPacket, manifest });

  persistAuthority({
    loadedAuthority,
    writes: [
      {
        path: PACKET_PATH,
        content: yaml(nextPacket),
        expected: expectedExisting(loadedAuthority.packetText),
      },
      {
        path: STATE_PATH,
        content: yaml(nextState),
        expected: expectedExisting(loadedAuthority.stateText),
      },
    ],
  });
  console.log(`Started ${packet.id}: ${first.id}`);
  return true;
}

function verify() {
  const snapshot = runAuthorityRead({
    root: repoRoot,
    lockContext: { operation: 'verify-snapshot' },
    read: load,
  });
  const { packet } = snapshot;
  for (const gate of packet.quality_gates) {
    if (gate.command === 'pnpm agent:verify') continue;
    const [executable, ...args] = gate.command.split(' ');
    const result = command(executable, args);
    if (result.status !== 0) process.exit(result.status);
  }
  runAuthorityRead({
    root: repoRoot,
    lockContext: { operation: 'verify-confirmation' },
    read: () => {
      if (
        readText(STATE_PATH) !== snapshot.loadedAuthority.stateText ||
        readText(PACKET_PATH) !== snapshot.loadedAuthority.packetText ||
        gitWorktreeFingerprint(repoRoot) !== snapshot.loadedAuthority.worktreeFingerprint
      ) {
        throw new Error('authority changed while packet verification was running');
      }
      assertGitContext(snapshot.loadedAuthority);
      ensureCurrentAuthorityValid();
    },
  });
  console.log(`Verification commands completed for ${packet.id}.`);
  return true;
}

function handoff() {
  const { state, packet, manifest, loadedAuthority } = load();
  const nextAction = argument('--next-action');
  if (!nextAction) throw new Error('handoff requires --next-action "..."');
  const nextPacket = JSON.parse(JSON.stringify(packet));
  const nextState = JSON.parse(JSON.stringify(state));
  nextPacket.handoff.next_action = nextAction;
  nextState.next_action = nextAction;

  const blocker = argument('--blocker');
  if (blocker) {
    if (!nextPacket.handoff.blockers.includes(blocker)) nextPacket.handoff.blockers.push(blocker);
    if (!nextState.blockers.includes(blocker)) nextState.blockers.push(blocker);
    nextPacket.status = 'blocked';
    nextState.project_state = 'blocked';
    nextState.phase.state = 'blocked';
  }
  validateProspectiveAuthority({ state: nextState, packet: nextPacket, manifest });

  persistAuthority({
    loadedAuthority,
    writes: [
      {
        path: PACKET_PATH,
        content: yaml(nextPacket),
        expected: expectedExisting(loadedAuthority.packetText),
      },
      {
        path: STATE_PATH,
        content: yaml(nextState),
        expected: expectedExisting(loadedAuthority.stateText),
      },
    ],
  });
  console.log(`Handoff updated for ${packet.id}.`);
  return true;
}

function finish() {
  const successorPath = argument('--successor');
  if (!successorPath) throw new Error('finish requires --successor <relative-yaml-path>');
  const { state, packet, manifest, loadedAuthority } = load();
  if (
    /^[A-Za-z]:[\\/]/.test(successorPath) ||
    successorPath.startsWith('/') ||
    successorPath.startsWith('\\\\') ||
    successorPath.split(/[\\/]/).includes('..')
  ) {
    throw new Error('successor packet path must stay inside the repository');
  }
  const absoluteSuccessor = fromRoot(successorPath);
  if (!existsSync(absoluteSuccessor)) throw new Error('successor packet file does not exist');
  const successorText = readText(successorPath);
  loadedAuthority.stableFiles.push({ path: successorPath, content: successorText });
  const successor = YAML.parse(successorText);
  const dirtyPaths = loadedAuthority.changedPaths;
  const errors = collectSuccessorTransitionErrors({
    state,
    packet,
    successor,
    manifest,
    branch: currentBranch(),
    inspectEvidence,
  });
  if (dirtyPaths.length) {
    errors.push(
      `finish requires a clean committed predecessor; dirty paths: ${dirtyPaths.join(', ')}`,
    );
  }

  const receiptPath = `governance/evidence/${packet.id}/transition-receipt.yaml`;
  const closedPacketPath = `governance/evidence/${packet.id}/completed-work-packet.yaml`;
  for (const transitionPath of [STATE_PATH, PACKET_PATH, receiptPath, closedPacketPath]) {
    const predecessorAllows =
      pathMatches(transitionPath, packet.scope?.allowed_paths ?? []) &&
      !pathMatches(transitionPath, packet.scope?.forbidden_paths ?? []);
    const successorAllows =
      pathMatches(transitionPath, successor.scope?.allowed_paths ?? []) &&
      !pathMatches(transitionPath, successor.scope?.forbidden_paths ?? []);
    if (!predecessorAllows) {
      errors.push(`predecessor scope does not allow transition path: ${transitionPath}`);
    }
    if (!successorAllows) {
      errors.push(`successor scope does not allow transition path: ${transitionPath}`);
    }
  }
  if (errors.length) throw new Error([...new Set(errors)].join('\n'));

  const transitionedAt = new Date().toISOString();
  const closedPacket = closePredecessorPacket({ packet, completedAt: transitionedAt });
  const predecessorHead = loadedAuthority.head;
  const evidenceEntries = evidencePathsForPacket(packet).map((evidencePath) => {
    const inspection = inspectEvidence(evidencePath);
    loadedAuthority.evidenceFiles.push({ path: evidencePath, sha256: inspection.sha256 });
    return {
      path: evidencePath,
      sha256: inspection.sha256,
      git_blob_oid: inspection.gitBlobOid,
    };
  });
  const receipt = createTransitionReceipt({
    closedPacket,
    successor,
    predecessorHead,
    closedPacketPath,
    evidenceEntries,
  });
  const receiptErrors = validateSchema(
    'governance/schemas/packet-transition-receipt.schema.json',
    receipt,
    'transition receipt',
  );
  if (receiptErrors.length) throw new Error(receiptErrors.join('\n'));
  const successorState = buildSuccessorState({
    state,
    packet: closedPacket,
    successor,
    transitionedAt,
  });

  persistAuthority({
    loadedAuthority,
    writes: [
      {
        path: closedPacketPath,
        content: yaml(closedPacket),
        expected: expectedAbsent(),
      },
      { path: receiptPath, content: yaml(receipt), expected: expectedAbsent() },
      {
        path: PACKET_PATH,
        content: yaml(successor),
        expected: expectedExisting(loadedAuthority.packetText),
      },
      {
        path: STATE_PATH,
        content: yaml(successorState),
        expected: expectedExisting(loadedAuthority.stateText),
      },
    ],
  });
  console.log(`Completed ${packet.id}; activated ${successor.id}.`);
  return true;
}

function recover() {
  recoverAuthorityTransition({
    root: repoRoot,
    allowedPath: isAuthorityTransitionPath,
    validate: ensureCurrentAuthorityValid,
    assertRecoveryContext: (context) => {
      if (context?.read_only === true) return;
      if (!context?.branch || !context?.head || !context?.gitDir) {
        throw new Error('authority transition lacks recoverable Git context');
      }
      assertGitContext(context);
    },
  });
  console.log('Interrupted authority transition rolled back; rerun preflight.');
  return true;
}

const action = process.argv[2];
try {
  let validated = false;
  if (action === 'start') validated = start();
  else if (action === 'verify') verify();
  else if (action === 'handoff') validated = handoff();
  else if (action === 'finish') validated = finish();
  else if (action === 'recover') validated = recover();
  else throw new Error('usage: agent-state.mjs <start|verify|handoff|finish|recover>');
  if (!validated) validateWorkPacket({ checkDiff: false });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
