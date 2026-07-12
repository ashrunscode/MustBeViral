import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

import { inspectHeadEvidence } from '../scripts/git-evidence.mjs';
import { createTransitionReceipt } from '../scripts/packet-transition.mjs';
import {
  collectReceiptChainErrors,
  collectTransitionReceiptErrors,
} from '../scripts/validate-transition-receipts.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function completedPacket(evidencePath) {
  return {
    schema_version: 1,
    id: 'WP-R0-009',
    spec_revision: 1,
    title: 'Completed packet fixture',
    phase: 'R0',
    status: 'complete',
    priority: 'critical',
    branch: 'codex/viralgraph-cleanroom',
    objective: 'Prove transition receipt integrity.',
    authority_refs: ['product-contract'],
    required_skills: [],
    depends_on: [],
    scope: {
      allowed_paths: ['governance/**', 'PROJECT_STATE.yaml', 'docs/delivery/**'],
      forbidden_paths: ['docs/archive/**'],
      required_doc_ids: ['product-contract'],
    },
    deliverables: ['Verified receipt'],
    public_interfaces: [],
    steps: [{ id: 'proof', title: 'Prove receipt', status: 'completed' }],
    acceptance: {
      automated: [
        {
          id: 'proof',
          criterion: 'Evidence is committed.',
          status: 'passed',
          evidence: [evidencePath],
        },
      ],
      manual: [],
    },
    quality_gates: [
      {
        id: 'verify',
        command: 'pnpm verify',
        status: 'passed',
        evidence: [evidencePath],
      },
    ],
    rollback: { strategy: 'Revert fixture.', remote_actions_required: false },
    external_effects: { remote_mutation: 'none', destructive_remote_actions: false },
    handoff: {
      current_step: 'proof',
      next_action: 'Activate successor.',
      blockers: [],
      changed_paths: ['governance/**'],
      last_green_checks: ['pnpm verify'],
    },
    completion: {
      successor_packet_id: 'WP-D0-009',
      evidence_paths: [evidencePath],
      completed_at: '2026-07-12T12:34:56Z',
    },
  };
}

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-receipt-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'tests@mustbeviral.invalid']);
  git(root, ['config', 'user.name', 'MustBeViral Tests']);
  const evidencePath = 'governance/evidence/WP-R0-009/proof.md';
  const packetDirectory = path.join(root, 'governance', 'evidence', 'WP-R0-009');
  mkdirSync(packetDirectory, { recursive: true });
  writeFileSync(path.join(root, evidencePath), 'immutable proof\n', 'utf8');
  git(root, ['add', '--', evidencePath]);
  git(root, ['commit', '--quiet', '-m', 'commit evidence']);
  const predecessorHead = git(root, ['rev-parse', 'HEAD']);
  const inspection = inspectHeadEvidence({ root, relativePath: evidencePath });
  const closedPacket = completedPacket(evidencePath);
  const closedPacketPath = 'governance/evidence/WP-R0-009/completed-work-packet.yaml';
  const receiptPath = 'governance/evidence/WP-R0-009/transition-receipt.yaml';
  const receipt = createTransitionReceipt({
    closedPacket,
    successor: { id: 'WP-D0-009' },
    predecessorHead,
    closedPacketPath,
    evidenceEntries: [
      {
        path: evidencePath,
        sha256: inspection.sha256,
        git_blob_oid: inspection.gitBlobOid,
      },
    ],
  });
  writeFileSync(path.join(root, closedPacketPath), YAML.stringify(closedPacket), 'utf8');
  writeFileSync(path.join(root, receiptPath), YAML.stringify(receipt), 'utf8');
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });
  return {
    root,
    evidencePath,
    closedPacketPath,
    receiptPath,
    closedPacket,
    receipt,
  };
}

test('verifies a completed snapshot, receipt hash, and predecessor evidence blobs', (t) => {
  const { root, receiptPath } = fixture(t);
  assert.deepEqual(collectTransitionReceiptErrors({ root, receiptPath }), []);
});

test('rejects tampered packet hashes and completed step claims', (t) => {
  const { root, receiptPath, receipt } = fixture(t);
  const tampered = {
    ...receipt,
    spec_revision: 2,
    phase: 'D0',
    branch: 'codex/tampered-branch',
    successor_packet_id: 'WP-D0-999',
    closed_packet_sha256: '0'.repeat(64),
    completed_step_ids: ['not-the-real-step'],
  };
  writeFileSync(path.join(root, receiptPath), YAML.stringify(tampered), 'utf8');
  const errors = collectTransitionReceiptErrors({ root, receiptPath });
  assert.match(errors.join('\n'), /closed packet hash/);
  assert.match(errors.join('\n'), /completed steps/);
  assert.match(errors.join('\n'), /mirrored packet metadata/);
});

test('requires one continuous receipt chain from the active packet to R0 genesis', () => {
  const activePacket = { id: 'WP-D0-002', depends_on: ['WP-D0-001'] };
  const receipts = [
    { packet_id: 'WP-R0-002', successor_packet_id: 'WP-D0-001' },
    { packet_id: 'WP-D0-001', successor_packet_id: 'WP-D0-002' },
  ];
  assert.deepEqual(collectReceiptChainErrors({ activePacket, receipts }), []);

  const deletedGenesisReceipt = receipts.slice(1);
  assert.match(
    collectReceiptChainErrors({ activePacket, receipts: deletedGenesisReceipt }).join('\n'),
    /no unique predecessor for WP-D0-001/,
  );

  const duplicateTarget = [
    ...receipts,
    { packet_id: 'WP-D0-000', successor_packet_id: 'WP-D0-002' },
  ];
  assert.match(
    collectReceiptChainErrors({ activePacket, receipts: duplicateTarget }).join('\n'),
    /multiple transition receipts target WP-D0-002/,
  );
});

test('rejects evidence changed after the recorded predecessor commit', (t) => {
  const { root, receiptPath, evidencePath } = fixture(t);
  writeFileSync(path.join(root, evidencePath), 'changed proof\n', 'utf8');
  assert.match(
    collectTransitionReceiptErrors({ root, receiptPath }).join('\n'),
    /evidence is absent or changed from predecessor HEAD/,
  );
});
