import { spawnSync } from 'node:child_process';
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageDirectory, '..', '..');
const outputPath = resolve(packageDirectory, 'src', 'database.generated.ts');
const temporaryPath = `${outputPath}.tmp`;
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const generated = spawnSync(
  pnpmCommand,
  ['exec', 'supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'public'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DO_NOT_TRACK: '1',
      SUPABASE_TELEMETRY_DISABLED: '1',
    },
  },
);

if (generated.status !== 0) {
  process.stderr.write(
    generated.error?.message ||
      generated.stderr ||
      generated.stdout ||
      'Supabase type generation failed.\n',
  );
  process.exit(generated.status ?? 1);
}

if (!generated.stdout.includes('export type Database')) {
  process.stderr.write('Supabase type generation returned an unexpected payload.\n');
  process.exit(1);
}

try {
  writeFileSync(temporaryPath, generated.stdout, 'utf8');
  renameSync(temporaryPath, outputPath);
} finally {
  rmSync(temporaryPath, { force: true });
}
