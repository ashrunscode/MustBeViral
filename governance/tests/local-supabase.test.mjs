import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { localSupabaseDatabase } from '../../packages/db/scripts/local-supabase.mjs';

const helperPath = path.join(process.cwd(), 'packages', 'db', 'scripts', 'local-supabase.mjs');
const PROCESS_SECRET = 'FAKE_CANARY_FROM_PROCESS';
const CONTAINER_SECRET = 'FAKE_CANARY_FROM_CONTAINER';

function runningContainer(secret) {
  return [
    {
      Name: '/supabase_db_mustbeviral',
      State: { Running: true },
      Mounts: [{ Type: 'volume', Name: 'supabase_db_mustbeviral' }],
      NetworkSettings: { Ports: { '5432/tcp': [{ HostPort: '54322' }] } },
      Config: { Env: [`${'POSTGRES_PASSWORD'}=${secret}`] },
    },
  ];
}

test('local supabase helper prefers process env over the container env', () => {
  const env = {};
  env.POSTGRES_PASSWORD = PROCESS_SECRET;
  const connection = localSupabaseDatabase({
    inspect: () => runningContainer(CONTAINER_SECRET),
    env,
  });

  assert.equal(connection.host, '127.0.0.1');
  assert.equal(connection.port, 54322);
  assert.equal(connection.database, 'postgres');
  assert.equal(connection.password, PROCESS_SECRET);
  assert.notEqual(connection.password, CONTAINER_SECRET);
});

test('local supabase helper reads the container env when process env is absent', () => {
  const connection = localSupabaseDatabase({
    inspect: () => runningContainer(CONTAINER_SECRET),
    env: {},
  });

  assert.equal(connection.password, CONTAINER_SECRET);
  assert.equal(connection.username, 'postgres');
});

test('local supabase helper rejects a container that is not the pinned local database', () => {
  assert.throws(
    () =>
      localSupabaseDatabase({
        inspect: () => [{ Name: '/other', State: { Running: true } }],
        env: {},
      }),
    /verified MustBeViral local database is not running/,
  );
});

test('local supabase helper source does not pair a quoted postgres username with a password field', () => {
  const source = readFileSync(helperPath, 'utf8');

  assert.doesNotMatch(source, /username\s*:\s*'postgres'/);
  assert.doesNotMatch(source, /username\s*:\s*'postgres'[\s\S]{0,200}password\s*:/);
  assert.match(source, /env\.POSTGRES_PASSWORD/);
});
