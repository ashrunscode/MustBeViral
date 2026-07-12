import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const TRANSITION_JOURNAL = '.git/mustbeviral-agent-transition.json';

function destinationFor(root, relativePath) {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    relativePath.split(/[\\/]/).includes('..')
  ) {
    throw new Error(`unsafe authority path: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const destination = path.resolve(resolvedRoot, relativePath);
  if (destination !== resolvedRoot && !destination.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`authority path leaves repository root: ${relativePath}`);
  }
  return destination;
}

function writeAtomicAt(root, relativePath, content) {
  const destination = destinationFor(root, relativePath);
  if (existsSync(destination) && lstatSync(destination).isSymbolicLink()) {
    throw new Error(`authority destination cannot be a symbolic link: ${relativePath}`);
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, content, { encoding: 'utf8', flush: true });
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function validateWrites({ root, writes, allowedPath }) {
  const seen = new Set();
  for (const write of writes) {
    const destination = destinationFor(root, write.path);
    if (existsSync(destination) && lstatSync(destination).isSymbolicLink()) {
      throw new Error(`authority destination cannot be a symbolic link: ${write.path}`);
    }
    if (seen.has(write.path)) throw new Error(`duplicate authority write: ${write.path}`);
    if (!allowedPath(write.path)) throw new Error(`authority write is not allowed: ${write.path}`);
    if (typeof write.content !== 'string') {
      throw new Error(`authority write content must be text: ${write.path}`);
    }
    seen.add(write.path);
  }
}

export function hasAuthorityTransitionJournal(root) {
  return existsSync(destinationFor(root, TRANSITION_JOURNAL));
}

export function createAuthorityTransitionJournal({ root, writes, allowedPath }) {
  validateWrites({ root, writes, allowedPath });
  const journalPath = destinationFor(root, TRANSITION_JOURNAL);
  mkdirSync(path.dirname(journalPath), { recursive: true });
  const journal = {
    schema_version: 1,
    created_at: new Date().toISOString(),
    entries: writes.map((write) => {
      const destination = destinationFor(root, write.path);
      const existed = existsSync(destination);
      return {
        path: write.path,
        existed,
        content: existed ? readFileSync(destination, 'utf8') : null,
      };
    }),
  };
  try {
    writeFileSync(journalPath, JSON.stringify(journal), {
      encoding: 'utf8',
      flag: 'wx',
      flush: true,
    });
  } catch (error) {
    if (existsSync(journalPath)) {
      throw new Error('an interrupted or concurrent authority transition requires recovery');
    }
    throw error;
  }
  return journal;
}

export function applyAuthorityWrites({ root, writes, onAfterWrite }) {
  for (const [index, write] of writes.entries()) {
    writeAtomicAt(root, write.path, write.content);
    onAfterWrite?.({ index, path: write.path });
  }
}

function readJournal(root, allowedPath) {
  const journalPath = destinationFor(root, TRANSITION_JOURNAL);
  if (!existsSync(journalPath)) throw new Error('no interrupted authority transition exists');
  let journal;
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  } catch {
    throw new Error(
      `authority transition journal is unreadable; source files were not trusted: ${TRANSITION_JOURNAL}`,
    );
  }
  if (journal.schema_version !== 1 || !Array.isArray(journal.entries)) {
    throw new Error('authority transition journal has an unsupported structure');
  }
  for (const entry of journal.entries) {
    destinationFor(root, entry.path);
    if (!allowedPath(entry.path)) {
      throw new Error(`authority transition journal contains a forbidden path: ${entry.path}`);
    }
    if (typeof entry.existed !== 'boolean') {
      throw new Error(`authority transition journal has invalid existence state: ${entry.path}`);
    }
    if (entry.existed && typeof entry.content !== 'string') {
      throw new Error(`authority transition journal has invalid original content: ${entry.path}`);
    }
  }
  return { journal, journalPath };
}

export function recoverAuthorityTransition({ root, allowedPath, validate }) {
  const { journal, journalPath } = readJournal(root, allowedPath);
  for (const entry of journal.entries) {
    const destination = destinationFor(root, entry.path);
    if (entry.existed) writeAtomicAt(root, entry.path, entry.content);
    else rmSync(destination, { force: true });
  }
  validate?.();
  rmSync(journalPath, { force: true });
}

export function runAuthorityTransaction({ root, writes, allowedPath, validate, onAfterWrite }) {
  createAuthorityTransitionJournal({ root, writes, allowedPath });
  try {
    applyAuthorityWrites({ root, writes, onAfterWrite });
    validate?.();
    rmSync(destinationFor(root, TRANSITION_JOURNAL), { force: true });
  } catch (error) {
    try {
      recoverAuthorityTransition({ root, allowedPath, validate });
    } catch (recoveryError) {
      throw new Error(
        `authority transition failed and automatic recovery failed; run pnpm agent:recover (${String(
          recoveryError,
        )})`,
        { cause: error },
      );
    }
    throw error;
  }
}
