import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { fail, listRepositoryFiles, repoRoot, toPosix, validateSchema } from './lib.mjs';

const DEFAULT_EVIDENCE_GLOB = 'governance/evidence/WP-*/design-direction.yaml';
const SCHEMA_PATH = 'governance/schemas/design-direction-evidence.schema.json';
const REQUIRED_FOCUSES = ['calm-density', 'canvas-legibility', 'review-approval-confidence'];
const REQUIRED_FLOWS = [
  'canvas-desktop',
  'campaign-brief',
  'quote-run',
  'output-comparison',
  'receipt',
  'tablet-review',
  'mobile-review',
];
const REQUIRED_WATCH_ITEMS = [
  '1440px inspector overflow',
  '12-node density proof',
  'quiet retry styling',
];
const SELECTION_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/;

function requireOptionValue(args, index) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${args[index]} requires a path`);
  return value;
}

export function parseArguments(args) {
  let evidencePath;
  let fileProvided = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--') continue;
    if (value === '--file') {
      if (fileProvided) throw new Error('--file may only be provided once');
      evidencePath = requireOptionValue(args, index);
      fileProvided = true;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return { evidencePath };
}

function absoluteEvidencePath(root, evidencePath) {
  return path.isAbsolute(evidencePath)
    ? path.resolve(evidencePath)
    : path.resolve(root, evidencePath);
}

function displayPath(root, evidencePath) {
  const absolutePath = absoluteEvidencePath(root, evidencePath);
  const relativePath = path.relative(root, absolutePath);
  if (relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return toPosix(relativePath);
  }
  return absolutePath;
}

function repositoryFileExists(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const absolutePath = path.resolve(resolvedRoot, relativePath);
  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) return false;
  try {
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

function isRenderedUrl(value) {
  return typeof value === 'string' && value.startsWith('https://');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && /\S/.test(value);
}

function collectUserSelectedApprovalErrors(approval, expectedSet) {
  if (approval?.state !== 'user_selected') return [];

  const errors = [];
  if (expectedSet && approval.approved_set !== expectedSet) {
    errors.push(`approval approved_set must equal ${expectedSet}`);
  }
  if (!isNonEmptyString(approval.selected_by)) {
    errors.push('approval selected_by must be a non-empty string');
  }
  if (typeof approval.selected_at !== 'string' || !SELECTION_TIMESTAMP.test(approval.selected_at)) {
    errors.push('approval selected_at must be an RFC 3339 timestamp with timezone');
  }
  if (approval.selection_source !== 'explicit_user_statement') {
    errors.push('approval selection_source must equal explicit_user_statement');
  }
  return errors;
}

function collectExplorationErrors({ evidence, root }) {
  const errors = collectUserSelectedApprovalErrors(evidence.approval);
  if (!Array.isArray(evidence.branches) || !evidence.initial_draft) return errors;

  const branchNames = evidence.branches.map((branch) => branch?.name);
  const duplicateNames = [
    ...new Set(branchNames.filter((name, index) => branchNames.indexOf(name) !== index)),
  ];
  for (const name of duplicateNames) errors.push(`branch name must be unique: ${name}`);

  for (const focus of REQUIRED_FOCUSES) {
    const count = evidence.branches.filter((branch) => branch?.focus === focus).length;
    if (count !== 1) errors.push(`branch focus ${focus} must appear exactly once (found ${count})`);
  }

  const expectedContentId = evidence.initial_draft.shared_content_id;
  for (const branch of evidence.branches) {
    if (branch?.shared_content_id !== expectedContentId) {
      errors.push(
        `shared_content_id must match initial_draft for branch ${branch?.name}: expected ${expectedContentId}`,
      );
    }
  }

  if (evidence.approval?.state === 'user_selected') {
    if (!branchNames.includes(evidence.approval.selected_branch)) {
      errors.push(
        `approval selected_branch does not name an evidence branch: ${evidence.approval.selected_branch}`,
      );
    }

    const renderEntries = [
      { label: 'initial_draft', value: evidence.initial_draft },
      ...evidence.branches.map((branch) => ({ label: `branch ${branch.name}`, value: branch })),
    ];
    for (const entry of renderEntries) {
      if (!repositoryFileExists(root, entry.value.desktop_capture)) {
        errors.push(
          `${entry.label} desktop_capture does not exist: ${entry.value.desktop_capture}`,
        );
      }
      if (
        !isRenderedUrl(entry.value.rendered_artifact) &&
        !repositoryFileExists(root, entry.value.rendered_artifact)
      ) {
        errors.push(
          `${entry.label} rendered_artifact does not exist: ${entry.value.rendered_artifact}`,
        );
      }
    }
  }

  return errors;
}

function collectHighFidelityErrors({ evidence, root }) {
  const errors = collectUserSelectedApprovalErrors(evidence.approval, 'high-fidelity-golden-set');

  if (Array.isArray(evidence.flows)) {
    const flowNames = evidence.flows.map((flow) => flow?.name);
    const duplicateNames = [
      ...new Set(flowNames.filter((name, index) => flowNames.indexOf(name) !== index)),
    ];
    for (const name of duplicateNames) errors.push(`flow name must be unique: ${name}`);

    for (const name of REQUIRED_FLOWS) {
      const count = flowNames.filter((flowName) => flowName === name).length;
      if (count !== 1) errors.push(`flow ${name} must appear exactly once (found ${count})`);
    }

    for (const flow of evidence.flows) {
      if (!repositoryFileExists(root, flow?.artifact)) {
        errors.push(`flow ${flow?.name} artifact does not exist: ${flow?.artifact}`);
      }
      const capture = flow?.desktop_capture ?? flow?.capture;
      if (!repositoryFileExists(root, capture)) {
        errors.push(`flow ${flow?.name} capture does not exist: ${capture}`);
      }
    }
  }

  if (Array.isArray(evidence.watch_item_resolutions)) {
    for (const watchItem of REQUIRED_WATCH_ITEMS) {
      const count = evidence.watch_item_resolutions.filter(
        (entry) => entry?.watch_item === watchItem,
      ).length;
      if (count !== 1) {
        errors.push(`watch item ${watchItem} must have exactly one resolution (found ${count})`);
      }
    }
  }

  return errors;
}

export function collectDesignDirectionErrors({ evidence, root = repoRoot }) {
  const errors = validateSchema(SCHEMA_PATH, evidence, 'design-direction evidence');
  if (evidence?.packet_id === 'WP-D0-001') {
    errors.push(...collectExplorationErrors({ evidence, root }));
  } else if (evidence?.packet_id === 'WP-D0-002') {
    errors.push(...collectHighFidelityErrors({ evidence, root }));
  }

  return errors;
}

function validateEvidenceFile(evidencePath) {
  const absolutePath = absoluteEvidencePath(repoRoot, evidencePath);
  const label = displayPath(repoRoot, evidencePath);
  if (!existsSync(absolutePath)) {
    return { errors: [`evidence file missing: ${label}`], label };
  }

  let evidence;
  try {
    evidence = YAML.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    return { errors: [`evidence file is not valid YAML: ${label}: ${error.message}`], label };
  }

  const errors = collectDesignDirectionErrors({ evidence });
  return { errors: errors.map((error) => `${label}: ${error}`), label };
}

export function validateDesignDirection({ evidencePath } = {}) {
  const evidencePaths = evidencePath
    ? [evidencePath]
    : listRepositoryFiles([DEFAULT_EVIDENCE_GLOB]).sort();

  if (!evidencePaths.length) {
    const errors = [`no evidence files found: ${DEFAULT_EVIDENCE_GLOB}`];
    fail(errors, 'Design-direction evidence validation failed');
    return errors;
  }

  const results = evidencePaths.map(validateEvidenceFile);
  const errors = results.flatMap((result) => result.errors);
  fail(errors, 'Design-direction evidence validation failed');
  for (const result of results) {
    if (!result.errors.length) console.log(`Design-direction evidence valid: ${result.label}.`);
  }
  return errors;
}

if (process.argv[1]?.endsWith('validate-design-direction.mjs')) {
  try {
    validateDesignDirection(parseArguments(process.argv.slice(2)));
  } catch (error) {
    fail([error.message], 'Design-direction evidence validation failed');
  }
}
