import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { inspectHeadEvidence } from './git-evidence.mjs';
import { fail, listRepositoryFiles, repoRoot, toPosix, validateSchema } from './lib.mjs';
import { canonicalPacketSha256, evidencePathsForPacket } from './packet-transition.mjs';

const TRANSITION_GENESIS_PACKET = 'WP-R0-002';

function absoluteAt(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const absolutePath = path.resolve(resolvedRoot, relativePath);
  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`transition receipt path leaves repository root: ${relativePath}`);
  }
  return absolutePath;
}

function readYamlAt(root, relativePath) {
  return YAML.parse(readFileSync(absoluteAt(root, relativePath), 'utf8'));
}

function commitExists(root, commit) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function sameValues(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function collectTransitionReceiptErrors({ root, receiptPath }) {
  const errors = [];
  let receipt;
  try {
    receipt = readYamlAt(root, receiptPath);
  } catch (error) {
    return [`${receiptPath} is not valid YAML: ${String(error)}`];
  }
  const schemaErrors = validateSchema(
    'governance/schemas/packet-transition-receipt.schema.json',
    receipt,
    receiptPath,
  );
  errors.push(...schemaErrors);
  if (schemaErrors.length) return errors;

  const packetDirectory = toPosix(receiptPath).split('/').at(-2);
  if (receipt.packet_id !== packetDirectory) {
    errors.push(`${receiptPath} packet_id does not match its evidence directory`);
  }
  if (!commitExists(root, receipt.predecessor_head)) {
    errors.push(`${receiptPath} predecessor_head is not available in Git history`);
  }
  const expectedSnapshotPath = `governance/evidence/${receipt.packet_id}/completed-work-packet.yaml`;
  if (receipt.closed_packet_path !== expectedSnapshotPath) {
    errors.push(`${receiptPath} closed_packet_path must be ${expectedSnapshotPath}`);
    return errors;
  }
  if (!existsSync(absoluteAt(root, receipt.closed_packet_path))) {
    errors.push(`${receiptPath} completed packet snapshot is missing`);
    return errors;
  }

  let closedPacket;
  try {
    closedPacket = readYamlAt(root, receipt.closed_packet_path);
  } catch (error) {
    errors.push(`${receipt.closed_packet_path} is not valid YAML: ${String(error)}`);
    return errors;
  }
  errors.push(
    ...validateSchema(
      'governance/schemas/work-packet.schema.json',
      closedPacket,
      receipt.closed_packet_path,
    ),
  );
  if (closedPacket.id !== receipt.packet_id || closedPacket.status !== 'complete') {
    errors.push(`${receiptPath} snapshot does not identify the completed predecessor`);
  }
  if (
    receipt.spec_revision !== closedPacket.spec_revision ||
    receipt.phase !== closedPacket.phase ||
    receipt.branch !== closedPacket.branch ||
    receipt.successor_packet_id !== closedPacket.completion?.successor_packet_id
  ) {
    errors.push(`${receiptPath} mirrored packet metadata differs from its snapshot`);
  }
  if (closedPacket.completion?.completed_at !== receipt.completed_at) {
    errors.push(`${receiptPath} completion time differs from its snapshot`);
  }
  if (canonicalPacketSha256(closedPacket) !== receipt.closed_packet_sha256) {
    errors.push(`${receiptPath} closed packet hash does not match its snapshot`);
  }
  const completedStepIds = closedPacket.steps?.map((step) => step.id) ?? [];
  if (
    closedPacket.steps?.some((step) => step.status !== 'completed') ||
    !sameValues(completedStepIds, receipt.completed_step_ids)
  ) {
    errors.push(`${receiptPath} completed steps do not match its snapshot`);
  }
  if (
    !sameValues(closedPacket.completion?.evidence_paths ?? [], receipt.completion_evidence_paths)
  ) {
    errors.push(`${receiptPath} completion evidence list differs from its snapshot`);
  }

  const expectedEvidencePaths = evidencePathsForPacket(closedPacket);
  const receiptEvidencePaths = receipt.evidence_entries.map((entry) => entry.path);
  if (!sameValues(expectedEvidencePaths, receiptEvidencePaths)) {
    errors.push(`${receiptPath} evidence entries do not cover the completed packet`);
  }
  for (const entry of receipt.evidence_entries) {
    const inspection = inspectHeadEvidence({
      root,
      relativePath: entry.path,
      head: receipt.predecessor_head,
    });
    if (!inspection.headContained || !inspection.contentMatchesHead) {
      errors.push(
        `${receiptPath} evidence is absent or changed from predecessor HEAD: ${entry.path}`,
      );
      continue;
    }
    if (inspection.headSha256 !== entry.sha256 || inspection.gitBlobOid !== entry.git_blob_oid) {
      errors.push(`${receiptPath} evidence identity does not match: ${entry.path}`);
    }
  }
  return errors;
}

export function collectReceiptChainErrors({
  activePacket,
  receipts,
  genesisPacket = TRANSITION_GENESIS_PACKET,
}) {
  const errors = [];
  const byPacket = new Map();
  const bySuccessor = new Map();
  for (const receipt of receipts) {
    if (byPacket.has(receipt.packet_id)) {
      errors.push(`duplicate transition receipt for packet ${receipt.packet_id}`);
    }
    byPacket.set(receipt.packet_id, receipt);
    const successors = bySuccessor.get(receipt.successor_packet_id) ?? [];
    successors.push(receipt);
    bySuccessor.set(receipt.successor_packet_id, successors);
  }
  for (const [successor, matches] of bySuccessor) {
    if (matches.length > 1) errors.push(`multiple transition receipts target ${successor}`);
  }

  if (activePacket.id === genesisPacket) {
    if (receipts.length) errors.push('transition receipts exist before the receipt-chain genesis');
    return errors;
  }

  const visited = new Set();
  let currentPacket = activePacket.id;
  let directDependency = true;
  while (currentPacket !== genesisPacket) {
    const candidates = bySuccessor.get(currentPacket) ?? [];
    if (candidates.length !== 1) {
      errors.push(`receipt chain has no unique predecessor for ${currentPacket}`);
      break;
    }
    const receipt = candidates[0];
    if (visited.has(receipt.packet_id)) {
      errors.push(`receipt chain contains a cycle at ${receipt.packet_id}`);
      break;
    }
    if (directDependency && !activePacket.depends_on?.includes(receipt.packet_id)) {
      errors.push(`active packet does not depend on receipt predecessor ${receipt.packet_id}`);
    }
    directDependency = false;
    visited.add(receipt.packet_id);
    currentPacket = receipt.packet_id;
  }
  if (visited.size !== receipts.length) {
    errors.push('transition receipt registry contains an orphan or broken branch');
  }
  return errors;
}

export function validateTransitionReceipts() {
  const receipts = listRepositoryFiles(['governance/evidence/**/transition-receipt.yaml']);
  const errors = receipts.flatMap((receiptPath) =>
    collectTransitionReceiptErrors({ root: repoRoot, receiptPath }),
  );
  const parsedReceipts = receipts.flatMap((receiptPath) => {
    try {
      return [readYamlAt(repoRoot, receiptPath)];
    } catch {
      return [];
    }
  });
  errors.push(
    ...collectReceiptChainErrors({
      activePacket: readYamlAt(repoRoot, 'docs/delivery/ACTIVE_WORK_PACKET.yaml'),
      receipts: parsedReceipts,
    }),
  );
  fail(errors, 'Packet-transition receipt validation failed');
  if (!errors.length) console.log(`Transition receipts valid: ${receipts.length} found.`);
  return errors;
}

if (process.argv[1]?.endsWith('validate-transition-receipts.mjs')) {
  validateTransitionReceipts();
}
