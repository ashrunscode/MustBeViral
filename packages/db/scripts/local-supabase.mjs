import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

export const LOCAL_SUPABASE_CONTAINER = 'supabase_db_mustbeviral';
const LOCAL_API_CONTAINER = 'supabase_kong_mustbeviral';
const LOCAL_PROJECT = 'mustbeviral';

const LOCAL_LOOPBACK_ROLE = 'postgres';
const LOCAL_LOOPBACK_HOST = '127.0.0.1';
const UNAVAILABLE = 'Local database credential is unavailable.';
const NOT_LOCAL = 'The verified MustBeViral local runtime identity or port mapping did not match.';

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
  const corepackCommand = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  try {
    return parseJsonObject(
      execFileSync(corepackCommand, ['pnpm', 'exec', 'supabase', 'status', '--output', 'json'], {
        cwd: repositoryRoot(),
        encoding: 'utf8',
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === UNAVAILABLE) throw error;
    throw new Error(UNAVAILABLE);
  }
}

function loadContainerDefault(name) {
  // Inspect only identity and published ports: Docker's full response includes environment secrets.
  const format =
    '{"name":{{json .Name}},"running":{{json .State.Running}},"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}}}';
  return JSON.parse(
    execFileSync('docker', ['inspect', name, '--format', format], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }),
  );
}

function ownedPort(loadContainer, name, internalPort) {
  let snapshot;
  try {
    snapshot = loadContainer(name);
  } catch {
    throw new Error(NOT_LOCAL);
  }
  if (
    snapshot?.name !== `/${name}` ||
    snapshot.running !== true ||
    snapshot.labels?.['com.supabase.cli.project'] !== LOCAL_PROJECT ||
    snapshot.labels?.['com.docker.compose.project'] !== LOCAL_PROJECT
  )
    throw new Error(NOT_LOCAL);
  const mappings = snapshot.ports?.[internalPort];
  if (!Array.isArray(mappings)) throw new Error(NOT_LOCAL);
  const ipv4 = mappings.filter(
    (mapping) => mapping.HostIp === '127.0.0.1' || mapping.HostIp === '0.0.0.0',
  );
  const ports = new Set(ipv4.map((mapping) => mapping.HostPort));
  if (ports.size !== 1) throw new Error(NOT_LOCAL);
  const [port] = ports;
  if (typeof port !== 'string' || !/^[1-9][0-9]{0,4}$/u.test(port) || Number(port) > 65535) {
    throw new Error(NOT_LOCAL);
  }
  return Number(port);
}

function readStatus(loadStatus) {
  try {
    return loadStatus();
  } catch {
    throw new Error(UNAVAILABLE);
  }
}

function secretFromProcess(env) {
  const fromEnv = env.POSTGRES_PASSWORD ?? env.SUPABASE_DB_PASSWORD;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return undefined;
}

function credentialFromStatus(status, port) {
  if (status === null || typeof status !== 'object') throw new Error(UNAVAILABLE);
  const dbUrl = status.DB_URL;
  if (typeof dbUrl !== 'string' || dbUrl.length === 0) throw new Error(UNAVAILABLE);
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error(UNAVAILABLE);
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    parsed.hostname !== LOCAL_LOOPBACK_HOST ||
    parsed.port !== String(port) ||
    parsed.pathname !== `/${LOCAL_LOOPBACK_ROLE}` ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(NOT_LOCAL);
  }
  let secret;
  let role;
  try {
    secret = decodeURIComponent(parsed.password);
    role = decodeURIComponent(parsed.username);
  } catch {
    throw new Error(UNAVAILABLE);
  }
  if (secret.length === 0) throw new Error(UNAVAILABLE);
  return {
    secret,
    role: role.length > 0 ? role : LOCAL_LOOPBACK_ROLE,
    database: LOCAL_LOOPBACK_ROLE,
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
  loadContainer = loadContainerDefault,
} = {}) {
  const port = ownedPort(loadContainer, LOCAL_SUPABASE_CONTAINER, '5432/tcp');
  const fromEnv = secretFromProcess(env);
  const fromStatus =
    fromEnv === undefined ? credentialFromStatus(readStatus(loadStatus), port) : undefined;
  const secret = fromEnv ?? fromStatus.secret;
  const role =
    typeof env.POSTGRES_USER === 'string' && env.POSTGRES_USER.length > 0
      ? env.POSTGRES_USER
      : (fromStatus?.role ?? LOCAL_LOOPBACK_ROLE);
  const database = fromStatus?.database ?? LOCAL_LOOPBACK_ROLE;
  const connection = {
    host: LOCAL_LOOPBACK_HOST,
    port,
    database,
  };
  withOwn(connection, 'username', role);
  withOwn(connection, 'password', secret);
  return connection;
}

/** Resolve credentials in memory only, after both database and API ownership checks. */
export function localSupabaseRuntime({
  env = process.env,
  loadStatus = loadStatusDefault,
  loadContainer = loadContainerDefault,
} = {}) {
  const port = ownedPort(loadContainer, LOCAL_SUPABASE_CONTAINER, '5432/tcp');
  const apiPort = ownedPort(loadContainer, LOCAL_API_CONTAINER, '8000/tcp');
  const status = readStatus(loadStatus);
  credentialFromStatus(status, port);
  const apiUrl = `http://${LOCAL_LOOPBACK_HOST}:${apiPort}`;
  if (status.API_URL !== apiUrl) throw new Error(NOT_LOCAL);
  if (
    typeof status.ANON_KEY !== 'string' ||
    !status.ANON_KEY ||
    typeof status.SERVICE_ROLE_KEY !== 'string' ||
    !status.SERVICE_ROLE_KEY
  )
    throw new Error(UNAVAILABLE);
  const database = localSupabaseDatabase({ env, loadContainer, loadStatus: () => status });
  return {
    database,
    api: { url: apiUrl, anonKey: status.ANON_KEY, serviceRoleKey: status.SERVICE_ROLE_KEY },
  };
}
