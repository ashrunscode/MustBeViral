import path from 'node:path';

import { fail, listRepositoryFiles, pathMatches, readText, readYaml } from './lib.mjs';

export function scanCleanroom() {
  const policy = readYaml('governance/legacy-fingerprints.yaml');
  const errors = [];
  const files = listRepositoryFiles();
  const ignored = policy.scan.ignored_paths;
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
