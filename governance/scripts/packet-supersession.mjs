import { execFileSync } from 'node:child_process';

import { pathMatches, validateSchema } from './lib.mjs';
import { canonicalPacketSha256, evidencePathsForPacket } from './packet-transition.mjs';
import { collectPacketErrors } from './validate-work-packet.mjs';

export function unfinishedStepIds(packet) {
  return packet.steps.filter((step) => step.status !== 'completed').map((step) => step.id);
}

export function unprovedAcceptanceIds(packet) {
  return [...packet.acceptance.automated, ...packet.acceptance.manual]
    .filter((check) => !['passed', 'not_applicable'].includes(check.status))
    .map((check) => check.id);
}

export function supersessionEvidencePaths({ root, packet, decisionPath, successorPath, head }) {
  const directory = `governance/evidence/${packet.id}/`;
  const committed = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', '-z', head, '--', directory],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
    .split('\0')
    .filter(Boolean);
  return [
    ...new Set([...committed, ...evidencePathsForPacket(packet), decisionPath, successorPath]),
  ].sort();
}

export function collectSupersessionErrors({
  state,
  packet,
  successor,
  decision,
  manifest,
  branch,
}) {
  const errors = [
    ...validateSchema('governance/schemas/project-state.schema.json', state, 'PROJECT_STATE'),
    ...validateSchema('governance/schemas/work-packet.schema.json', packet, 'predecessor'),
    ...validateSchema('governance/schemas/work-packet.schema.json', successor, 'successor'),
    ...validateSchema(
      'governance/schemas/packet-supersession-decision.schema.json',
      decision,
      'owner decision',
    ),
  ];
  if (errors.length) return errors;
  errors.push(...collectPacketErrors({ state, packet, manifest, branch, changes: [] }));
  if (packet.status === 'complete' || packet.completion.completed_at !== null) {
    errors.push('supersession requires an unfinished predecessor');
  }
  if (
    state.project_state !== 'active' ||
    state.blockers.length ||
    state.decisions_pending.length ||
    packet.handoff.blockers.length
  ) {
    errors.push('resolve project blockers and pending decisions before supersession');
  }
  if (
    decision.predecessor_packet_id !== packet.id ||
    decision.predecessor_spec_revision !== packet.spec_revision
  ) {
    errors.push('owner decision does not authorize this predecessor revision');
  }
  if (
    decision.successor_packet_id !== successor.id ||
    decision.successor_spec_revision !== successor.spec_revision
  ) {
    errors.push('owner decision does not authorize this successor revision');
  }
  if (branch !== packet.branch || successor.branch !== branch || decision.branch !== branch) {
    errors.push('owner decision and both packets must match the current branch');
  }
  if (successor.id === packet.id || !successor.depends_on.includes(packet.id)) {
    errors.push('successor must have a distinct id and depend on the predecessor');
  }
  if (
    successor.status !== 'ready' ||
    successor.handoff.blockers.length ||
    successor.steps.some((s) => s.status !== 'pending')
  ) {
    errors.push('successor must be ready with pending steps and no blockers');
  }
  if (
    [
      ...successor.acceptance.automated,
      ...successor.acceptance.manual,
      ...successor.quality_gates,
    ].some((c) => c.status !== 'pending') ||
    successor.completion.completed_at !== null
  ) {
    errors.push('successor must have pending acceptance and gates with no completion timestamp');
  }
  if (
    successor.external_effects.remote_mutation !== 'none' ||
    successor.external_effects.destructive_remote_actions
  ) {
    errors.push('local supersession does not authorize successor external mutations');
  }
  for (const check of [
    ...packet.acceptance.automated,
    ...packet.acceptance.manual,
    ...packet.quality_gates,
  ]) {
    if (check.status === 'passed' && !check.evidence.length)
      errors.push(`passed check ${check.id} lacks evidence`);
  }
  const nextState = buildSupersessionState({
    state,
    successor,
    decisionPath: 'decision.yaml',
    transitionedAt: decision.authorized_at,
  });
  errors.push(
    ...collectPacketErrors({ state: nextState, packet: successor, manifest, branch, changes: [] }),
  );
  return [...new Set(errors)];
}

export function supersessionWritePaths(packet) {
  return [
    `governance/evidence/${packet.id}/superseded-work-packet.yaml`,
    `governance/evidence/${packet.id}/transition-receipt.yaml`,
    'docs/delivery/ACTIVE_WORK_PACKET.yaml',
    'PROJECT_STATE.yaml',
  ];
}

export function collectSupersessionScopeErrors({ packet, successor }) {
  return [packet, successor].flatMap((owner) =>
    supersessionWritePaths(packet)
      .filter(
        (p) =>
          !pathMatches(p, owner.scope.allowed_paths) || pathMatches(p, owner.scope.forbidden_paths),
      )
      .map((p) => `${owner.id} scope does not allow supersession path: ${p}`),
  );
}

export function buildSupersessionState({ state, successor, decisionPath, transitionedAt }) {
  return {
    ...state,
    active_work_packet: successor.id,
    next_action: successor.handoff.next_action,
    phase: { id: successor.phase, title: successor.title, state: 'planned' },
    last_transition: { at: transitionedAt, by: 'pnpm agent:supersede', evidence: [decisionPath] },
  };
}

export function createSupersessionReceipt({
  packet,
  successor,
  decisionPath,
  successorPath,
  predecessorHead,
  evidenceEntries,
  transitionedAt,
}) {
  return {
    schema_version: 2,
    status: 'superseded',
    packet_id: packet.id,
    spec_revision: packet.spec_revision,
    phase: packet.phase,
    branch: packet.branch,
    superseded_at: transitionedAt,
    successor_packet_id: successor.id,
    successor_spec_revision: successor.spec_revision,
    successor_packet_path: successorPath,
    successor_packet_sha256: canonicalPacketSha256(successor),
    predecessor_head: predecessorHead,
    closed_packet_path: supersessionWritePaths(packet)[0],
    closed_packet_sha256: canonicalPacketSha256(packet),
    decision_path: decisionPath,
    evidence_entries: evidenceEntries,
    unfinished_step_ids: unfinishedStepIds(packet),
    unproved_acceptance_ids: unprovedAcceptanceIds(packet),
  };
}
