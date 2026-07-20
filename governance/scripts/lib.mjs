import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import fg from 'fast-glob';
import matter from 'gray-matter';
import micromatch from 'micromatch';
import YAML from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const testRepoRoot = process.env.MUSTBEVIRAL_TEST_REPO_ROOT;
if (testRepoRoot && process.env.NODE_ENV !== 'test') {
  throw new Error('MUSTBEVIRAL_TEST_REPO_ROOT is allowed only when NODE_ENV=test');
}
export const repoRoot = testRepoRoot ? path.resolve(testRepoRoot) : path.resolve(here, '../..');

export const toPosix = (value) => value.replaceAll('\\', '/');
export const fromRoot = (...parts) => path.join(repoRoot, ...parts);

export function readText(relativePath) {
  return readFileSync(fromRoot(relativePath), 'utf8');
}

export function readYaml(relativePath) {
  return YAML.parse(readText(relativePath));
}

export function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

export function writeAtomic(relativePath, content) {
  const destination = fromRoot(relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  writeFileSync(temporary, content, 'utf8');
  renameSync(temporary, destination);
}

export function validateSchema(schemaPath, data, label) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(readJson(schemaPath));
  if (validate(data)) return [];
  return (validate.errors ?? []).map(
    (error) => `${label}${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
  );
}

export function markdownFrontmatter(relativePath) {
  return matter(readText(relativePath));
}

export function listRepositoryFiles(patterns = ['**/*']) {
  return fg.sync(patterns, {
    cwd: repoRoot,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: false,
    ignore: ['.git/**', 'node_modules/**', '.pnpm-store/**'],
  });
}

export function currentBranch() {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

export function worktreeCount() {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return output.split(/\r?\n/).filter((line) => line.startsWith('worktree ')).length;
  } catch {
    return 0;
  }
}

export function changedPaths() {
  try {
    const output = execFileSync(
      'git',
      ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );
    const entries = output.split('\0').filter(Boolean);
    return [
      ...new Set(
        entries.map((entry) => {
          const raw = entry.slice(3);
          const destination = raw.includes(' -> ') ? raw.split(' -> ').at(-1) : raw;
          return toPosix(destination.replace(/^"|"$/g, ''));
        }),
      ),
    ].sort();
  } catch {
    return [];
  }
}

export function pathMatches(value, patterns) {
  return micromatch.isMatch(toPosix(value), patterns, { dot: true });
}

export function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: false,
    env: { ...process.env, ...options.env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function hasAbsolutePath(value) {
  if (typeof value === 'string') {
    return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\');
  }
  if (Array.isArray(value)) return value.some(hasAbsolutePath);
  if (value && typeof value === 'object') return Object.values(value).some(hasAbsolutePath);
  return false;
}

export function ensureFilesExist(paths) {
  return paths.filter((relativePath) => !existsSync(fromRoot(relativePath)));
}

export function fail(errors, heading = 'Validation failed') {
  if (!errors.length) return;
  console.error(`${heading}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}
