import { createHash } from 'node:crypto';

import { validateSchema } from './lib.mjs';
import { collectPacketErrors } from './validate-work-packet.mjs';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalPacketSha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export function evidencePathsForPacket(packet) {
  const paths = new Set(packet.completion?.evidence_paths ?? []);
  const checks = [
    ...(packet.acceptance?.automated ?? []),
    ...(packet.acceptance?.manual ?? []),
    ...(packet.quality_gates ?? []),
  ];
  for (const check of checks) {
    for (const evidencePath of check.evidence ?? []) paths.add(evidencePath);
  }
  return [...paths].sort();
}

export function closePredecessorPacket({ packet, completedAt }) {
  const closed = JSON.parse(JSON.stringify(packet));
  closed.status = 'complete';
  for (const step of closed.steps ?? []) {
    if (step.status === 'current') step.status = 'completed';
  }
  closed.handoff.blockers = [];
  closed.completion.completed_at ??= completedAt;
  return closed;
}

export function buildSuccessorState({ state, packet, successor, transitionedAt }) {
  return {
    ...state,
    project_state: 'active',
    active_work_packet: successor.id,
    next_action: successor.handoff.next_action,
    decisions_pending: [],
    blockers: [],
    phase: {
      id: successor.phase,
      title: successor.title,
      state: 'planned',
    },
    last_transition: {
      at: transitionedAt,
      by: 'pnpm agent:finish',
      evidence: [...packet.completion.evidence_paths],
    },
  };
}

export function createTransitionReceipt({
  closedPacket,
  successor,
  predecessorHead,
  closedPacketPath,
  evidenceEntries,
}) {
  return {
    schema_version: 1,
    packet_id: closedPacket.id,
    spec_revision: closedPacket.spec_revision,
    phase: closedPacket.phase,
    branch: closedPacket.branch,
    status: 'complete',
    completed_at: closedPacket.completion.completed_at,
    successor_packet_id: successor.id,
    predecessor_head: predecessorHead,
    closed_packet_path: closedPacketPath,
    completion_evidence_paths: [...closedPacket.completion.evidence_paths],
    evidence_entries: evidenceEntries,
    completed_step_ids: closedPacket.steps.map((step) => step.id),
    closed_packet_sha256: canonicalPacketSha256(closedPacket),
  };
}

function collectEvidenceErrors(packet, inspectEvidence) {
  const errors = [];
  const checks = [
    ...(packet.acceptance?.automated ?? []),
    ...(packet.acceptance?.manual ?? []),
    ...(packet.quality_gates ?? []),
  ];
  const evidencePaths = evidencePathsForPacket(packet);

  if (!packet.completion?.evidence_paths?.length) {
    errors.push('predecessor completion requires at least one evidence path');
  }
  for (const check of checks) {
    if (check.status === 'passed' && !check.evidence?.length) {
      errors.push(`passed check ${check.id ?? '<unknown>'} has no evidence`);
    }
  }
  if (evidencePaths.length && typeof inspectEvidence !== 'function') {
    errors.push('predecessor evidence inspector is required');
    return errors;
  }

  const prefix = `governance/evidence/${packet.id}/`;
  for (const evidencePath of evidencePaths) {
    const normalized = evidencePath.replaceAll('\\', '/');
    if (!normalized.startsWith(prefix)) {
      errors.push(`evidence path must be inside ${prefix}: ${evidencePath}`);
      continue;
    }
    const inspection = inspectEvidence(evidencePath);
    if (!inspection.exists) errors.push(`evidence file does not exist: ${evidencePath}`);
    else if (!inspection.regularFile || inspection.symbolicLink) {
      errors.push(`evidence path is not a regular repository file: ${evidencePath}`);
    } else if (inspection.size <= 0) {
      errors.push(`evidence file is empty: ${evidencePath}`);
    }
    if (!inspection.headContained) {
      errors.push(`evidence file is not committed in HEAD: ${evidencePath}`);
    } else if (!inspection.contentMatchesHead) {
      errors.push(`evidence file differs from HEAD: ${evidencePath}`);
    }
    if (!inspection.sha256 || !inspection.gitBlobOid) {
      errors.push(`evidence file has no verifiable content identity: ${evidencePath}`);
    }
  }
  return errors;
}

