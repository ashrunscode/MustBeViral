import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { commandUsesShell, repoRoot, resolveCommandName } from './lib.mjs';

const shimDir = path.join(repoRoot, 'node_modules', '.cache', 'turbo-pnpm-shim');
mkdirSync(shimDir, { recursive: true });

spawnSync(resolveCommandName('corepack'), ['enable', '--install-directory', shimDir, 'pnpm'], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: 'pipe',
  shell: commandUsesShell('corepack'),
});

const executable = process.argv[2];
if (executable === undefined) {
  throw new Error('usage: with-pnpm-path.mjs <command> [args...]');
}

const args = process.argv.slice(3);
const env = {
  ...process.env,
  PATH: `${shimDir}${path.delimiter}${process.env.PATH ?? ''}`,
};

const result = spawnSync(executable, args, {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

process.exit(result.status ?? 1);
