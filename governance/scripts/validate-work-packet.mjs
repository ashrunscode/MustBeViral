import {
  changedPaths,
  currentBranch,
  fail,
  hasAbsolutePath,
  pathMatches,
  readYaml,
  validateSchema,
  worktreeCount,
} from './lib.mjs';

export function collectPacketErrors({ state, packet, manifest, branch = '', changes = [] }) {
  const errors = [];
  if (state.active_work_packet !== packet.id)
    errors.push('PROJECT_STATE active packet does not match ACTIVE_WORK_PACKET');
  if (state.phase?.id !== packet.phase) errors.push('project phase does not match packet phase');
  if (branch && branch !== packet.branch)
    errors.push(`branch ${branch} does not match packet branch ${packet.branch}`);
  if (state.project_state === 'active' && state.decisions_pending?.length)
    errors.push('active project has unresolved decisions');
  if (state.project_state === 'blocked' && !state.blockers?.length)
    errors.push('blocked project has no blocker');
  if (packet.status === 'blocked' && !packet.handoff?.blockers?.length)
    errors.push('blocked packet has no blocker');

  const current = packet.steps?.filter((step) => step.status === 'current') ?? [];
  if (packet.status === 'in_progress' && current.length !== 1)
    errors.push('in-progress packet must have exactly one current step');
  if (current.length === 1 && packet.handoff?.current_step !== current[0].id)
    errors.push('handoff current_step does not match the current step');

  if (packet.status === 'complete') {
    if (packet.steps.some((step) => step.status !== 'completed'))
      errors.push('completed packet has unfinished steps');
    const checks = [...(packet.acceptance?.automated ?? []), ...(packet.acceptance?.manual ?? [])];
    if (checks.some((check) => !['passed', 'not_applicable'].includes(check.status)))
      errors.push('completed packet has unproved acceptance');
    if (checks.some((check) => check.status === 'passed' && !check.evidence?.length))
      errors.push('completed packet has passed acceptance without evidence');
    if (packet.quality_gates.some((gate) => gate.status !== 'passed' || !gate.evidence?.length))
      errors.push('completed packet has unproved quality gates');
    if (!packet.completion?.successor_packet_id) errors.push('completed packet has no successor');
  }

  const documentIds = new Set(manifest.documents?.map((document) => document.id));
  for (const id of [...(packet.authority_refs ?? []), ...(packet.scope?.required_doc_ids ?? [])]) {
    if (!documentIds.has(id)) errors.push(`packet references unknown document ${id}`);
  }

  if (hasAbsolutePath(state) || hasAbsolutePath(packet))
    errors.push('machine state contains an absolute path');

  for (const changedPath of changes) {
    const allowed = pathMatches(changedPath, packet.scope?.allowed_paths ?? []);
    const forbidden = pathMatches(changedPath, packet.scope?.forbidden_paths ?? []);
    if (!allowed || forbidden) errors.push(`changed path is outside packet scope: ${changedPath}`);
  }

  return errors;
}

export function validateWorkPacket({ checkDiff = true } = {}) {
  const state = readYaml('PROJECT_STATE.yaml');
  const packet = readYaml('docs/delivery/ACTIVE_WORK_PACKET.yaml');
  const manifest = readYaml('docs/MANIFEST.yaml');
  const errors = [
    ...validateSchema('governance/schemas/project-state.schema.json', state, 'PROJECT_STATE'),
    ...validateSchema('governance/schemas/work-packet.schema.json', packet, 'ACTIVE_WORK_PACKET'),
    ...collectPacketErrors({
      state,
      packet,
      manifest,
      branch: currentBranch(),
      changes: checkDiff ? changedPaths() : [],
    }),
  ];
  if (worktreeCount() > 1)
    errors.push('multiple linked worktrees are not allowed during the single-packet phase');
  fail(errors, 'Work-packet validation failed');
  if (!errors.length)
    console.log(`Active packet valid: ${packet.id} / ${packet.handoff.current_step}`);
  return errors;
}

if (process.argv[1]?.endsWith('validate-work-packet.mjs')) validateWorkPacket();
