import assert from 'node:assert/strict';
import test from 'node:test';

import { readYaml, validateSchema } from '../scripts/lib.mjs';
import {
  buildSuccessorState,
  closePredecessorPacket,
  collectSuccessorTransitionErrors,
  createTransitionReceipt,
} from '../scripts/packet-transition.mjs';

const manifest = readYaml('docs/MANIFEST.yaml');
const evidencePath = 'governance/evidence/WP-R0-001/proof.md';

const state = () => ({
  schema_version: 1,
  project_id: 'mustbeviral',
  generation: 'viralgraph-cleanroom-v2',
  product_name: 'MustBeViral Studio',
  internal_engine_name: 'ViralGraph',
  launch_customer: 'dtc_ecommerce_marketing_teams',
  project_state: 'active',
  phase: { id: 'R0', title: 'Reset', state: 'in_progress' },
  release_target: 'P0',
  active_work_packet: 'WP-R0-001',
  next_action: 'Finish the packet',
  decisions_pending: [],
  blockers: [],
  legacy: {
    active_tree_policy: 'prohibited',
    rollback_tag: 'legacy-cloudflare-v1-run21',
    remote_retirement_state: 'inventory_required',
    destructive_remote_action: 'forbidden',
  },
  environments: {
    production: { generation: 'legacy-v1', state: 'ready' },
    staging: { generation: 'viralgraph-cleanroom-v2', state: 'not_created' },
    preview: { generation: 'viralgraph-cleanroom-v2', state: 'not_created' },
  },
  last_transition: {
    at: '2026-01-01T00:00:00Z',
    by: 'test',
    evidence: 'test',
  },
});

const predecessor = () => ({
  schema_version: 1,
  id: 'WP-R0-001',
  spec_revision: 1,
  title: 'Reset',
  phase: 'R0',
  status: 'in_progress',
  priority: 'critical',
  branch: 'codex/viralgraph-cleanroom',
  objective: 'Complete a safe reset.',
  authority_refs: ['product-contract'],
  required_skills: [],
  depends_on: [],
  scope: {
    allowed_paths: ['governance/**', 'PROJECT_STATE.yaml', 'docs/delivery/**'],
    forbidden_paths: ['docs/archive/**'],
    required_doc_ids: ['product-contract'],
  },
  deliverables: ['Safe reset'],
  public_interfaces: [],
  steps: [
    { id: 'build', title: 'Build', status: 'completed' },
    { id: 'handoff', title: 'Handoff', status: 'current' },
  ],
  acceptance: {
    automated: [
      {
        id: 'automated',
        criterion: 'Automated proof passes.',
        status: 'passed',
        evidence: [evidencePath],
      },
    ],
    manual: [
      {
        id: 'manual',
        criterion: 'Manual proof passes.',
        status: 'passed',
        evidence: [evidencePath],
      },
    ],
  },
  quality_gates: [
    {
      id: 'verify',
      command: 'pnpm verify',
      status: 'passed',
      evidence: [evidencePath],
    },
  ],
  rollback: { strategy: 'Revert the reset.', remote_actions_required: false },
  external_effects: { remote_mutation: 'none', destructive_remote_actions: false },
  handoff: {
    current_step: 'handoff',
    next_action: 'Finish the packet.',
    blockers: [],
    changed_paths: ['governance/**'],
    last_green_checks: ['pnpm verify'],
  },
  completion: {
    successor_packet_id: 'WP-D0-001',
    evidence_paths: [evidencePath],
    completed_at: null,
  },
});

const successor = () => ({
  schema_version: 1,
  id: 'WP-D0-001',
  spec_revision: 1,
  title: 'Design direction',
  phase: 'D0',
  status: 'ready',
  priority: 'critical',
  branch: 'codex/viralgraph-cleanroom',
  objective: 'Select an approved design direction.',
  authority_refs: ['product-contract'],
  required_skills: ['superdesign'],
  depends_on: ['WP-R0-001'],
  scope: {
    allowed_paths: [
      '.superdesign/**',
      'PROJECT_STATE.yaml',
      'docs/delivery/ACTIVE_WORK_PACKET.yaml',
      'governance/evidence/WP-R0-001/transition-receipt.yaml',
    ],
    forbidden_paths: ['apps/**'],
    required_doc_ids: ['product-contract'],
  },
  deliverables: ['Three design directions'],
  public_interfaces: [],
  steps: [{ id: 'design', title: 'Create directions', status: 'pending' }],
  acceptance: {
    automated: [
      {
        id: 'artifacts',
        criterion: 'Required artifacts exist.',
        status: 'pending',
        evidence: [],
      },
    ],
    manual: [
      {
        id: 'approval',
        criterion: 'The user approves one direction.',
        status: 'pending',
        evidence: [],
      },
    ],
  },
  quality_gates: [
    { id: 'governance', command: 'pnpm governance:check', status: 'pending', evidence: [] },
  ],
  rollback: { strategy: 'Revert design-only artifacts.', remote_actions_required: false },
  external_effects: { remote_mutation: 'authorized', destructive_remote_actions: false },
  handoff: {
    current_step: 'design',
    next_action: 'Run pnpm agent:start.',
    blockers: [],
    changed_paths: [],
    last_green_checks: ['pnpm governance:check'],
  },
  completion: { successor_packet_id: 'WP-D0-002', evidence_paths: [], completed_at: null },
});

