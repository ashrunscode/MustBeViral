import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import postgres from 'postgres';

import { localSupabaseDatabase, LOCAL_SUPABASE_CONTAINER } from './local-supabase.mjs';

const connection = localSupabaseDatabase();
const name = `mbv_platform_knowledge_${randomUUID().replaceAll('-', '')}`;
assert.match(name, /^mbv_platform_knowledge_[a-f0-9]{32}$/u);
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

try {
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

  stage = 'seed synthetic knowledge identities';
  const sql = postgres({ ...connection, database: name, ...options });
  const outsider = postgres({ ...connection, database: name, ...options });
  sessions.push(sql, outsider);
  const owner = randomUUID();
  const other = randomUUID();
  await sql`insert into auth.users(id,aud,role,email) values
    (${owner},'authenticated','authenticated','knowledge-owner@synthetic.example.test'),
    (${other},'authenticated','authenticated','knowledge-other@synthetic.example.test')`;

  const command = async (tx, operation, input, key = randomUUID()) => {
    const [row] =
      await tx`select public.platform_command(${operation},${tx.json(input)},${key},'connected-knowledge') as result`;
    return row.result.record;
  };
  const knowledge = async (tx, operation, input, key = randomUUID()) => {
    const [row] =
      await tx`select public.platform_knowledge_command(${operation},${tx.json(input)},${key},'connected-knowledge') as result`;
    return row.result;
  };

  const seed = await userTransaction(sql, owner, async (tx) => {
    const [{ result: workspace }] =
      await tx`select public.create_workspace('WashBodega knowledge','knowledge-wb',${randomUUID()},'req') as result`;
    const [{ result: second }] =
      await tx`select public.create_workspace('UnPile knowledge','knowledge-up',${randomUUID()},'req') as result`;
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
    return { wb, up };
  });

  async function machineTransaction(action) {
    return sql.begin(async (tx) => {
      await tx`set local role service_role`;
      return action(tx);
    });
  }

  stage = 'deny user fabrication of HTTPS capture';
  await assert.rejects(
    () =>
      userTransaction(
        sql,
        owner,
        (tx) =>
          tx`select public.record_brand_source_capture(${randomUUID()}, ${tx.json({})}, 'req', 1)`,
      ),
    /permission denied for function record_brand_source_capture/u,
  );
  await assert.rejects(
    () =>
      userTransaction(
        sql,
        owner,
        (tx) => tx`update public.brand_sources set origin_url = 'https://bypass.example'`,
      ),
    /permission denied for table brand_sources/u,
  );
  results.push('authenticated cannot fabricate HTTPS provenance or write sources');

  stage = 'manual drafts stay tenant-private';
  const drafts = await userTransaction(sql, owner, async (tx) => {
    const wbDraft = await knowledge(
      tx,
      'start_manual_knowledge_draft',
      {
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
      },
      'wb-manual',
    );
    const upDraft = await knowledge(
      tx,
      'start_manual_knowledge_draft',
      {
        workspace_id: seed.up.workspace_id,
        brand_id: seed.up.id,
      },
      'up-manual',
    );
    assert.notEqual(wbDraft.record.id, upDraft.record.id);
    assert.equal(wbDraft.current_candidates[0].status, 'unknown');
    assert.equal(wbDraft.current_candidates[0].method, 'manual');
    assert.ok(wbDraft.current_candidates[0].source_id);
    const corrected = await knowledge(
      tx,
      'correct_knowledge_candidate',
      {
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
        candidate_id: wbDraft.current_candidates[0].id,
        expected_version: 1,
        value_text: 'Customer access is 24/7 for machines only.',
        excerpt: 'Operator correction of hours.',
      },
      'wb-correct',
    );
    assert.equal(corrected.record.version, 2);
    assert.equal(corrected.current_candidates[0].status, 'corrected');
    assert.equal(corrected.current_candidates[0].supersedes_id, wbDraft.current_candidates[0].id);
    assert.notEqual(
      corrected.current_candidates[0].source_id,
      wbDraft.current_candidates[0].source_id,
    );
    return { wbDraft, upDraft, corrected };
  });
  results.push('WashBodega and UnPile manual drafts correct independently with immutable ancestry');

  stage = 'outsider cannot read captured knowledge';
  await assert.rejects(
    () =>
      userTransaction(
        outsider,
        other,
        (tx) =>
          tx`select public.platform_knowledge_query('get_knowledge_draft', ${tx.json({
            workspace_id: seed.wb.workspace_id,
            brand_id: seed.wb.id,
          })})`,
      ),
    /NOT_FOUND/u,
  );
  results.push('outsider knowledge reads are NOT_FOUND');

  stage = 'machine capture rechecks actor and dedupes bytes per brand';
  const job = await userTransaction(sql, owner, (tx) =>
    knowledge(
      tx,
      'start_website_capture',
      {
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
        url: 'https://washbodega.example/',
      },
      'wb-site',
    ),
  );
  assert.equal(job.job.status, 'capturing');
  assert.equal(job.capture_pending, true);
  const sourceId = randomUUID();
  const payload = {
    source_id: sourceId,
    origin_url: 'https://washbodega.example/',
    final_url: 'https://washbodega.example/',
    media_type: 'text/html',
    byte_size: 24,
    content_sha256: 'ab'.repeat(32),
    r2_key: `brand-sources/${seed.wb.workspace_id}/${seed.wb.id}/${sourceId}`,
    http_status: 200,
    redirect_hops: [],
    candidates: [
      {
        field_key: 'page_title',
        value_text: 'WashBodega',
        status: 'observed',
        excerpt: 'WashBodega',
        locator: 'title',
        method: 'html_title',
      },
    ],
  };
  await machineTransaction(async (tx) => {
    const [row] =
      await tx`select public.record_brand_source_capture(${job.job.id}, ${tx.json(payload)}, 'connected-knowledge', ${job.job.attempt_count}) as result`;
    assert.equal(row.result.job.status, 'captured');
  });
  const sameBytesOtherBrand = await userTransaction(sql, owner, (tx) =>
    knowledge(
      tx,
      'start_website_capture',
      {
        workspace_id: seed.up.workspace_id,
        brand_id: seed.up.id,
        url: 'https://unpile.example/',
      },
      'up-site',
    ),
  );
  const otherSource = randomUUID();
  await machineTransaction(async (tx) => {
    const [row] =
      await tx`select public.record_brand_source_capture(${sameBytesOtherBrand.job.id}, ${tx.json({
        ...payload,
        source_id: otherSource,
        origin_url: 'https://unpile.example/',
        final_url: 'https://unpile.example/',
        r2_key: `brand-sources/${seed.up.workspace_id}/${seed.up.id}/${otherSource}`,
      })}, 'connected-knowledge', ${sameBytesOtherBrand.job.attempt_count}) as result`;
    assert.equal(row.result.job.status, 'captured');
    assert.notEqual(row.result.job.source_id, sourceId);
  });
  results.push(
    'same bytes remain independently private across brands; machine RPC is service_role only',
  );

  stage = 'claimed document upload is fenced to the actor lease';
  const upload = await userTransaction(sql, owner, (tx) =>
    knowledge(
      tx,
      'start_document_capture',
      {
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
        filename: 'washbodega-notes.md',
        media_type: 'text/markdown',
      },
      'wb-doc',
    ),
  );
  assert.equal(upload.job.status, 'awaiting_bytes');
  const docSource = randomUUID();
  const docPayload = {
    source_id: docSource,
    origin_url: '',
    final_url: '',
    media_type: 'text/markdown',
    byte_size: 24,
    content_sha256: 'cd'.repeat(32),
    r2_key: `brand-sources/${seed.wb.workspace_id}/${seed.wb.id}/${docSource}`,
    candidates: [
      {
        field_key: 'document_filename',
        value_text: 'washbodega-notes.md',
        status: 'observed',
        excerpt: 'notes',
        locator: 'filename',
        method: 'document_text',
      },
    ],
  };
  await assert.rejects(
    () =>
      machineTransaction(
        (tx) =>
          tx`select public.record_brand_source_capture(${upload.job.id}, ${tx.json(docPayload)}, 'connected-knowledge', 1)`,
      ),
    /VALIDATION_FAILED/u,
  );
  const claimed = await userTransaction(sql, owner, (tx) =>
    knowledge(
      tx,
      'claim_document_upload',
      {
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
        job_id: upload.job.id,
      },
      'wb-doc-claim',
    ),
  );
  assert.equal(claimed.job.status, 'capturing');
  await machineTransaction(async (tx) => {
    const [row] =
      await tx`select public.record_brand_source_capture(${upload.job.id}, ${tx.json(docPayload)}, 'connected-knowledge', ${claimed.job.attempt_count}) as result`;
    assert.equal(row.result.job.status, 'captured');
  });
  const latest = await userTransaction(sql, owner, async (tx) => {
    const [row] =
      await tx`select public.platform_knowledge_query('list_latest_source_job', ${tx.json({
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
      })}) as result`;
    return row.result.record;
  });
  assert.equal(latest.id, upload.job.id);
  assert.equal(latest.status, 'captured');
  results.push('document upload requires a write claim; service completion is lease-fenced');

  stage = 'revoke grant hides later reads and keeps the owner receipt stable';
  const access = await userTransaction(sql, owner, async (tx) => {
    const studio = await command(tx, 'create_studio', {
      name: 'Knowledge studio',
      slug: 'knowledge-studio',
    });
    await command(tx, 'set_studio_member', {
      studio_id: studio.id,
      user_id: other,
      role: 'editor',
      expected_version: 1,
    });
    const grant = await command(tx, 'grant_workspace_access', {
      workspace_id: seed.wb.workspace_id,
      studio_id: studio.id,
      brand_id: seed.wb.id,
      actions: ['brand:read', 'brand:write'],
    });
    return { studio, grant };
  });
  await userTransaction(outsider, other, async (tx) => {
    const [{ result }] =
      await tx`select public.platform_knowledge_query('get_knowledge_draft', ${tx.json({
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
      })}) as result`;
    assert.equal(result.record.id, drafts.wbDraft.record.id);
  });
  await userTransaction(sql, owner, (tx) =>
    command(tx, 'revoke_workspace_access', {
      workspace_id: seed.wb.workspace_id,
      grant_id: access.grant.id,
      expected_version: 1,
    }),
  );
  await assert.rejects(
    () =>
      userTransaction(
        outsider,
        other,
        (tx) =>
          tx`select public.platform_knowledge_query('get_knowledge_draft', ${tx.json({
            workspace_id: seed.wb.workspace_id,
            brand_id: seed.wb.id,
          })})`,
      ),
    /NOT_FOUND/u,
  );
  await assert.rejects(
    () =>
      userTransaction(outsider, other, (tx) =>
        knowledge(
          tx,
          'claim_document_upload',
          {
            workspace_id: seed.wb.workspace_id,
            brand_id: seed.wb.id,
            job_id: upload.job.id,
          },
          'revoked-claim',
        ),
      ),
    /NOT_FOUND|FORBIDDEN/u,
  );
  const ownerReplay = await userTransaction(sql, owner, async (tx) => {
    const replay = await knowledge(
      tx,
      'start_manual_knowledge_draft',
      {
        workspace_id: seed.wb.workspace_id,
        brand_id: seed.wb.id,
      },
      'wb-manual',
    );
    assert.equal(replay.record.id, drafts.wbDraft.record.id);
    assert.equal(replay.record.version, 1);
    return replay;
  });
  assert.equal(ownerReplay.record.version, 1);
  results.push('revoked grant is denied; owner idempotent receipt stays the stored revision');

  process.stdout.write(`${results.map((line) => `passed: ${line}`).join('\n')}\n`);
  process.stdout.write(`verify-platform-knowledge-connected: ${results.length} passed\n`);
} catch (error) {
  process.stderr.write(
    `verify-platform-knowledge-connected failed at ${stage}: ${error instanceof Error ? error.message : error}\n`,
  );
  process.exitCode = 1;
} finally {
  for (const session of sessions) await session.end().catch(() => {});
  if (created) {
    try {
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
    } catch {
      process.stderr.write('Isolated knowledge database could not be dropped in this run.\n');
    }
  }
  await admin.end().catch(() => {});
}
