import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

import { localSupabaseDatabase } from './local-supabase.mjs';
import { PLATFORM_KNOWLEDGE_FIXTURE_WORKER } from './platform-knowledge-fixture-worker.mjs';

const requireFromRoot = createRequire(new URL('../../../package.json', import.meta.url));
const wranglerRequire = createRequire(requireFromRoot.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');

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
if (
  status.API_URL !== 'http://127.0.0.1:54321' ||
  typeof status.ANON_KEY !== 'string' ||
  typeof status.SERVICE_ROLE_KEY !== 'string'
) {
  throw new Error('Expected local Supabase API and service role names are unavailable.');
}

const coreRoot = resolve(root, 'apps/core');
const localPersist = resolve(coreRoot, '.wrangler', 'knowledge-local');
const outdir = resolve(localPersist, 'core');
mkdirSync(outdir, { recursive: true });
execFileSync(
  'corepack.cmd',
  [
    'pnpm',
    'exec',
    'wrangler',
    'deploy',
    '--dry-run',
    '--outdir',
    outdir,
    '--x-provision=false',
    '--x-auto-create=false',
  ],
  {
    cwd: coreRoot,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: localChildEnv({}),
  },
);

const r2Persist = resolve(localPersist, 'r2');
mkdirSync(r2Persist, { recursive: true });
const mf = new Miniflare({
  host: '127.0.0.1',
  port: 8789,
  r2Persist,
  workers: [
    {
      name: 'mustbeviral-v2-development-core',
      modules: true,
      modulesRoot: outdir,
      scriptPath: resolve(outdir, 'index.js'),
      compatibilityDate: '2026-07-12',
      compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'],
      bindings: {
        APP_ENV: 'development',
        SERVICE_NAME: 'mustbeviral-core',
        SERVICE_GENERATION: 'viralgraph-cleanroom-v2',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
        SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY,
        SUPABASE_JWT_AUDIENCE: 'authenticated',
        CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3111',
        PROVIDER_RUNS_ENABLED: 'false',
        QUEUES_ENABLED: 'false',
      },
      r2Buckets: { MEDIA_BUCKET: 'mustbeviral-v2-development-media' },
      hyperdrives: {
        HYPERDRIVE: 'postgres://postgres:postgres@127.0.0.1:54322/postgres',
      },
      serviceBindings: {
        PUBLIC_EGRESS: 'source-fixture-egress',
      },
    },
    {
      name: 'source-fixture-egress',
      modules: true,
      compatibilityDate: '2026-07-12',
      script: PLATFORM_KNOWLEDGE_FIXTURE_WORKER,
      serviceBindings: {
        PUBLIC_NETWORK: {
          network: { allow: ['public'], tlsOptions: { trustBrowserCas: true } },
        },
      },
    },
  ],
});

const webLog = createWriteStream(resolve(root, 'packages/db', 'platform-knowledge-local-web.log'), {
  flags: 'w',
});
const web = spawn(
  'corepack.cmd',
  ['pnpm', 'exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '3111'],
  {
    cwd: resolve(root, 'apps/web'),
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: localChildEnv({
      NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3111',
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
      NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8789',
      MBV_LOCAL_GOLDEN_PREVIEW: '0',
      MBV_PLAYWRIGHT_DIST_DIR: '.next/platform-knowledge-local',
    }),
  },
);
web.stdout.pipe(webLog);
web.stderr.pipe(webLog);

function stopChild(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      child.kill();
    }
    return;
  }
  child.kill('SIGTERM');
}

async function stop() {
  stopChild(web);
  await mf.dispose().catch(() => {});
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

await mf.ready;
async function ready(url, label, identity) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url, { method: 'GET' });
      if (!identity) {
        if (response.ok || response.status === 404) return;
      } else if (response.ok) {
        const body = await response.json();
        if (body?.service === identity.service && body?.status === 'ok') return;
      }
    } catch {
      // Retry until the child accepts local connections.
    }
    await delay(500);
  }
  throw new Error(`${label} did not become ready.`);
}

await ready('http://127.0.0.1:8789/health', 'Core knowledge harness', {
  service: 'mustbeviral-core',
});
await ready('http://127.0.0.1:3111/studio', 'Web');
process.stdout.write(
  'Local knowledge servers ready: web 127.0.0.1:3111, Core 127.0.0.1:8789. PUBLIC_EGRESS is a test-only explicit-host fixture adapter over public-only network. Provider runs and queues are disabled.\n',
);
await new Promise((done) => {
  web.on('exit', done);
});
await stop();
