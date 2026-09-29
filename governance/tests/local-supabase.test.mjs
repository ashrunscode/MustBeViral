import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { URL } from 'node:url';

import * as localSupabase from '../../packages/db/scripts/local-supabase.mjs';

const { localSupabaseDatabase } = localSupabase;

const helperPath = path.join(process.cwd(), 'packages', 'db', 'scripts', 'local-supabase.mjs');
const PROCESS_SECRET = 'FAKE_CANARY_FROM_PROCESS';
const STATUS_SECRET = 'FAKE_CANARY_FROM_STATUS';

function containerSnapshot(name, { port = '54322', running = true, project = 'mustbeviral' } = {}) {
  return {
    name: `/${name}`,
    running,
    labels: { 'com.supabase.cli.project': project, 'com.docker.compose.project': project },
    ports: {
      [name.includes('_kong_') ? '8000/tcp' : '5432/tcp']: [
        { HostIp: '0.0.0.0', HostPort: port },
        { HostIp: '::', HostPort: port },
      ],
    },
  };
}

const loadContainer = (name) => containerSnapshot(name);

function statusSnapshot(
  secret,
  { host = '127.0.0.1', port = '54322', role = 'local-operator' } = {},
) {
  const parsed = new URL('postgresql://127.0.0.1:54322/postgres');
  parsed.hostname = host;
  parsed.port = port;
  parsed.username = role;
  parsed.password = secret;
  return { DB_URL: parsed.href };
}

test('local supabase helper prefers process env over CLI status', () => {
  let statusCalls = 0;
  const env = {};
  env.POSTGRES_PASSWORD = PROCESS_SECRET;
  const connection = localSupabaseDatabase({
    loadContainer,
    loadStatus: () => {
      statusCalls += 1;
      return statusSnapshot(STATUS_SECRET);
    },
    env,
  });

  assert.equal(statusCalls, 0);
  assert.equal(connection.host, '127.0.0.1');
  assert.equal(connection.port, 54322);
  assert.equal(connection.database, 'postgres');
  assert.equal(connection.password, PROCESS_SECRET);
  assert.notEqual(connection.password, STATUS_SECRET);
});

test('local supabase helper reads CLI status when process env is absent', () => {
  const connection = localSupabaseDatabase({
    loadContainer,
    loadStatus: () => statusSnapshot(STATUS_SECRET),
    env: {},
  });

  assert.equal(connection.password, STATUS_SECRET);
  assert.equal(connection.username, 'local-operator');
  assert.equal(connection.host, '127.0.0.1');
  assert.equal(connection.port, 54322);
});

test('local supabase helper fails closed when CLI status has no local credential', () => {
  assert.throws(
    () =>
      localSupabaseDatabase({
        loadContainer,
        loadStatus: () => ({}),
        env: {},
      }),
    /Local database credential is unavailable/,
  );
});

test('local supabase helper rejects a CLI status URL that is not the pinned local database', () => {
  assert.throws(
    () =>
      localSupabaseDatabase({
        loadContainer,
        loadStatus: () => statusSnapshot(STATUS_SECRET, { host: 'example.test' }),
        env: {},
      }),
    /verified MustBeViral local/,
  );
});

test('local supabase helper follows the owned container alternate port, not a fixed default', () => {
  const connection = localSupabaseDatabase({
    env: {},
    loadStatus: () => statusSnapshot(STATUS_SECRET, { port: '56322' }),
    loadContainer: (name) => containerSnapshot(name, { port: '56322' }),
  });
  assert.equal(connection.port, 56322);
  assert.equal(connection.password, STATUS_SECRET);
});

test('process credentials still require a running container with both MustBeViral ownership labels', () => {
  for (const change of [
    { running: false },
    { project: 'another-project' },
    { port: '0' },
    { port: '65536' },
    { port: '56322oops' },
  ]) {
    assert.throws(
      () =>
        localSupabaseDatabase({
          env: { POSTGRES_PASSWORD: PROCESS_SECRET },
          loadContainer: (name) => containerSnapshot(name, change),
        }),
      /verified MustBeViral local/,
    );
  }
  for (const tamper of [
    (snapshot) => {
      snapshot.name = '/supabase_db_other';
    },
    (snapshot) => {
      delete snapshot.labels['com.supabase.cli.project'];
    },
    (snapshot) => {
      delete snapshot.labels['com.docker.compose.project'];
    },
    (snapshot) => {
      snapshot.ports['5432/tcp'][0].HostIp = '192.0.2.10';
    },
    (snapshot) => {
      snapshot.ports['5432/tcp'].push({ HostIp: '127.0.0.1', HostPort: '60000' });
    },
  ]) {
    assert.throws(
      () =>
        localSupabaseDatabase({
          env: { POSTGRES_PASSWORD: PROCESS_SECRET },
          loadContainer: (name) => {
            const snapshot = containerSnapshot(name);
            tamper(snapshot);
            return snapshot;
          },
        }),
      /verified MustBeViral local/,
    );
  }
});

