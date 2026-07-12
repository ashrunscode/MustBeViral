import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import YAML from 'yaml';

import { recoverAuthorityTransition, runAuthorityTransaction } from './authority-transaction.mjs';
import {
  command,
  currentBranch,
  fromRoot,
  pathMatches,
  readText,
  readYaml,
  repoRoot,
  validateSchema,
} from './lib.mjs';
import { gitChangedPaths, inspectHeadEvidence } from './git-evidence.mjs';
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
  return {
    state: readYaml(STATE_PATH),
    packet: readYaml(PACKET_PATH),
    manifest: readYaml('docs/MANIFEST.yaml'),
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
  if (errors.length) throw new Error(errors.join('\n'));
}

function persistAuthority(writes, validate = ensureCurrentAuthorityValid) {
  runAuthorityTransaction({
    root: repoRoot,
    writes,
    allowedPath: isAuthorityTransitionPath,
    validate,
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
  const { state, packet, manifest } = load();
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

  persistAuthority([
    { path: PACKET_PATH, content: yaml(nextPacket) },
    { path: STATE_PATH, content: yaml(nextState) },
  ]);
  console.log(`Started ${packet.id}: ${first.id}`);
  return true;
}

function verify() {
  const { packet } = load();
  for (const gate of packet.quality_gates) {
    if (gate.command === 'pnpm agent:verify') continue;
    const [executable, ...args] = gate.command.split(' ');
    const result = command(executable, args);
    if (result.status !== 0) process.exit(result.status);
  }
  console.log(`Verification commands completed for ${packet.id}.`);
}

function handoff() {
  const { state, packet, manifest } = load();
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

  persistAuthority([
    { path: PACKET_PATH, content: yaml(nextPacket) },
    { path: STATE_PATH, content: yaml(nextState) },
  ]);
  console.log(`Handoff updated for ${packet.id}.`);
  return true;
}

function finish() {
  const successorPath = argument('--successor');
  if (!successorPath) throw new Error('finish requires --successor <relative-yaml-path>');
  const { state, packet, manifest } = load();
  const absoluteSuccessor = fromRoot(successorPath);
  if (!existsSync(absoluteSuccessor)) throw new Error('successor packet file does not exist');
  const successor = YAML.parse(readText(successorPath));
  const dirtyPaths = gitChangedPaths(repoRoot);
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
  const predecessorHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  const evidenceEntries = evidencePathsForPacket(packet).map((evidencePath) => {
    const inspection = inspectEvidence(evidencePath);
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

  persistAuthority(
    [
      { path: closedPacketPath, content: yaml(closedPacket) },
      { path: receiptPath, content: yaml(receipt) },
      { path: PACKET_PATH, content: yaml(successor) },
      { path: STATE_PATH, content: yaml(successorState) },
    ],
    () => {
      ensureCurrentAuthorityValid();
      const receiptValidationErrors = validateTransitionReceipts();
      if (receiptValidationErrors.length) throw new Error(receiptValidationErrors.join('\n'));
    },
  );
  console.log(`Completed ${packet.id}; activated ${successor.id}.`);
  return true;
}

function recover() {
  recoverAuthorityTransition({
    root: repoRoot,
    allowedPath: isAuthorityTransitionPath,
    validate: ensureCurrentAuthorityValid,
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