const validEvidence = () => ({
  exists: true,
  regularFile: true,
  symbolicLink: false,
  size: 128,
  headContained: true,
  contentMatchesHead: true,
  sha256: 'b'.repeat(64),
  headSha256: 'b'.repeat(64),
  gitBlobOid: 'c'.repeat(40),
});

const transitionErrors = ({
  currentState = state(),
  currentPacket = predecessor(),
  nextPacket = successor(),
  branch = 'codex/viralgraph-cleanroom',
  inspectEvidence = validEvidence,
} = {}) =>
  collectSuccessorTransitionErrors({
    state: currentState,
    packet: currentPacket,
    successor: nextPacket,
    manifest,
    branch,
    inspectEvidence,
  });

test('accepts a fully proved transition on the authorized predecessor branch', () => {
  assert.deepEqual(transitionErrors(), []);
});

test('rejects finish while the project or predecessor remains blocked', () => {
  const currentState = state();
  currentState.project_state = 'blocked';
  currentState.phase.state = 'blocked';
  currentState.blockers = ['operator input required'];
  const currentPacket = predecessor();
  currentPacket.status = 'blocked';
  currentPacket.handoff.blockers = ['operator input required'];

  const errors = transitionErrors({ currentState, currentPacket });
  assert.match(errors.join('\n'), /project must be active/);
  assert.match(errors.join('\n'), /project blockers must be cleared/);
  assert.match(errors.join('\n'), /predecessor blockers must be cleared/);
});

test('rejects missing, untracked, empty, and out-of-packet evidence', () => {
  const currentPacket = predecessor();
  currentPacket.completion.evidence_paths = ['evidence/fabricated.md'];
  const errors = transitionErrors({
    currentPacket,
    inspectEvidence: () => ({
      exists: false,
      regularFile: false,
      symbolicLink: false,
      size: 0,
      headContained: false,
      contentMatchesHead: false,
      sha256: null,
      headSha256: null,
      gitBlobOid: null,
    }),
  });
  assert.match(errors.join('\n'), /must be inside governance\/evidence\/WP-R0-001/);
  assert.match(errors.join('\n'), /does not exist|not committed in HEAD/);
});

test('rejects an unproved or incorrectly linked successor', () => {
  const nextPacket = successor();
  nextPacket.depends_on = [];
  nextPacket.status = 'in_progress';
  nextPacket.steps[0].status = 'current';
  nextPacket.acceptance.automated[0].status = 'passed';
  nextPacket.quality_gates[0].status = 'passed';

  const errors = transitionErrors({ nextPacket });
  assert.match(errors.join('\n'), /must depend on the predecessor/);
  assert.match(errors.join('\n'), /must initially be ready/);
  assert.match(errors.join('\n'), /steps must initially be pending/);
  assert.match(errors.join('\n'), /acceptance must initially be pending/);
  assert.match(errors.join('\n'), /quality gates must initially be pending/);
});

test('requires both transition packets to use the authorized predecessor branch', () => {
  const nextPacket = successor();
  nextPacket.branch = 'codex/different-branch';
  const errors = transitionErrors({
    nextPacket,
    branch: 'codex/unapproved-branch',
  });
  assert.match(errors.join('\n'), /does not match predecessor branch/);
  assert.match(errors.join('\n'), /must use the predecessor branch/);
});

test('closes the predecessor and creates a schema-valid completion receipt', () => {
  const closedPacket = closePredecessorPacket({
    packet: predecessor(),
    completedAt: '2026-07-12T12:34:56Z',
  });
  const receipt = createTransitionReceipt({
    closedPacket,
    successor: successor(),
    predecessorHead: 'a'.repeat(40),
    closedPacketPath: 'governance/evidence/WP-R0-001/completed-work-packet.yaml',
    evidenceEntries: [{ path: evidencePath, sha256: 'b'.repeat(64), git_blob_oid: 'c'.repeat(40) }],
  });

  assert.equal(closedPacket.status, 'complete');
  assert.ok(closedPacket.steps.every((step) => step.status === 'completed'));
  assert.equal(closedPacket.completion.completed_at, '2026-07-12T12:34:56Z');
  assert.deepEqual(
    validateSchema('governance/schemas/packet-transition-receipt.schema.json', receipt, 'receipt'),
    [],
  );
});

test('builds a coherent successor state and records real completion evidence', () => {
  const closedPacket = closePredecessorPacket({
    packet: predecessor(),
    completedAt: '2026-07-12T12:34:56Z',
  });
  const nextState = buildSuccessorState({
    state: state(),
    packet: closedPacket,
    successor: successor(),
    transitionedAt: '2026-07-12T12:34:56Z',
  });

  assert.equal(nextState.project_state, 'active');
  assert.equal(nextState.active_work_packet, 'WP-D0-001');
  assert.deepEqual(nextState.blockers, []);
  assert.deepEqual(nextState.decisions_pending, []);
  assert.deepEqual(nextState.phase, {
    id: 'D0',
    title: 'Design direction',
    state: 'planned',
  });
  assert.deepEqual(nextState.last_transition, {
    at: '2026-07-12T12:34:56Z',
    by: 'pnpm agent:finish',
    evidence: [evidencePath],
  });
});