test('CLI database status cannot target another local port, database, or protocol', () => {
  for (const change of [
    (url) => {
      url.port = '5432';
    },
    (url) => {
      url.pathname = '/other_database';
    },
    (url) => url.href.replace('postgresql:', 'https:'),
  ]) {
    const url = new URL(statusSnapshot(STATUS_SECRET).DB_URL);
    const changed = change(url) ?? url.href;
    assert.throws(
      () =>
        localSupabaseDatabase({ env: {}, loadContainer, loadStatus: () => ({ DB_URL: changed }) }),
      /verified MustBeViral local/,
    );
  }
});

function runtimeOptions() {
  return {
    env: {},
    loadContainer: (name) =>
      containerSnapshot(name, { port: name.includes('_kong_') ? '56321' : '56322' }),
    loadStatus: () => ({
      ...statusSnapshot(STATUS_SECRET, { port: '56322' }),
      API_URL: 'http://127.0.0.1:56321',
      ANON_KEY: 'FAKE_CANARY_ANON',
      SERVICE_ROLE_KEY: 'FAKE_CANARY_SERVICE_ROLE',
    }),
  };
}

test('local runtime verifies database and API against their independently owned container ports', () => {
  const runtime = localSupabase.localSupabaseRuntime(runtimeOptions());
  assert.equal(runtime.database.port, 56322);
  assert.equal(runtime.api.url, 'http://127.0.0.1:56321');
  assert.equal(runtime.api.anonKey, 'FAKE_CANARY_ANON');
  assert.equal(runtime.api.serviceRoleKey, 'FAKE_CANARY_SERVICE_ROLE');
});

test('local runtime refuses foreign, stopped, cloud, or misbound API credentials', () => {
  for (const apiUrl of [
    'https://example.test',
    'http://127.0.0.1:54321',
    'http://127.0.0.1:56321/path',
    'http://user@127.0.0.1:56321',
  ]) {
    const options = runtimeOptions();
    const status = options.loadStatus();
    options.loadStatus = () => ({ ...status, API_URL: apiUrl });
    assert.throws(() => localSupabase.localSupabaseRuntime(options), /verified MustBeViral local/);
  }
  for (const change of [{ project: 'other' }, { running: false }]) {
    const options = runtimeOptions();
    const owned = options.loadContainer;
    options.loadContainer = (name) =>
      name.includes('_kong_') ? containerSnapshot(name, { port: '56321', ...change }) : owned(name);
    assert.throws(() => localSupabase.localSupabaseRuntime(options), /verified MustBeViral local/);
  }
});

test('inspection and malformed status failures never expose provider output or credential values', () => {
  const sensitive = 'FAKE_CANARY_PRIVATE_DIAGNOSTIC';
  for (const options of [
    {
      loadContainer: () => {
        throw new Error(sensitive);
      },
    },
    {
      loadStatus: () => {
        throw new Error(sensitive);
      },
    },
    { loadStatus: () => ({ DB_URL: 'malformed%secret' }) },
  ]) {
    assert.throws(
      () =>
        localSupabaseDatabase({
          env: {},
          loadContainer,
          loadStatus: () => statusSnapshot(STATUS_SECRET),
          ...options,
        }),
      (error) =>
        error instanceof Error &&
        !error.message.includes(sensitive) &&
        !error.message.includes(STATUS_SECRET),
    );
  }
});

test('local supabase helper source does not pair a quoted postgres username with a password field', () => {
  const source = readFileSync(helperPath, 'utf8');

  assert.doesNotMatch(source, /username\s*:\s*'postgres'/);
  assert.doesNotMatch(source, /username\s*:\s*'postgres'[\s\S]{0,200}password\s*:/);
  assert.doesNotMatch(source, /postgres:\/\//);
  assert.doesNotMatch(source, /postgresql:\/\//);
  assert.match(source, /env\.POSTGRES_PASSWORD/);
  assert.match(source, /supabase/);
  assert.match(source, /--output/);
});
