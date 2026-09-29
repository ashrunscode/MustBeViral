begin;

select plan(12);

create temporary table workspace_result (payload jsonb not null);
create temporary table canvas_result (payload jsonb not null);
grant select, insert on pg_temp.workspace_result to authenticated;
grant select, insert on pg_temp.canvas_result to authenticated;

create or replace function pg_temp.error_of(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000:';
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'authenticated',
  'authenticated',
  'rpc-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

insert into pg_temp.workspace_result (payload)
select public.create_workspace(
  'RPC Workspace',
  'rpc-workspace',
  'workspace-key',
  'workspace-request'
);

select ok(
  (select (payload ->> 'workspace_id')::uuid is not null from pg_temp.workspace_result),
  'create_workspace returns a workspace identifier'
);
select is(
  (
    public.create_workspace(
      'RPC Workspace',
      'rpc-workspace',
      'workspace-key',
      'workspace-replay'
    ) ->> 'workspace_id'
  )::uuid,
  (select (payload ->> 'workspace_id')::uuid from pg_temp.workspace_result),
  'create_workspace same-input replay returns the original workspace'
);
select is(
  (
    select count(*)::integer
    from public.workspace_memberships
    where workspace_id = (select (payload ->> 'workspace_id')::uuid from pg_temp.workspace_result)
      and user_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
      and role = 'owner'
      and status = 'active'
  ),
  1,
  'workspace bootstrap creates exactly one active P0 owner'
);
select is(
  pg_temp.error_of($sql$
    select public.create_workspace(
      'Changed Workspace',
      'changed-workspace',
      'workspace-key',
      'workspace-conflict'
    )
  $sql$),
  'P0001:IDEMPOTENCY_CONFLICT',
  'workspace idempotency key cannot be reused with changed input'
);

insert into public.projects (id, workspace_id, name, status, created_by)
values (
  '51000000-0000-4000-8000-000000000001',
  (select (payload ->> 'workspace_id')::uuid from pg_temp.workspace_result),
  'RPC Project',
  'active',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
);

insert into pg_temp.canvas_result (payload)
select public.create_canvas_with_revision(
  (select (payload ->> 'workspace_id')::uuid from pg_temp.workspace_result),
  '51000000-0000-4000-8000-000000000001',
  'RPC Canvas',
  1,
  '{"nodes":[{"id":"node-1"}],"edges":[]}'::jsonb,
  'initial revision',
  'canvas-key',
  'canvas-request'
);

select ok(
  (select (payload ->> 'canvas_id')::uuid is not null from pg_temp.canvas_result),
  'create_canvas_with_revision returns a canvas identifier'
);
select matches(
  (select payload ->> 'canonical_hash' from pg_temp.canvas_result),
  '^[0-9a-f]{64}$',
  'canvas root receives a server-computed canonical SHA-256 hash'
);
select is(
  (
    select head_revision_id
    from public.canvases
    where id = (select (payload ->> 'canvas_id')::uuid from pg_temp.canvas_result)
  ),
  (select (payload ->> 'revision_id')::uuid from pg_temp.canvas_result),
  'canvas head points at the atomic root revision'
);
select ok(
  (
    select parent_revision_id is null
    from public.canvas_revisions
    where id = (select (payload ->> 'revision_id')::uuid from pg_temp.canvas_result)
  ),
  'initial canvas revision has no parent'
);
select is(
  (
    public.create_canvas_with_revision(
      (select (payload ->> 'workspace_id')::uuid from pg_temp.workspace_result),
      '51000000-0000-4000-8000-000000000001',
      'RPC Canvas',
      1,
      '{"nodes":[{"id":"node-1"}],"edges":[]}'::jsonb,
      'initial revision',
      'canvas-key',
      'canvas-replay'
    ) ->> 'revision_id'
  )::uuid,
  (select (payload ->> 'revision_id')::uuid from pg_temp.canvas_result),
  'canvas same-input replay returns the original root revision'
);
select is(
  (
    select count(*)::integer
    from public.canvas_revisions
    where canvas_id = (select (payload ->> 'canvas_id')::uuid from pg_temp.canvas_result)
  ),
  1,
  'canvas replay creates no duplicate root revision'
);
select is(
  pg_temp.error_of(format(
    $sql$
      select public.create_canvas_with_revision(
        %L::uuid,
        '51000000-0000-4000-8000-000000000001',
        'RPC Canvas',
        1,
        '{"nodes":[],"edges":[]}'::jsonb,
        'changed revision',
        'canvas-key',
        'canvas-conflict'
      )
    $sql$,
    (select payload ->> 'workspace_id' from pg_temp.workspace_result)
  )),
  'P0001:IDEMPOTENCY_CONFLICT',
  'canvas idempotency key cannot be reused with a changed graph'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where action in ('workspace.created', 'canvas.created')
  ),
  2,
  'workspace and canvas commands append one audit event each'
);

select * from finish();

rollback;
