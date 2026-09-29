begin;

select plan(10);

-- Durable app-tier idempotency for the operations whose RPCs record none of their own. Before
-- this, the app-tier port was a passthrough, so a retried create_export could double-write the
-- receipt that is the product. Rows are immutable, so the contract is find-first,
-- record-after-work, races resolved by the unique contract-key index.

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'ac100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'idem-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values ('ac200000-0000-4000-8000-000000000001', 'Idem Workspace', 'idem-workspace',
        'ac100000-0000-4000-8000-000000000001');

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values ('ac200000-0000-4000-8000-000000000001', 'ac100000-0000-4000-8000-000000000001',
        'owner', 'active');

-- Unauthenticated callers are refused before any read.
select throws_ok(
  $$select public.find_app_idempotency(
      'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('a', 64))$$,
  '28000', 'UNAUTHENTICATED',
  'find refuses an unauthenticated caller'
);

set local role authenticated;
set local request.jwt.claim.sub = 'ac100000-0000-4000-8000-000000000001';

-- RPC-owned operations are rejected at the SQL layer so an app-tier record can never collide
-- with or mask the record the RPC itself writes under the same unique tuple.
select throws_ok(
  $$select public.find_app_idempotency(
      'ac200000-0000-4000-8000-000000000001', 'quote_run', 'key-1', repeat('a', 64))$$,
  '22023', 'VALIDATION_FAILED',
  'RPC-owned operations are outside the app-tier allowlist'
);

select is(
  (public.find_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('a', 64)
  ) ->> 'status'),
  'absent',
  'an unrecorded key reports absent'
);

select is(
  (public.record_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('a', 64),
    '{"result":{"status":"ok","project":{"id":"p-1"}}}'::jsonb
  ) ->> 'status'),
  'recorded',
  'first record for a key is recorded'
);

select is(
  (public.find_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('a', 64)
  ) ->> 'status'),
  'replay',
  'the same key and fingerprint replays'
);

select is(
  (public.find_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('a', 64)
  ) -> 'response' -> 'result' -> 'project' ->> 'id'),
  'p-1',
  'the replay carries the stored response payload'
);

-- The same key with a different fingerprint is a different request wearing the same key: conflict,
-- never a silent overwrite and never a replay of the wrong response.
select is(
  (public.find_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('b', 64)
  ) ->> 'status'),
  'conflict',
  'a fingerprint mismatch reports conflict'
);

select is(
  (public.record_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('b', 64),
    '{"result":null}'::jsonb
  ) ->> 'status'),
  'conflict',
  'recording over an existing key with a different fingerprint conflicts'
);

-- A lost race (or crash-retry) that re-records the same fingerprint replays the stored row.
select is(
  (public.record_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('a', 64),
    '{"result":{"status":"ok","project":{"id":"p-other"}}}'::jsonb
  ) ->> 'status'),
  'replay',
  're-recording the same fingerprint replays instead of inserting'
);

select is(
  (public.record_app_idempotency(
    'ac200000-0000-4000-8000-000000000001', 'create_project', 'key-1', repeat('a', 64),
    '{"result":null}'::jsonb
  ) -> 'response' -> 'result' -> 'project' ->> 'id'),
  'p-1',
  'the stored response wins over the loser''s recomputed one'
);

select * from finish();

rollback;
