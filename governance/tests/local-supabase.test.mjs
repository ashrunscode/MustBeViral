import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { localSupabaseDatabase } from '../../packages/db/scripts/local-supabase.mjs';

const helperPath = path.join(process.cwd(), 'packages', 'db', 'scripts', 'local-supabase.mjs');
const PROCESS_SECRET = 'FAKE_CANARY_FROM_PROCESS';
const STATUS_SECRET = 'FAKE_CANARY_FROM_STATUS';

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
        loadStatus: () => statusSnapshot(STATUS_SECRET, { host: 'example.test' }),
        env: {},
      }),
    /verified MustBeViral local database is not running/,
  );
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
