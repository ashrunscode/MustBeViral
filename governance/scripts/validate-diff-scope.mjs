import { execFileSync } from 'node:child_process';

import YAML from 'yaml';

import { fail, pathMatches, repoRoot, toPosix } from './lib.mjs';

const PACKET_PATH = 'docs/delivery/ACTIVE_WORK_PACKET.yaml';

function git(args, action) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = error?.stderr?.trim() || error?.message || 'unknown Git error';
    throw new Error(`Unable to ${action}: ${detail}`);
  }
}

function requireOptionValue(args, index) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${args[index]} requires a commit SHA or ref`);
  }
  return value;
}

export function parseArguments(args) {
  let base;
  let head = 'HEAD';

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--') continue;
    if (value === '--base') {
      if (base) throw new Error('--base may only be provided once');
      base = requireOptionValue(args, index);
      index += 1;
      continue;
    }
    if (value === '--head') {
      head = requireOptionValue(args, index);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  if (!base) throw new Error('--base is required');
  return { base, head };
}

function resolveCommit(reference, label) {
  return git(
    ['rev-parse', '--verify', `${reference}^{commit}`],
    `resolve ${label} ${reference}`,
  ).trim();
}

export function isAuthorityTransitionPath(relativePath) {
  const normalized = toPosix(relativePath);
  return (
    normalized === 'PROJECT_STATE.yaml' ||
    normalized === PACKET_PATH ||
    /^governance\/evidence\/[A-Z0-9][A-Z0-9._-]+\/(?:transition-receipt|completed-work-packet)\.yaml$/.test(
      normalized,
    )
  );
}

export function collectDiffScopeErrors({ packet, changedFiles }) {
  const allowedPaths = packet?.scope?.allowed_paths;
  const forbiddenPaths = packet?.scope?.forbidden_paths;
  if (!packet?.id || !Array.isArray(allowedPaths) || !Array.isArray(forbiddenPaths)) {
    throw new Error(`Base packet at ${PACKET_PATH} has no valid id or scope path lists`);
  }

  const errors = [];
  for (const file of changedFiles) {
    if (isAuthorityTransitionPath(file)) continue;
    if (!pathMatches(file, allowedPaths) || pathMatches(file, forbiddenPaths)) {
      errors.push(`changed path is outside base packet ${packet.id}: ${file}`);
    }
  }
  return errors;
}

export function validateDiffScope({ base, head = 'HEAD' }) {
  if (!base) throw new Error('--base is required');

  const baseCommit = resolveCommit(base, 'base');
  const headCommit = resolveCommit(head, 'head');
  const mergeBase = git(
    ['merge-base', baseCommit, headCommit],
    `find the merge base of ${baseCommit} and ${headCommit}`,
  ).trim();
  if (!mergeBase) throw new Error('Git did not return a merge base');

  const packetText = git(
    ['show', `${mergeBase}:${PACKET_PATH}`],
    `read ${PACKET_PATH} from merge base ${mergeBase}`,
  );
  let packet;
  try {
    packet = YAML.parse(packetText);
  } catch (error) {
    throw new Error(
      `Unable to parse ${PACKET_PATH} from merge base ${mergeBase}: ${error.message}`,
    );
  }

  const diffOutput = git(
    ['diff', '--name-only', '-z', `${baseCommit}...${headCommit}`, '--'],
    `compute changed paths for ${baseCommit}...${headCommit}`,
  );
  const changedFiles = [...new Set(diffOutput.split('\0').filter(Boolean).map(toPosix))].sort();
  const errors = collectDiffScopeErrors({ packet, changedFiles });

  fail(errors, 'Diff-scope validation failed');
  if (!errors.length) {
    console.log(
      `Committed diff is contained by base packet ${packet.id} (${changedFiles.length} changed paths).`,
    );
  }
  return errors;
}

if (process.argv[1]?.endsWith('validate-diff-scope.mjs')) {
  try {
    validateDiffScope(parseArguments(process.argv.slice(2)));
  } catch (error) {
    fail([error.message], 'Diff-scope validation failed');
  }
}
