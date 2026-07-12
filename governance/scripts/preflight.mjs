import { execFileSync } from 'node:child_process';

import { hasAuthorityTransitionJournal } from './authority-transaction.mjs';
import { currentBranch, readYaml, repoRoot, worktreeCount } from './lib.mjs';
import { scanCleanroom } from './scan-cleanroom.mjs';
import { validateDocs } from './validate-docs.mjs';
import { validateWorkPacket } from './validate-work-packet.mjs';

if (hasAuthorityTransitionJournal(repoRoot)) {
  console.error(
    'Interrupted authority transition detected. Run pnpm agent:recover before continuing.',
  );
  process.exit(1);
}

function safeToolVersion(command, args = ['--version']) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim().split(/\r?\n/).at(-1);
  } catch {
    return 'missing';
  }
}

const before = process.exitCode;
validateDocs();
validateWorkPacket();
scanCleanroom();
if (process.exitCode && process.exitCode !== before) process.exit(process.exitCode);

const state = readYaml('PROJECT_STATE.yaml');
const packet = readYaml('docs/delivery/ACTIVE_WORK_PACKET.yaml');
const manifest = readYaml('docs/MANIFEST.yaml');
const documents = new Map(manifest.documents.map((document) => [document.id, document.path]));

console.log('\nMustBeViral agent preflight');
console.log(`Product: ${state.product_name}`);
console.log(`Engine: ${state.internal_engine_name}`);
console.log(`Launch customer: ${state.launch_customer}`);
console.log(`Generation: ${state.generation}`);
console.log(`Phase: ${state.phase.id} / ${state.phase.state}`);
console.log(`Active packet: ${packet.id} / ${packet.status}`);
console.log(`Current step: ${packet.handoff.current_step}`);
console.log(`Next action: ${packet.handoff.next_action}`);
console.log(`Branch: ${currentBranch()}`);
console.log(`Linked worktrees: ${worktreeCount()}`);
console.log(`Remote destructive action: ${state.legacy.destructive_remote_action}`);
console.log(
  `Blockers: ${[...new Set([...state.blockers, ...packet.handoff.blockers])].join('; ') || 'none'}`,
);
console.log(`Pending decisions: ${state.decisions_pending.join('; ') || 'none'}`);
const pnpmFromAgent = /pnpm\/([^\s]+)/.exec(process.env.npm_config_user_agent ?? '')?.[1];
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
console.log(
  `Runtime: Node ${process.version}; pnpm ${pnpmFromAgent ?? safeToolVersion(pnpmCommand)}`,
);
console.log('\nRead in this order:');
console.log('- AGENTS.md');
console.log('- PROJECT_STATE.yaml');
for (const id of packet.scope.required_doc_ids) console.log(`- ${documents.get(id)}`);
console.log('- docs/delivery/ACTIVE_WORK_PACKET.yaml');
console.log('\nAllowed paths:');
for (const allowed of packet.scope.allowed_paths) console.log(`- ${allowed}`);
console.log('\nVerification commands:');
for (const gate of packet.quality_gates) console.log(`- ${gate.command}`);
