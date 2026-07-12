import { existsSync, copyFileSync } from 'node:fs';

import YAML from 'yaml';

import { command, fromRoot, readText, readYaml, validateSchema, writeAtomic } from './lib.mjs';
import { validateWorkPacket } from './validate-work-packet.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function saveYaml(relativePath, value) {
  writeAtomic(relativePath, YAML.stringify(value, { lineWidth: 100 }));
}

function load() {
  return {
    state: readYaml('PROJECT_STATE.yaml'),
    packet: readYaml('docs/delivery/ACTIVE_WORK_PACKET.yaml'),
  };
}

function start() {
  const { state, packet } = load();
  if (packet.status !== 'ready') throw new Error(`packet must be ready, found ${packet.status}`);
  if (state.decisions_pending.length || state.blockers.length)
    throw new Error('project has unresolved decisions or blockers');
  const first = packet.steps.find((step) => step.status === 'pending');
  if (!first) throw new Error('packet has no pending step');
  packet.status = 'in_progress';
  first.status = 'current';
  packet.handoff.current_step = first.id;
  packet.handoff.next_action = first.title;
  state.phase.state = 'in_progress';
  saveYaml('docs/delivery/ACTIVE_WORK_PACKET.yaml', packet);
  saveYaml('PROJECT_STATE.yaml', state);
  console.log(`Started ${packet.id}: ${first.id}`);
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
  const { packet } = load();
  const nextAction = argument('--next-action');
  if (!nextAction) throw new Error('handoff requires --next-action "..."');
  packet.handoff.next_action = nextAction;
  const blocker = argument('--blocker');
  if (blocker && !packet.handoff.blockers.includes(blocker)) packet.handoff.blockers.push(blocker);
  saveYaml('docs/delivery/ACTIVE_WORK_PACKET.yaml', packet);
  console.log(`Handoff updated for ${packet.id}.`);
}

function finish() {
  const successorPath = argument('--successor');
  if (!successorPath) throw new Error('finish requires --successor <relative-yaml-path>');
  const { state, packet } = load();
  if (packet.acceptance.automated.some((check) => check.status !== 'passed'))
    throw new Error('automated acceptance is incomplete');
  if (
    packet.acceptance.manual.some((check) => !['passed', 'not_applicable'].includes(check.status))
  )
    throw new Error('manual acceptance is incomplete');
  if (packet.quality_gates.some((gate) => gate.status !== 'passed'))
    throw new Error('quality gates are incomplete');
  const absoluteSuccessor = fromRoot(successorPath);
  if (!existsSync(absoluteSuccessor)) throw new Error('successor packet file does not exist');
  const successor = YAML.parse(readText(successorPath));
  const schemaErrors = validateSchema(
    'governance/schemas/work-packet.schema.json',
    successor,
    'successor',
  );
  if (schemaErrors.length) throw new Error(schemaErrors.join('\n'));
  if (successor.id !== packet.completion.successor_packet_id)
    throw new Error('successor id does not match completion contract');
  copyFileSync(absoluteSuccessor, fromRoot('docs/delivery/ACTIVE_WORK_PACKET.yaml'));
  state.active_work_packet = successor.id;
  state.phase.id = successor.phase;
  state.phase.title = successor.title;
  state.phase.state = successor.status === 'ready' ? 'planned' : successor.status;
  state.next_action = successor.handoff.next_action;
  saveYaml('PROJECT_STATE.yaml', state);
  console.log(`Completed ${packet.id}; activated ${successor.id}.`);
}

const action = process.argv[2];
try {
  if (action === 'start') start();
  else if (action === 'verify') verify();
  else if (action === 'handoff') handoff();
  else if (action === 'finish') finish();
  else throw new Error('usage: agent-state.mjs <start|verify|handoff|finish>');
  validateWorkPacket({ checkDiff: false });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
