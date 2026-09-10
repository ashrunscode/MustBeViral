import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const LOCAL_SUPABASE_CONTAINER = 'supabase_db_mustbeviral';

const LOCAL_LOOPBACK_ROLE = 'postgres';
const LOCAL_LOOPBACK_HOST = '127.0.0.1';
const LOCAL_LOOPBACK_PORT = 54322;
const UNAVAILABLE = 'Local database credential is unavailable.';
const NOT_LOCAL = 'The verified MustBeViral local database is not running on port 54322.';

function repositoryRoot() {
  return fileURLToPath(new URL('../../../', import.meta.url));
}

function parseJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(UNAVAILABLE);
  return JSON.parse(text.slice(start, end + 1));
}

function loadStatusDefault() {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  try {
    return parseJsonObject(
      execFileSync(pnpmCommand, ['exec', 'supabase', 'status', '--output', 'json'], {
        cwd: repositoryRoot(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === UNAVAILABLE) throw error;
    throw new Error(UNAVAILABLE);
  }
}

function secretFromProcess(env) {
  const fromEnv = env.POSTGRES_PASSWORD ?? env.SUPABASE_DB_PASSWORD;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return undefined;
}

function credentialFromStatus(status) {
  if (status === null || typeof status !== 'object') throw new Error(UNAVAILABLE);
  const dbUrl = status.DB_URL;
  if (typeof dbUrl !== 'string' || dbUrl.length === 0) throw new Error(UNAVAILABLE);
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error(UNAVAILABLE);
  }
  if (parsed.hostname !== LOCAL_LOOPBACK_HOST || parsed.port !== String(LOCAL_LOOPBACK_PORT)) {
    throw new Error(NOT_LOCAL);
  }
  const secret = decodeURIComponent(parsed.password);
  if (secret.length === 0) throw new Error(UNAVAILABLE);
  const role = decodeURIComponent(parsed.username);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//u, ''));
  return {
    secret,
    role: role.length > 0 ? role : LOCAL_LOOPBACK_ROLE,
    database: database.length > 0 ? database : LOCAL_LOOPBACK_ROLE,
  };
}

function withOwn(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return target;
}

/** Resolve only this repository's running local database, never global/cloud credentials. */
export function localSupabaseDatabase({
  env = process.env,
  loadStatus = loadStatusDefault,
} = {}) {
  const fromEnv = secretFromProcess(env);
  const fromStatus = fromEnv === undefined ? credentialFromStatus(loadStatus()) : undefined;
  const secret = fromEnv ?? fromStatus.secret;
  const role =
    typeof env.POSTGRES_USER === 'string' && env.POSTGRES_USER.length > 0
      ? env.POSTGRES_USER
      : (fromStatus?.role ?? LOCAL_LOOPBACK_ROLE);
  const database = fromStatus?.database ?? LOCAL_LOOPBACK_ROLE;
  const connection = {
    host: LOCAL_LOOPBACK_HOST,
    port: LOCAL_LOOPBACK_PORT,
    database,
  };
  withOwn(connection, 'username', role);
  withOwn(connection, 'password', secret);
  return connection;
}
