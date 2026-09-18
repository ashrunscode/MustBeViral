import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';

import { localSupabaseDatabase, LOCAL_SUPABASE_CONTAINER } from './local-supabase.mjs';

const connection = localSupabaseDatabase();
const name = `mbv_platform_w1_${randomUUID().replaceAll('-', '')}`;
assert.match(name, /^mbv_platform_w1_[a-f0-9]{32}$/u);
const options = {
  max: 1,
  connect_timeout: 5,
  idle_timeout: 5,
  onnotice: () => {},
  connection: { statement_timeout: 15000 },
};
const admin = postgres({ ...connection, ...options });
const sessions = [];
let created = false;
let stage = 'create isolated local database';
const results = [];

async function userTransaction(sql, user, action) {
  return sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub',${user},true)`;
    return action(tx);
  });
}
async function command(tx, operation, input, key = randomUUID()) {
  const [row] =
    await tx`select public.platform_command(${operation},${tx.json(input)},${key},'connected-platform-check') as result`;
  return row.result.record;
}
async function waitUntilBlocked(pid) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const [row] = await admin`select wait_event_type from pg_stat_activity where pid=${pid}`;
    if (row?.wait_event_type === 'Lock') return;
    await delay(25);
  }
  throw new Error('The concurrent edit did not reach the expected database lock.');
}

