import { spawn } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

import { localSupabaseRuntime } from './local-supabase.mjs';

function requiredPath() {
  const value = process.env.PATH;
  if (!value) throw new Error('PATH is required to start local platform servers.');
  return value;
}

function localChildEnv(extra) {
  const allowed = [
    'SystemRoot',
    'WINDIR',
    'ComSpec',
    'PATHEXT',
    'USERPROFILE',
    'HOME',
    'APPDATA',
    'LOCALAPPDATA',
    'TEMP',
    'TMP',
    'ProgramFiles',
    'PROGRAMDATA',
    'ProgramW6432',
  ];
  const env = {
    PATH: requiredPath(),
    CI: 'true',
    WRANGLER_SEND_METRICS: 'false',
    DO_NOT_TRACK: '1',
  };
  for (const key of allowed) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return { ...env, ...extra };
}

const runtime = localSupabaseRuntime();
const root = fileURLToPath(new URL('../../../', import.meta.url));
const databaseUrl = new URL('postgres://127.0.0.1/postgres');
databaseUrl.port = String(runtime.database.port);
databaseUrl.username = runtime.database.username;
databaseUrl.password = runtime.database.password;
const coreVars = resolve(root, 'apps/core/.dev.vars.platform-local');
writeFileSync(
  coreVars,
  [
    'APP_ENV=development',
    `SUPABASE_URL=${runtime.api.url}`,
    `SUPABASE_PUBLISHABLE_KEY=${runtime.api.anonKey}`,
    'SUPABASE_JWT_AUDIENCE=authenticated',
    'CORS_ALLOWED_ORIGINS=http://127.0.0.1:3111',
    'PROVIDER_RUNS_ENABLED=false',
    'QUEUES_ENABLED=false',
  ].join('\n') + '\n',
);
const children = [];
function launch(cwd, args, extraEnv, logName) {
  const log = createWriteStream(resolve(root, 'packages/db', logName), { flags: 'w' });
  log.on('error', (error) => {
    process.stderr.write(`Local platform log stream failed: ${error.message}\n`);
  });
  const child = spawn('corepack.cmd', args, {
    cwd: resolve(root, cwd),
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: localChildEnv(extraEnv),
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on('error', (error) => {
    process.stderr.write(`${logName} failed to start: ${error.message}\n`);
  });
  child.on('exit', (code) => {
    if (code) process.stderr.write(`${logName} exited with code ${code}.\n`);
  });
  children.push(child);
}
launch(
  'apps/core',
  [
    'pnpm',
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    '8789',
    '--env-file',
    '.dev.vars.platform-local',
  ],
  { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl.href },
  'platform-local-core.log',
);
launch(
  'apps/web',
  ['pnpm', 'exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '3111'],
  {
    NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3111',
    NEXT_PUBLIC_SUPABASE_URL: runtime.api.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: runtime.api.anonKey,
    NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8789',
    MBV_LOCAL_GOLDEN_PREVIEW: '0',
    MBV_PLAYWRIGHT_DIST_DIR: '.next/platform-local',
  },
  'platform-local-web.log',
);

function stop() {
  for (const child of children) {
    if (child.exitCode === null && child.pid) child.kill();
  }
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

async function ready(url, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url, { method: 'GET' });
      if (response.ok || response.status === 404) return;
    } catch {
      // Retry until the child accepts local connections.
    }
    await delay(500);
  }
  throw new Error(`${label} did not become ready.`);
}

await ready('http://127.0.0.1:8789/health', 'Core');
await ready('http://127.0.0.1:3111/studio', 'Web');
process.stdout.write(
  'Local platform servers ready: web 127.0.0.1:3111, Core 127.0.0.1:8789. Provider runs and queues are disabled.\n',
);
await new Promise((done) => {
  for (const child of children) {
    child.on('exit', () => {
      if (children.every((item) => item.exitCode !== null)) done();
    });
  }
});
