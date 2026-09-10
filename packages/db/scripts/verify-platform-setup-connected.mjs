import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';

import { localSupabaseDatabase, LOCAL_SUPABASE_CONTAINER } from './local-supabase.mjs';

const connection = localSupabaseDatabase();
const name = `mbv_platform_setup_${randomUUID().replaceAll('-', '')}`;
assert.match(name, /^mbv_platform_setup_[a-f0-9]{32}$/u);
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

  stage = 'seed synthetic saved onboarding';
  const sql = postgres({ ...connection, database: name, ...options });
  const other = postgres({ ...connection, database: name, ...options });
  sessions.push(sql, other);
  const owner = randomUUID();
  const editor = randomUUID();
  await sql`insert into auth.users(id,aud,role,email,email_confirmed_at) values
    (${owner},'authenticated','authenticated','setup-owner@synthetic.example.test',now()),
    (${editor},'authenticated','authenticated','setup-editor@synthetic.example.test',now())`;
  const setup = async (tx, op, input, key = randomUUID()) => {
    const [row] =
      await tx`select public.platform_setup_command(${op},${tx.json(input)},${key},'connected-setup') as result`;
    return row.result;
  };
  const studio = await userTransaction(sql, owner, (tx) =>
    command(tx, 'create_studio', { name: 'Synthetic setup portfolio', slug: 'setup-portfolio' }),
  );
  const startInput = { studio_id: studio.id, name: 'WashBodega', slug: 'washbodega' };
  const starts = await Promise.all([
    userTransaction(sql, owner, (tx) => setup(tx, 'start_brand_draft', startInput, 'same-start')),
    userTransaction(other, owner, (tx) => setup(tx, 'start_brand_draft', startInput, 'same-start')),
  ]);
  assert.deepEqual(starts[0], starts[1]);
  const wb = starts[0];
  const up = await userTransaction(sql, owner, (tx) =>
    setup(
      tx,
      'start_brand_draft',
      { studio_id: studio.id, name: 'UnPile', slug: 'unpile' },
      'up-start',
    ),
  );
  results.push('concurrent draft start: one tenant, brand, grant and acknowledged draft');
  const saveInput = {
    workspace_id: wb.brand.workspace_id,
    brand_id: wb.brand.id,
    expected_version: 1,
    website_url: 'https://example.test',
    description: 'Synthetic operator input',
    audience: 'Synthetic audience',
    goals: 'Synthetic goals',
    current_step: 'details',
  };
  const saves = await Promise.allSettled([
    userTransaction(sql, owner, (tx) => setup(tx, 'save_brand_draft', saveInput, 'save-one')),
    userTransaction(other, owner, (tx) =>
      setup(tx, 'save_brand_draft', { ...saveInput, goals: 'Concurrent alternate' }, 'save-two'),
    ),
  ]);
  assert.equal(saves.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(saves.find((r) => r.status === 'rejected').reason.message, 'REVISION_CONFLICT');
  const successfulKey = saves[0].status === 'fulfilled' ? 'save-one' : 'save-two';
  const successfulInput =
    saves[0].status === 'fulfilled' ? saveInput : { ...saveInput, goals: 'Concurrent alternate' };
  const replay = await userTransaction(other, owner, (tx) =>
    setup(tx, 'save_brand_draft', successfulInput, successfulKey),
  );
  assert.equal(replay.record.version, 2);
  results.push(
    'simultaneous saves: one commit, one version conflict; lost acknowledgement replays version 2',
  );
  const reopened = postgres({ ...connection, database: name, ...options });
  sessions.push(reopened);
  await userTransaction(reopened, owner, async (tx) => {
    const [a] =
      await tx`select public.platform_setup_query('get_brand_draft',${tx.json({ workspace_id: wb.brand.workspace_id, brand_id: wb.brand.id })}) as result`;
    const [b] =
      await tx`select public.platform_setup_query('get_brand_draft',${tx.json({ workspace_id: up.brand.workspace_id, brand_id: up.brand.id })}) as result`;
    assert.equal(a.result.record.version, 2);
    assert.equal(b.result.record.version, 1);
    assert.equal(b.result.record.goals, '');
  });
  results.push('fresh connection: separate WashBodega/UnPile drafts retain saved state');
  const invitation = await userTransaction(sql, owner, (tx) =>
    setup(
      tx,
      'create_studio_invitation',
      {
        studio_id: studio.id,
        recipient_email: 'setup-editor@synthetic.example.test',
        role: 'editor',
        expected_version: 1,
      },
      'invite',
    ),
  );
  const [{ pid }] = await other`select pg_backend_pid() as pid`;
  let waiting;
  await userTransaction(sql, owner, async (tx) => {
    await setup(
      tx,
      'revoke_studio_invitation',
      { studio_id: studio.id, invitation_id: invitation.record.id, expected_version: 1 },
      'revoke',
    );
    waiting = userTransaction(other, editor, (edit) =>
      setup(
        edit,
        'accept_studio_invitation',
        { invitation_id: invitation.record.id, expected_version: 1 },
        'accept',
      ),
    ).then(
      () => ({ code: 'UNEXPECTED_SUCCESS' }),
      (error) => ({ code: error.message }),
    );
    await waitUntilBlocked(pid);
  });
  assert.deepEqual(await waiting, { code: 'RESOURCE_ARCHIVED' });
  const [members] =
    await sql`select count(*)::integer as count from public.studio_memberships where user_id=${editor}`;
  assert.equal(members.count, 0);
  results.push(
    'invitation revoked while acceptance waits: denied after lock release, no membership',
  );
  const fresh = await userTransaction(sql, owner, (tx) =>
    setup(
      tx,
      'create_studio_invitation',
      {
        studio_id: studio.id,
        recipient_email: 'setup-editor@synthetic.example.test',
        role: 'editor',
        expected_version: 3,
      },
      'fresh',
    ),
  );
  const accepted = await Promise.all([
    userTransaction(sql, editor, (tx) =>
      setup(
        tx,
        'accept_studio_invitation',
        { invitation_id: fresh.record.id, expected_version: 1 },
        'same-accept',
      ),
    ),
    userTransaction(other, editor, (tx) =>
      setup(
        tx,
        'accept_studio_invitation',
        { invitation_id: fresh.record.id, expected_version: 1 },
        'same-accept',
      ),
    ),
  ]);
  assert.deepEqual(accepted[0], accepted[1]);
  results.push('simultaneous matching acceptance: one membership and one durable accepted receipt');
  await userTransaction(sql, owner, async (tx) => {
    await command(
      tx,
      'revoke_studio_member',
      { studio_id: studio.id, user_id: editor, expected_version: 5 },
      'revoke-editor',
    );
    waiting = userTransaction(other, editor, (edit) =>
      setup(edit, 'save_brand_draft', { ...saveInput, expected_version: 2 }, 'revoked-save'),
    ).then(
      () => ({ code: 'UNEXPECTED_SUCCESS' }),
      (error) => ({ code: error.message }),
    );
    await waitUntilBlocked(pid);
  });
  assert.deepEqual(await waiting, { code: 'NOT_FOUND' });
  results.push(
    'membership revoked while draft save waits: denied after lock release, draft unchanged',
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
    assert.match(name, /^mbv_platform_setup_[a-f0-9]{32}$/u);
    await admin.unsafe(`drop database "${name}"`);
  }
  await admin.end({ timeout: 5 });
}
