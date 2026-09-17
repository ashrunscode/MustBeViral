import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

import { localSupabaseDatabase } from './local-supabase.mjs';

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

function parseJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start)
    throw new Error('Expected local Supabase status JSON is unavailable.');
  return JSON.parse(text.slice(start, end + 1));
}

localSupabaseDatabase();
const root = fileURLToPath(new URL('../../../', import.meta.url));
const status = parseJsonObject(
  execFileSync('corepack.cmd', ['pnpm', 'exec', 'supabase', 'status', '--output', 'json'], {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: localChildEnv({}),
  }),
);
if (status.API_URL !== 'http://127.0.0.1:54321' || typeof status.ANON_KEY !== 'string') {
  throw new Error('Expected local Supabase API is unavailable.');
}
const coreVars = resolve(root, 'apps/core/.dev.vars.platform-local');
writeFileSync(
  coreVars,
  [
    'APP_ENV=development',
    'SUPABASE_URL=http://127.0.0.1:54321',
    `SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}`,
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
  {},
  'platform-local-core.log',
);
launch(
  'apps/web',
  ['pnpm', 'exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '3111'],
  {
    NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3111',
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
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
