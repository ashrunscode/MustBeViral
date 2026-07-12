import { changedPaths, fail, pathMatches, readYaml } from './lib.mjs';

export function validateDiffScope() {
  const packet = readYaml('docs/delivery/ACTIVE_WORK_PACKET.yaml');
  const errors = [];
  for (const file of changedPaths()) {
    if (
      !pathMatches(file, packet.scope.allowed_paths) ||
      pathMatches(file, packet.scope.forbidden_paths)
    ) {
      errors.push(`changed path is outside ${packet.id}: ${file}`);
    }
  }
  fail(errors, 'Diff-scope validation failed');
  if (!errors.length) console.log(`Diff is contained by ${packet.id}.`);
  return errors;
}

if (process.argv[1]?.endsWith('validate-diff-scope.mjs')) validateDiffScope();
