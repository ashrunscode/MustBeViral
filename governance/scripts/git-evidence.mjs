import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function safePath(root, relativePath) {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    relativePath.split(/[\\/]/).includes('..')
  ) {
    throw new Error(`unsafe evidence path: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const absolutePath = path.resolve(resolvedRoot, relativePath);
  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`evidence path leaves repository root: ${relativePath}`);
  }
  return absolutePath;
}

export function inspectHeadEvidence({ root, relativePath, head = 'HEAD' }) {
  const absolutePath = safePath(root, relativePath);
  const normalized = relativePath.replaceAll('\\', '/');
  const exists = existsSync(absolutePath);
  const file = exists ? lstatSync(absolutePath) : null;
  let headContent = null;
  let gitBlobOid = null;
  try {
    headContent = execFileSync('git', ['show', `${head}:${normalized}`], {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    gitBlobOid = execFileSync('git', ['rev-parse', `${head}:${normalized}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    headContent = null;
    gitBlobOid = null;
  }
  const workingContent =
    exists && file.isFile() && !file.isSymbolicLink() ? readFileSync(absolutePath) : null;

  return {
    exists,
    regularFile: file?.isFile() ?? false,
    symbolicLink: file?.isSymbolicLink() ?? false,
    size: file?.size ?? 0,
    headContained: headContent !== null,
    contentMatchesHead:
      workingContent !== null && headContent !== null && workingContent.equals(headContent),
    sha256: workingContent === null ? null : sha256(workingContent),
    headSha256: headContent === null ? null : sha256(headContent),
    gitBlobOid,
  };
}

export function gitChangedPaths(root) {
  const output = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  });
  return [
    ...new Set(
      output
        .split('\0')
        .filter(Boolean)
        .map((entry) => {
          const raw = entry.slice(3);
          const destination = raw.includes(' -> ') ? raw.split(' -> ').at(-1) : raw;
          return destination.replace(/^"|"$/g, '').replaceAll('\\', '/');
        }),
    ),
  ].sort();
}

export function gitWorktreeFingerprint(root, { excludePaths = [] } = {}) {
  const fingerprint = createHash('sha256');
  const excluded = new Set(
    excludePaths.map((relativePath) => {
      safePath(root, relativePath);
      return relativePath.replaceAll('\\', '/');
    }),
  );
  const pathspecs = [
    '.',
    ...[...excluded].sort().map((relativePath) => `:(top,exclude,literal)${relativePath}`),
  ];
  const diff = execFileSync(
    'git',
    ['diff', '--binary', '--full-index', 'HEAD', '--', ...pathspecs],
    {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  fingerprint.update('tracked-diff\0').update(diff);

  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\0')
    .filter(Boolean)
    .filter((relativePath) => !excluded.has(relativePath.replaceAll('\\', '/')))
    .sort();
  for (const relativePath of untracked) {
    const absolutePath = safePath(root, relativePath);
    const file = lstatSync(absolutePath);
    fingerprint.update('untracked\0').update(relativePath).update('\0');
    if (file.isSymbolicLink()) {
      fingerprint.update('symlink\0').update(readlinkSync(absolutePath)).update('\0');
    } else if (file.isFile()) {
      fingerprint.update('file\0').update(readFileSync(absolutePath)).update('\0');
    } else {
      fingerprint.update(`other:${file.mode}\0`);
    }
  }
  return fingerprint.digest('hex');
}

export function sha256FileContent(content) {
  return sha256(content);
}
