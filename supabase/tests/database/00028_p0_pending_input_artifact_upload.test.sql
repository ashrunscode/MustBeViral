begin;

select plan(10);

select has_function(
  'public',
  'create_pending_input_artifact',
  array['uuid', 'text', 'int8', 'text', 'text', 'text'],
  'create_pending_input_artifact exists'
);

select has_function(
  'public',
  'finalize_input_artifact',
  array['uuid', 'text'],
  'finalize_input_artifact exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_pending_input_artifact(uuid, text, bigint, text, text, text)'::regprocedure,
    'execute'
  ),
  'authenticated can execute create_pending_input_artifact'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_input_artifact(uuid, text)'::regprocedure,
    'execute'
  ),
  'service_role can execute finalize_input_artifact'
);

select throws_ok(
  $$select public.create_pending_input_artifact(
    'd0210000-0000-4000-8000-000000000001',
    'image/png',
    128,
    repeat('a', 64),
    'packshot',
    'req-1'
  )$$,
  '28000',
  'UNAUTHENTICATED',
  'create_pending_input_artifact requires an authenticated actor'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd0100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'upload-owner@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
), (
  'd0100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
  'upload-outsider@example.test', '', statement_timestamp(),
  '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values (
  'd0200000-0000-4000-8000-000000000001',
  'Upload Workspace',
  'upload-workspace',
  'd0100000-0000-4000-8000-000000000001'
);

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values (
  'd0200000-0000-4000-8000-000000000001',
  'd0100000-0000-4000-8000-000000000001',
  'owner',
  'active'
);

insert into public.projects (id, workspace_id, name, created_by)
values (
  'd0210000-0000-4000-8000-000000000001',
  'd0200000-0000-4000-8000-000000000001',
  'Upload Project',
  'd0100000-0000-4000-8000-000000000001'
);

set local request.jwt.claim.sub = 'd0100000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.create_pending_input_artifact(
    'd0210000-0000-4000-8000-000000000001',
    'image/gif',
    128,
    repeat('a', 64),
    'packshot',
    'req-2'
  )$$,
  '22023',
  'VALIDATION_FAILED',
  'rejects a disallowed packshot MIME type'
);

select is(
  (
    select (created ->> 'status')
    from public.create_pending_input_artifact(
      'd0210000-0000-4000-8000-000000000001',
      'image/png',
      128,
      repeat('ab', 32),
      'packshot',
      'req-3'
    ) as created
  ),
  'pending',
  'owner can create a pending input artifact'
);

select is(
  (
    select (replayed ->> 'replayed')::boolean
    from public.create_pending_input_artifact(
      'd0210000-0000-4000-8000-000000000001',
      'image/png',
      128,
      repeat('ab', 32),
      'packshot',
      'req-4'
    ) as replayed
  ),
  true,
  'same content hash replays the pending input'
);

set local request.jwt.claim.sub = 'd0100000-0000-4000-8000-000000000002';

select throws_ok(
  $$select public.create_pending_input_artifact(
    'd0210000-0000-4000-8000-000000000001',
    'image/png',
    128,
    repeat('cd', 32),
    'packshot',
    'req-5'
  )$$,
  'P0002',
  'NOT_FOUND',
  'outsider cannot create an input on another workspace project'
);

reset request.jwt.claim.sub;

select is(
  (
    select (finalized ->> 'status')
    from public.finalize_input_artifact(
      (
        select id
        from public.artifacts
        where project_id = 'd0210000-0000-4000-8000-000000000001'
        limit 1
      ),
      repeat('ab', 32)
    ) as finalized
  ),
  'available',
  'finalize marks the pending input available'
);

select * from finish();

rollback;
