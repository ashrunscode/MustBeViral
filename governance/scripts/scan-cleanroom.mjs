import path from 'node:path';

import {
  fail,
  listRepositoryFiles,
  listTrackedFiles,
  pathMatches,
  readText,
  readYaml,
} from './lib.mjs';

/**
 * Local secret files are skipped by `scan.ignored_paths` so a developer's real `.dev.vars` does not
 * break the scan. That skip is only safe while such a file is never committed: a tracked one would
 * be silently exempt from every secret pattern below. A file is therefore dangerous to track
 * precisely because the scanner skips it, so this guard is derived from the ignore list itself and
 * stays in lockstep with it. Env files that are NOT ignored (for example the deliberately tracked,
 * client-public `apps/web/.env.production`) keep receiving full content scanning and need no guard.
 * Template files carry no live credentials.
 */
const SECRET_BEARING_FILE = /(^|\/)\.(?:dev\.vars|env)(?:\.[^/]+)?$/u;
const TEMPLATE_SUFFIX = /\.(?:example|sample|template)$/u;

function trackedSecretFileErrors(ignored) {
  return listTrackedFiles()
    .filter(
      (file) =>
        SECRET_BEARING_FILE.test(file) && !TEMPLATE_SUFFIX.test(file) && pathMatches(file, ignored),
    )
    .map((file) => `scanner-skipped secret file must never be tracked: ${file}`);
}

export function scanCleanroom() {
  const policy = readYaml('governance/legacy-fingerprints.yaml');
  const files = listRepositoryFiles();
  const ignored = policy.scan.ignored_paths;
  const errors = trackedSecretFileErrors(ignored);
  const allowlisted = policy.scan.content_allowlist;
  const binary = new Set(policy.scan.binary_extensions.map((extension) => extension.toLowerCase()));

  for (const file of files) {
    if (pathMatches(file, ignored)) continue;
    if (file !== 'AGENTS.md' && path.basename(file).toLowerCase() === 'agents.md') {
      errors.push(`nested AGENTS.md is forbidden: ${file}`);
    }
    if (pathMatches(file, policy.forbidden_paths)) errors.push(`forbidden cleanroom path: ${file}`);
    if (pathMatches(file, allowlisted) || binary.has(path.extname(file).toLowerCase())) continue;
    const content = readText(file);
    for (const entry of policy.legacy_content_patterns) {
      if (new RegExp(entry.pattern, 'i').test(content))
        errors.push(`legacy fingerprint ${entry.id} in ${file}`);
    }
    for (const entry of policy.secret_patterns) {
      if (new RegExp(entry.pattern, 'm').test(content))
        errors.push(`secret fingerprint ${entry.id} in ${file}`);
    }
  }

  fail(errors, 'Cleanroom scan failed');
  if (!errors.length)
    console.log(`Cleanroom scan valid: ${files.length} repository files inspected.`);
  return errors;
}

if (process.argv[1]?.endsWith('scan-cleanroom.mjs')) scanCleanroom();
