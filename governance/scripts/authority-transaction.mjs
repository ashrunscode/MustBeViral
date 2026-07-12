import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';

export const TRANSITION_JOURNAL = '.git/mustbeviral-agent-transition.json';
export const TRANSITION_LOCK = '.git/mustbeviral-agent-transition.lock';
export const TRANSITION_RECOVERY_CLAIM = '.git/mustbeviral-agent-recovery.lock';

function destinationFor(root, relativePath) {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    /^[A-Za-z]:[\\/]/.test(relativePath) ||
    relativePath.split(/[\\/]/).includes('..')
  ) {
    throw new Error(`unsafe authority path: ${relativePath}`);
  }
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.startsWith('.git/')) {
    const gitRelativePath = normalized.slice('.git/'.length);
    try {
      const commonMetadata =
        normalized === TRANSITION_LOCK || normalized === TRANSITION_RECOVERY_CLAIM;
      const arguments_ = commonMetadata
        ? ['rev-parse', '--git-common-dir']
        : ['rev-parse', '--git-path', gitRelativePath];
      const gitPath = execFileSync('git', arguments_, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      const resolved = commonMetadata ? path.join(gitPath, gitRelativePath) : gitPath;
      if (resolved) return path.resolve(root, resolved);
    } catch {
      // Unit fixtures need a deterministic fallback before they initialize Git.
    }
  }
  const resolvedRoot = path.resolve(root);
  const destination = path.resolve(resolvedRoot, relativePath);
  if (destination !== resolvedRoot && !destination.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`authority path leaves repository root: ${relativePath}`);
  }
  return destination;
}

function temporaryFor(root, relativePath, nonce) {
  return `${destinationFor(root, relativePath)}.tmp-${nonce}`;
}

function writeAtomicAt(root, relativePath, content, nonce = randomUUID()) {
  const destination = destinationFor(root, relativePath);
  if (existsSync(destination) && lstatSync(destination).isSymbolicLink()) {
    throw new Error(`authority destination cannot be a symbolic link: ${relativePath}`);
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = temporaryFor(root, relativePath, nonce);
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
    if (
      !write.expected ||
      typeof write.expected.existed !== 'boolean' ||
      (write.expected.existed && typeof write.expected.content !== 'string') ||
      (!write.expected.existed && write.expected.content !== null)
    ) {
      throw new Error(`authority write requires an exact expected original: ${write.path}`);
    }
    seen.add(write.path);
  }
}

export function hasAuthorityTransitionJournal(root) {
  return (
    existsSync(destinationFor(root, TRANSITION_JOURNAL)) ||
    existsSync(destinationFor(root, TRANSITION_LOCK)) ||
    existsSync(destinationFor(root, TRANSITION_RECOVERY_CLAIM))
  );
}

function transitionLock(root) {
  return destinationFor(root, TRANSITION_LOCK);
}

function ownedDirectoryMetadata(directory) {
  return path.join(directory, 'metadata.json');
}

function createOwnedDirectory(directory, metadata) {
  const preparation = `${directory}.prepare-${metadata.nonce}`;
  mkdirSync(preparation, { recursive: false });
  try {
    writeFileSync(ownedDirectoryMetadata(preparation), JSON.stringify(metadata), {
      encoding: 'utf8',
      flush: true,
    });
    renameSync(preparation, directory);
  } finally {
    rmSync(preparation, { recursive: true, force: true });
  }
}

function releaseTransitionLock(root) {
  rmSync(transitionLock(root), { recursive: true, force: true });
}

function acquireTransitionLock(root, context = {}) {
  const lockPath = transitionLock(root);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const lock = {
    schema_version: 1,
    nonce: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    created_at: new Date().toISOString(),
    context,
  };
  try {
    createOwnedDirectory(lockPath, lock);
  } catch (error) {
    if (existsSync(lockPath)) {
      throw new Error('an interrupted or concurrent authority transition requires recovery');
    }
    throw error;
  }
  return lock;
}

function snapshotAuthorityFile(root, relativePath) {
  const destination = destinationFor(root, relativePath);
  const existed = existsSync(destination);
  return {
    path: relativePath,
    existed,
    content: existed ? readFileSync(destination, 'utf8') : null,
  };
}

function assertExpectedOriginal(write, actual) {
  if (write.expected.existed !== actual.existed || write.expected.content !== actual.content) {
    throw new Error(`authority source changed after it was loaded: ${write.path}`);
  }
}