try {
  // Schema only: no customer or source fixture data are copied. This database belongs solely to this run.
  await admin.unsafe(`create database "${name}" template template0`);
  created = true;
  stage = 'copy schema only';
  const schema = execFileSync(
    'docker',
    [
      'exec',
      LOCAL_SUPABASE_CONTAINER,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--schema-only',
      '--schema=public',
      '--schema=auth',
      '--schema=app_private',
      '--schema=extensions',
      '--extension=pgcrypto',
      '--extension=uuid-ossp',
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      LOCAL_SUPABASE_CONTAINER,
      'psql',
      '-U',
      'supabase_admin',
      '-d',
      name,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: (schema.includes('CREATE SCHEMA public;') ? 'drop schema public;\n' : '') + schema,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  stage = 'seed synthetic two-brand operations';
  const sql = postgres({ ...connection, database: name, ...options });
  const other = postgres({ ...connection, database: name, ...options });
  sessions.push(sql, other);
  const owner = randomUUID();
  const editor = randomUUID();
  await sql`insert into auth.users(id,aud,role,email) values (${owner},'authenticated','authenticated','owner@synthetic.example.test'),(${editor},'authenticated','authenticated','editor@synthetic.example.test')`;
  const seed = await userTransaction(sql, owner, async (tx) => {
    const [{ result: workspace }] =
      await tx`select public.create_workspace('WashBodega synthetic','connected-wb','workspace-wb','connected-request') as result`;
    const [{ result: second }] =
      await tx`select public.create_workspace('UnPile synthetic','connected-up','workspace-up','connected-request') as result`;
    const studio = await command(tx, 'create_studio', {
      name: 'Synthetic operating studio',
      slug: 'connected-studio',
    });
    const wb = await command(tx, 'create_brand', {
      workspace_id: workspace.workspace_id,
      name: 'WashBodega',
      slug: 'washbodega',
    });
    const up = await command(tx, 'create_brand', {
      workspace_id: second.workspace_id,
      name: 'UnPile',
      slug: 'unpile',
    });
    const location = await command(tx, 'create_brand_location', {
      workspace_id: wb.workspace_id,
      brand_id: wb.id,
      name: 'Synthetic location',
      slug: 'synthetic-location',
      time_zone: 'America/Chicago',
    });
    await command(tx, 'set_studio_member', {
      studio_id: studio.id,
      user_id: editor,
      role: 'editor',
      expected_version: 1,
    });
    const grant = await command(tx, 'grant_workspace_access', {
      workspace_id: wb.workspace_id,
      studio_id: studio.id,
      brand_id: wb.id,
      actions: ['brand:read', 'brand:write', 'location:read', 'location:write'],
    });
    return { studio, wb, up, location, grant };
  });
  // Reconnect with a distinct connection and assert committed, authoritative tenant state.
  await userTransaction(other, owner, async (tx) => {
    for (const brand of [seed.wb, seed.up]) {
      const [{ result }] =
        await tx`select public.platform_query('get_brand',${tx.json({ workspace_id: brand.workspace_id, brand_id: brand.id })}) as result`;
      assert.equal(result.record.name, brand.name);
    }
  });
  results.push('two-brand durable reconnect: passed');
  stage = 'revoke an in-flight edit';

  const [{ pid }] = await other`select pg_backend_pid() as pid`;
  let waiting;
  await userTransaction(sql, owner, async (tx) => {
    await command(tx, 'revoke_workspace_access', {
      workspace_id: seed.wb.workspace_id,
      grant_id: seed.grant.id,
      expected_version: 1,
    });
    waiting = userTransaction(other, editor, (edit) =>
      command(
        edit,
        'update_brand',
        {
          workspace_id: seed.wb.workspace_id,
          brand_id: seed.wb.id,
          name: 'Must never commit',
          slug: 'washbodega',
          expected_version: 1,
        },
        'in-flight-edit',
      ),
    ).then(
      () => ({ code: 'UNEXPECTED_SUCCESS' }),
      (error) => ({ code: error.message }),
    );
    await waitUntilBlocked(pid);
  });
  assert.deepEqual(await waiting, { code: 'NOT_FOUND' });
  const [unchanged] = await sql`select name,version from public.brands where id=${seed.wb.id}`;
  assert.deepEqual({ ...unchanged }, { name: 'WashBodega', version: 1 });
  results.push('grant revoked while edit waits: denied after lock release; brand unchanged');
  stage = 'revoke studio membership during an edit';
  const freshGrant = await userTransaction(sql, owner, (tx) =>
    command(tx, 'grant_workspace_access', {
      workspace_id: seed.wb.workspace_id,
      studio_id: seed.studio.id,
      brand_id: seed.wb.id,
      actions: ['brand:read', 'brand:write'],
    }),
  );
  const editInput = {
    workspace_id: seed.wb.workspace_id,
    brand_id: seed.wb.id,
    name: 'Must never commit',
    slug: 'washbodega',
    expected_version: 1,
  };
  await userTransaction(sql, owner, async (tx) => {
    await command(tx, 'revoke_studio_member', {
      studio_id: seed.studio.id,
      user_id: editor,
      expected_version: 2,
    });
    waiting = userTransaction(other, editor, (edit) =>
      command(edit, 'update_brand', editInput, 'member-in-flight'),
    ).then(
      () => ({ code: 'UNEXPECTED_SUCCESS' }),
      (error) => ({ code: error.message }),
    );
    await waitUntilBlocked(pid);
  });
  assert.deepEqual(await waiting, { code: 'NOT_FOUND' });
  results.push('studio membership revoked while edit waits: denied after lock release');
  await userTransaction(sql, owner, (tx) =>
    command(tx, 'set_studio_member', {
      studio_id: seed.studio.id,
      user_id: editor,
      role: 'editor',
      expected_version: 3,
    }),
  );
  stage = 'workspace owner revoked during an edit';
  await sql.begin(async (tx) => {
    await tx`update public.workspace_memberships set status='revoked',revoked_at=statement_timestamp() where workspace_id=${seed.wb.workspace_id} and user_id=${owner}`;
    waiting = userTransaction(other, editor, (edit) =>
      command(edit, 'update_brand', editInput, 'owner-in-flight'),
    ).then(
      () => ({ code: 'UNEXPECTED_SUCCESS' }),
      (error) => ({ code: error.message }),
    );
    await waitUntilBlocked(pid);
  });
  assert.deepEqual(await waiting, { code: 'NOT_FOUND' });
  await sql`update public.workspace_memberships set status='active',revoked_at=null where workspace_id=${seed.wb.workspace_id} and user_id=${owner}`;
  const [revoked] =
    await sql`select status from public.workspace_access_grants where id=${freshGrant.id}`;
  assert.equal(revoked.status, 'revoked');
  results.push(
    'owner revoked during edit: denied; restoring membership does not revive its old grant',
  );
  stage = 'concurrent slug collision';

  const slugInput = {
    workspace_id: seed.up.workspace_id,
    name: 'Collision fixture',
    slug: 'collision',
  };
  const collided = await Promise.allSettled([
    userTransaction(sql, owner, (tx) => command(tx, 'create_brand', slugInput, 'collision-a')),
    userTransaction(other, owner, (tx) => command(tx, 'create_brand', slugInput, 'collision-b')),
  ]);
  assert.equal(collided.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    collided.find((result) => result.status === 'rejected')?.reason.message,
    'RESOURCE_CONFLICT',
  );
  results.push('concurrent same slug: one record and one explicit conflict');
  stage = 'concurrent idempotent replay';

  const replayInput = {
    workspace_id: seed.up.workspace_id,
    name: 'Replay fixture',
    slug: 'replay',
  };
  const replayed = await Promise.all([
    userTransaction(sql, owner, (tx) => command(tx, 'create_brand', replayInput, 'shared-replay')),
    userTransaction(other, owner, (tx) =>
      command(tx, 'create_brand', replayInput, 'shared-replay'),
    ),
  ]);
  assert.equal(replayed[0].id, replayed[1].id);
  results.push('concurrent same idempotency key: both callers receive one committed identity');
  stage = 'old application and explicit backfill';

  // Old application uses the existing RPC and project table; no platform handlers are required.
  await userTransaction(sql, owner, async (tx) => {
    const [row] =
      await tx`select public.create_workspace('Old application synthetic','old-application','old-application-key','connected-old-request') as result`;
    await tx`insert into public.projects(workspace_id,name,created_by) values(${row.result.workspace_id},'Old campaign',${owner})`;
  });
  const [legacy] = await sql`select id from public.workspaces where slug='old-application'`;
  const transactionId = randomUUID();
  await sql.begin(async (tx) => {
    await tx`insert into public.ledger_transactions(workspace_id,transaction_id,entry_type,account_code,direction,amount_micros,causative_key)
      values(${legacy.id},${transactionId},'credit','wallet_available','credit',2500000,'synthetic-funding'),
      (${legacy.id},${transactionId},'credit','funding_clearing','debit',2500000,'synthetic-funding')`;
  });
  const [before] = await sql`select count(*)::integer as rows,
    coalesce(sum(case direction when 'credit' then amount_micros else -amount_micros end),0)::text as balance,
    coalesce(sum(amount_micros) filter(where account_code='wallet_available'),0)::text as wallet from public.ledger_transactions`;
  assert.equal(before.wallet, '2500000');
  const [mapped] =
    await sql`select app_private.backfill_platform_identity(array[${legacy.id}::uuid]) as result`;
  assert.equal(mapped.result.workspaces_created, 1);
  assert.equal(mapped.result.projects_mapped, 1);
  const [rerun] =
    await sql`select app_private.backfill_platform_identity(array[${legacy.id}::uuid]) as result`;
  assert.equal(rerun.result.workspaces_created, 0);
  assert.equal(rerun.result.projects_mapped, 0);
  const [after] = await sql`select count(*)::integer as rows,
    coalesce(sum(case direction when 'credit' then amount_micros else -amount_micros end),0)::text as balance,
    coalesce(sum(amount_micros) filter(where account_code='wallet_available'),0)::text as wallet from public.ledger_transactions`;
  assert.deepEqual({ ...after }, { ...before });
  results.push(
    'old application plus explicit project backfill: preserved; rerun maps zero; ledger unchanged',
  );
  for (const result of results) process.stdout.write(`${result}\n`);
  process.stdout.write(
    `Local connected checks passed (${results.length}); no staging or production mutation.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Local platform check failed at ${stage}: ${error instanceof assert.AssertionError ? error.message : (error.code ?? error.name ?? 'unknown error')}\n`,
  );
  if (error.stderr)
    process.stderr.write(
      String(error.stderr)
        .split('\n')
        .filter((line) => /ERROR:|FATAL:/u.test(line))
        .join('\n') + '\n',
    );
  if (error.code) process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally {
  await Promise.all(sessions.map((sql) => sql.end({ timeout: 5 })));
  if (created) {
    assert.match(name, /^mbv_platform_w1_[a-f0-9]{32}$/u);
    await admin.unsafe(`drop database "${name}"`);
  }
  await admin.end({ timeout: 5 });
}
