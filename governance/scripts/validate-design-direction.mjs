import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { fail, repoRoot, toPosix, validateSchema } from './lib.mjs';

const DEFAULT_EVIDENCE_PATH = 'governance/evidence/WP-D0-001/design-direction.yaml';
const SCHEMA_PATH = 'governance/schemas/design-direction-evidence.schema.json';
const REQUIRED_FOCUSES = ['calm-density', 'canvas-legibility', 'review-approval-confidence'];

function requireOptionValue(args, index) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${args[index]} requires a path`);
  return value;
}

export function parseArguments(args) {
  let evidencePath = DEFAULT_EVIDENCE_PATH;
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

export function collectDesignDirectionErrors({ evidence, root = repoRoot }) {
  const errors = validateSchema(SCHEMA_PATH, evidence, 'design-direction evidence');
  if (errors.length) return errors;

  const branchNames = evidence.branches.map((branch) => branch.name);
  const duplicateNames = [
    ...new Set(branchNames.filter((name, index) => branchNames.indexOf(name) !== index)),
  ];
  for (const name of duplicateNames) errors.push(`branch name must be unique: ${name}`);

  for (const focus of REQUIRED_FOCUSES) {
    const count = evidence.branches.filter((branch) => branch.focus === focus).length;
    if (count !== 1) errors.push(`branch focus ${focus} must appear exactly once (found ${count})`);
  }

  const expectedContentId = evidence.initial_draft.shared_content_id;
  for (const branch of evidence.branches) {
    if (branch.shared_content_id !== expectedContentId) {
      errors.push(
        `shared_content_id must match initial_draft for branch ${branch.name}: expected ${expectedContentId}`,
      );
    }
  }

  if (evidence.approval.state === 'user_selected') {
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

export function validateDesignDirection({ evidencePath = DEFAULT_EVIDENCE_PATH } = {}) {
  const absolutePath = absoluteEvidencePath(repoRoot, evidencePath);
  const label = displayPath(repoRoot, evidencePath);
  if (!existsSync(absolutePath)) {
    const errors = [`evidence file missing: ${label}`];
    fail(errors, 'Design-direction evidence validation failed');
    return errors;
  }

  let evidence;
  try {
    evidence = YAML.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    const errors = [`evidence file is not valid YAML: ${label}: ${error.message}`];
    fail(errors, 'Design-direction evidence validation failed');
    return errors;
  }

  const errors = collectDesignDirectionErrors({ evidence });
  fail(errors, 'Design-direction evidence validation failed');
  if (!errors.length) console.log(`Design-direction evidence valid: ${label}.`);
  return errors;
}

if (process.argv[1]?.endsWith('validate-design-direction.mjs')) {
  try {
    validateDesignDirection(parseArguments(process.argv.slice(2)));
  } catch (error) {
    fail([error.message], 'Design-direction evidence validation failed');
  }
}