export function createAuthorityTransitionJournal({
  root,
  writes,
  allowedPath,
  assertInitialContext,
  assertExpectedContext,
  lockContext,
}) {
  validateWrites({ root, writes, allowedPath });
  const journalPath = destinationFor(root, TRANSITION_JOURNAL);
  const lock = acquireTransitionLock(root, lockContext);
  try {
    if (existsSync(journalPath)) {
      throw new Error('an interrupted authority transition requires recovery');
    }
    assertInitialContext?.();
    assertExpectedContext?.();
    const entries = writes.map((write) => {
      const actual = snapshotAuthorityFile(root, write.path);
      assertExpectedOriginal(write, actual);
      return { ...actual, intended_content: write.content };
    });
    const journal = {
      schema_version: 1,
      created_at: new Date().toISOString(),
      context: lock.context,
      entries,
    };
    const journalWithLock = { ...journal, lock_nonce: lock.nonce };
    writeAtomicAt(root, TRANSITION_JOURNAL, JSON.stringify(journalWithLock), lock.nonce);
    return journalWithLock;
  } catch (error) {
    releaseTransitionLock(root);
    throw error;
  }
}

export function applyAuthorityWrites({ root, writes, onAfterWrite, beforeWrite, nonce }) {
  for (const [index, write] of writes.entries()) {
    beforeWrite?.({ index, write });
    writeAtomicAt(root, write.path, write.content, nonce);
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
  if (
    journal.schema_version !== 1 ||
    typeof journal.lock_nonce !== 'string' ||
    !Array.isArray(journal.entries)
  ) {
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
    if (typeof entry.intended_content !== 'string') {
      throw new Error(`authority transition journal has invalid intended content: ${entry.path}`);
    }
  }
  return { journal, journalPath };
}

function runningProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readTransitionLock(root) {
  const lockPath = transitionLock(root);
  let lock;
  try {
    lock = JSON.parse(readFileSync(ownedDirectoryMetadata(lockPath), 'utf8'));
  } catch {
    throw new Error(`authority transition lock is unreadable: ${TRANSITION_LOCK}`);
  }
  if (lock.schema_version !== 1 || !Number.isInteger(lock.pid)) {
    throw new Error(`authority transition lock has an unsupported structure: ${TRANSITION_LOCK}`);
  }
  return lock;
}

function recoveryClaim(root) {
  return destinationFor(root, TRANSITION_RECOVERY_CLAIM);
}

function createRecoveryClaim(root) {
  const claimPath = recoveryClaim(root);
  mkdirSync(path.dirname(claimPath), { recursive: true });
  const claim = {
    schema_version: 1,
    nonce: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    created_at: new Date().toISOString(),
  };
  const writeClaim = () => createOwnedDirectory(claimPath, claim);
  try {
    writeClaim();
    return;
  } catch (error) {
    if (!existsSync(claimPath)) throw error;
  }

  let existing;
  try {
    existing = JSON.parse(readFileSync(ownedDirectoryMetadata(claimPath), 'utf8'));
  } catch {
    throw new Error(`authority recovery claim is unreadable: ${TRANSITION_RECOVERY_CLAIM}`);
  }
  if (
    existing.schema_version !== 1 ||
    !Number.isInteger(existing.pid) ||
    typeof existing.nonce !== 'string'
  ) {
    throw new Error(
      `authority recovery claim has an unsupported structure: ${TRANSITION_RECOVERY_CLAIM}`,
    );
  }
  if (existing.hostname && existing.hostname !== hostname()) {
    throw new Error(
      'authority recovery claim belongs to another host and requires operator review',
    );
  }
  if (runningProcess(existing.pid)) {
    throw new Error(`authority recovery process ${existing.pid} is still running`);
  }

  const staleClaim = `${claimPath}.stale-${randomUUID()}`;
  try {
    renameSync(claimPath, staleClaim);
  } catch {
    throw new Error('another authority recovery process claimed the interrupted transition');
  }
  try {
    writeClaim();
  } finally {
    rmSync(staleClaim, { recursive: true, force: true });
  }
}

function prepareManualRecovery(root) {
  const lockPath = transitionLock(root);
  if (!existsSync(lockPath)) {
    if (!existsSync(destinationFor(root, TRANSITION_JOURNAL))) {
      throw new Error('no interrupted authority transition exists');
    }
    return acquireTransitionLock(root, { operation: 'recovery' });
  }
  const lock = readTransitionLock(root);
  if (lock.pid !== process.pid && runningProcess(lock.pid)) {
    throw new Error(`authority transition process ${lock.pid} is still running`);
  }
  if (lock.hostname && lock.hostname !== hostname()) {
    throw new Error(
      'authority transition lock belongs to another host and requires operator review',
    );
  }
  return lock;
}

function matchesJournalState(entry, actual) {
  const matchesOriginal = entry.existed === actual.existed && entry.content === actual.content;
  const matchesIntended = actual.existed && actual.content === entry.intended_content;
  return matchesOriginal || matchesIntended;
}

function cleanupTransactionTemps(root, journal, nonce) {
  rmSync(temporaryFor(root, TRANSITION_JOURNAL, nonce), { force: true });
  for (const entry of journal?.entries ?? []) {
    rmSync(temporaryFor(root, entry.path, nonce), { force: true });
  }
}

export function recoverAuthorityTransition({
  root,
  allowedPath,
  validate,
  lockHeld = false,
  assertRecoveryContext,
}) {
  if (!lockHeld) createRecoveryClaim(root);
  try {
    const lock = lockHeld ? readTransitionLock(root) : prepareManualRecovery(root);
    const journalPath = destinationFor(root, TRANSITION_JOURNAL);
    if (!existsSync(journalPath)) {
      assertRecoveryContext?.(lock.context);
      cleanupTransactionTemps(root, null, lock.nonce);
      validate?.();
      releaseTransitionLock(root);
      return;
    }
    const { journal } = readJournal(root, allowedPath);
    if (lock.context?.operation !== 'recovery' && lock.nonce !== journal.lock_nonce) {
      throw new Error('authority transition lock does not own the rollback journal');
    }
    assertRecoveryContext?.(journal.context ?? lock.context);
    cleanupTransactionTemps(root, journal, journal.lock_nonce);
    const currentEntries = journal.entries.map((entry) => ({
      entry,
      actual: snapshotAuthorityFile(root, entry.path),
    }));
    const unknown = currentEntries.find(({ entry, actual }) => !matchesJournalState(entry, actual));
    if (unknown) {
      throw new Error(
        `authority file has an unknown third-party state; recovery refused: ${unknown.entry.path}`,
      );
    }
    for (const { entry } of currentEntries) {
      const current = snapshotAuthorityFile(root, entry.path);
      if (!matchesJournalState(entry, current)) {
        throw new Error(`authority file changed immediately before recovery: ${entry.path}`);
      }
      const destination = destinationFor(root, entry.path);
      if (entry.existed) writeAtomicAt(root, entry.path, entry.content, journal.lock_nonce);
      else rmSync(destination, { force: true });
    }
    validate?.();
    for (const { entry } of currentEntries) {
      const restored = snapshotAuthorityFile(root, entry.path);
      if (restored.existed !== entry.existed || restored.content !== entry.content) {
        throw new Error(`authority recovery changed before commit: ${entry.path}`);
      }
    }
    rmSync(journalPath, { force: true });
    releaseTransitionLock(root);
  } finally {
    if (!lockHeld) rmSync(recoveryClaim(root), { recursive: true, force: true });
  }
}

export function runAuthorityRead({ root, read, lockContext = {} }) {
  acquireTransitionLock(root, { ...lockContext, read_only: true });
  try {
    if (existsSync(destinationFor(root, TRANSITION_JOURNAL))) {
      throw new Error('an interrupted authority transition requires recovery');
    }
    return read();
  } finally {
    releaseTransitionLock(root);
  }
}

export function runAuthorityTransaction({
  root,
  writes,
  allowedPath,
  validate,
  onAfterWrite,
  assertInitialContext,
  assertExpectedContext,
  assertRecoveryContext,
  lockContext = {},
}) {
  const journal = createAuthorityTransitionJournal({
    root,
    writes,
    allowedPath,
    assertInitialContext,
    assertExpectedContext,
    lockContext,
  });
  try {
    applyAuthorityWrites({
      root,
      writes,
      onAfterWrite,
      beforeWrite: ({ write }) => {
        assertExpectedContext?.();
        assertExpectedOriginal(write, snapshotAuthorityFile(root, write.path));
      },
      nonce: journal.lock_nonce,
    });
    validate?.();
    assertExpectedContext?.();
    for (const write of writes) {
      const actual = snapshotAuthorityFile(root, write.path);
      if (!actual.existed || actual.content !== write.content) {
        throw new Error(`authority write changed before commit: ${write.path}`);
      }
    }
    rmSync(destinationFor(root, TRANSITION_JOURNAL), { force: true });
    releaseTransitionLock(root);
  } catch (error) {
    try {
      recoverAuthorityTransition({
        root,
        allowedPath,
        validate,
        lockHeld: true,
        assertRecoveryContext,
      });
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