export function collectSuccessorTransitionErrors({
  state,
  packet,
  successor,
  manifest,
  branch,
  inspectEvidence,
}) {
  const errors = [
    ...validateSchema('governance/schemas/project-state.schema.json', state, 'PROJECT_STATE'),
    ...validateSchema('governance/schemas/work-packet.schema.json', packet, 'predecessor'),
    ...validateSchema('governance/schemas/work-packet.schema.json', successor, 'successor'),
    ...validateSchema('governance/schemas/manifest.schema.json', manifest, 'manifest'),
  ];

  if (!state || !packet || !successor || !manifest) return [...new Set(errors)];
  if (state.project_state !== 'active') {
    errors.push(`project must be active before finish, found ${state.project_state}`);
  }
  if (state.blockers?.length) errors.push('project blockers must be cleared before finish');
  if (state.decisions_pending?.length)
    errors.push('project decisions must be resolved before finish');
  if (!['in_progress', 'complete'].includes(packet.status)) {
    errors.push(
      `predecessor must be in_progress or complete before finish, found ${packet.status}`,
    );
  }
  if (packet.handoff?.blockers?.length)
    errors.push('predecessor blockers must be cleared before finish');

  const currentSteps = packet.steps?.filter((step) => step.status === 'current') ?? [];
  const unfinishedSteps = packet.steps?.filter((step) => step.status !== 'completed') ?? [];
  if (packet.status === 'in_progress') {
    if (currentSteps.length !== 1 || unfinishedSteps.length !== 1) {
      errors.push('in-progress predecessor must have only its final current step unfinished');
    }
    if (currentSteps[0]?.id !== packet.handoff?.current_step) {
      errors.push('predecessor handoff current_step must identify its final current step');
    }
  }
  if (packet.status === 'complete') {
    if (unfinishedSteps.length) errors.push('complete predecessor has unfinished steps');
    if (!packet.completion?.completed_at)
      errors.push('complete predecessor has no completion time');
  }

  if (packet.acceptance?.automated?.some((check) => check.status !== 'passed')) {
    errors.push('predecessor automated acceptance is incomplete');
  }
  if (
    packet.acceptance?.manual?.some((check) => !['passed', 'not_applicable'].includes(check.status))
  ) {
    errors.push('predecessor manual acceptance is incomplete');
  }
  if (packet.quality_gates?.some((gate) => gate.status !== 'passed')) {
    errors.push('predecessor quality gates are incomplete');
  }
  errors.push(...collectEvidenceErrors(packet, inspectEvidence));

  if (branch !== packet.branch) {
    errors.push(`branch ${branch} does not match predecessor branch ${packet.branch}`);
  }
  if (successor.branch !== packet.branch) {
    errors.push('successor must use the predecessor branch for the atomic transition');
  }
  if (successor.id !== packet.completion?.successor_packet_id) {
    errors.push('successor id does not match predecessor completion contract');
  }
  if (!successor.depends_on?.includes(packet.id)) {
    errors.push('successor must depend on the predecessor packet');
  }
  if (successor.status !== 'ready') errors.push('successor must initially be ready');
  if (successor.handoff?.blockers?.length) errors.push('ready successor cannot have blockers');
  if (successor.steps?.some((step) => step.status !== 'pending')) {
    errors.push('ready successor steps must initially be pending');
  }
  if (
    [...(successor.acceptance?.automated ?? []), ...(successor.acceptance?.manual ?? [])].some(
      (check) => check.status !== 'pending',
    )
  ) {
    errors.push('successor acceptance must initially be pending');
  }
  if (successor.quality_gates?.some((gate) => gate.status !== 'pending')) {
    errors.push('successor quality gates must initially be pending');
  }
  if (successor.completion?.completed_at !== null) {
    errors.push('successor completed_at must initially be null');
  }

  const structuralError = errors.some((error) =>
    /^(PROJECT_STATE|predecessor|successor|manifest)\//.test(error),
  );
  if (!structuralError) {
    const completedAt = '2000-01-01T00:00:00Z';
    const closedPacket = closePredecessorPacket({ packet, completedAt });
    const closedState = {
      ...state,
      phase: { ...state.phase, state: 'complete' },
    };
    errors.push(
      ...validateSchema(
        'governance/schemas/work-packet.schema.json',
        closedPacket,
        'closed predecessor',
      ),
      ...collectPacketErrors({
        state: closedState,
        packet: closedPacket,
        manifest,
        branch,
        changes: [],
      }),
    );

    const simulatedState = buildSuccessorState({
      state,
      packet: closedPacket,
      successor,
      transitionedAt: completedAt,
    });
    errors.push(
      ...validateSchema(
        'governance/schemas/project-state.schema.json',
        simulatedState,
        'successor state',
      ),
      ...collectPacketErrors({
        state: simulatedState,
        packet: successor,
        manifest,
        branch,
        changes: [],
      }),
    );
  }

  return [...new Set(errors)];
}
