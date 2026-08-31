begin;

select plan(6);

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
  'ffffffff-ffff-4fff-8fff-fffffffffff2',
  'authenticated',
  'authenticated',
  'p2-checkpoint-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (
  id, name, slug, created_by, per_run_spend_cap_micros, daily_spend_cap_micros
) values (
  '54000000-0000-4000-8000-000000000001',
  'P2 Checkpoint Workspace',
  'p2-checkpoint-workspace',
  'ffffffff-ffff-4fff-8fff-fffffffffff2',
  8000000,
  25000000
);

insert into public.projects (
  id, workspace_id, name, created_by
) values (
  '54100000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  'Checkpoint Project',
  'ffffffff-ffff-4fff-8fff-fffffffffff2'
);

insert into public.canvases (
  id, workspace_id, project_id, name, created_by
) values (
  '54200000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  '54100000-0000-4000-8000-000000000001',
  'Checkpoint Canvas',
  'ffffffff-ffff-4fff-8fff-fffffffffff2'
);

insert into public.canvas_revisions (
  id,
  workspace_id,
  canvas_id,
  graph_schema_version,
  graph_snapshot,
  canonical_hash,
  actor_type,
  actor_id,
  reason
) values (
  '54300000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  '54200000-0000-4000-8000-000000000001',
  1,
  '{"nodes":[{"id":"node-1","kind":"brief","parameter_schema_version":1,"parameters":{"product":"Serum"}}],"edges":[]}'::jsonb,
  repeat('a', 64),
  'user',
  'ffffffff-ffff-4fff-8fff-fffffffffff2',
  'initial revision'
);

update public.canvases
set head_revision_id = '54300000-0000-4000-8000-000000000001'
where id = '54200000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'ffffffff-ffff-4fff-8fff-fffffffffff2',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

select ok(
  (public.apply_canvas_revision(
    '54000000-0000-4000-8000-000000000001',
    '54200000-0000-4000-8000-000000000001',
    '54300000-0000-4000-8000-000000000001',
    1,
    '{"nodes":[{"id":"node-1","kind":"brief","parameter_schema_version":1,"parameters":{"product":"Serum","notes":"Checkpointed draft"}}],"edges":[]}'::jsonb,
    'Checkpoint collaboration drafts',
    'p2-checkpoint-key',
    'p2-checkpoint-request'
  ) ->> 'revision_id') is not null,
  'checkpoint reason creates a new immutable child revision'
);

select is(
  (
    select graph_snapshot -> 'nodes' -> 0 -> 'parameters' ->> 'notes'
    from public.canvas_revisions
    where id = (
      select head_revision_id from public.canvases
      where id = '54200000-0000-4000-8000-000000000001'
    )
  ),
  'Checkpointed draft',
  'checkpointed graph snapshot is stored on the new head revision'
);

select is(
  (
    select graph_snapshot -> 'nodes' -> 0 -> 'parameters' ->> 'notes'
    from public.canvas_revisions
    where id = '54300000-0000-4000-8000-000000000001'
  ),
  null,
  'parent revision snapshot remains unchanged after checkpoint'
);

select is(
  (
    select parent_revision_id
    from public.canvas_revisions
    where id = (
      select head_revision_id from public.canvases
      where id = '54200000-0000-4000-8000-000000000001'
    )
  ),
  '54300000-0000-4000-8000-000000000001'::uuid,
  'checkpoint child revision parents the prior head'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_canvas_revision(
      '54000000-0000-4000-8000-000000000001',
      '54200000-0000-4000-8000-000000000001',
      '54300000-0000-4000-8000-000000000001',
      1,
      '{"nodes":[{"id":"node-1","kind":"brief","parameter_schema_version":1,"parameters":{"product":"Stale"}}],"edges":[]}'::jsonb,
      'Stale checkpoint retry',
      'p2-stale-checkpoint-key',
      'p2-stale-checkpoint-request'
    )
  $sql$),
  'P0001:REVISION_CONFLICT',
  'stale expected_revision_id rejects checkpoint without rewriting history'
);

select is(
  pg_temp.error_of($sql$
    update public.canvas_revisions
    set reason = 'mutated'
    where id = '54300000-0000-4000-8000-000000000001'
  $sql$),
  '55000:canvas_revisions_IMMUTABLE',
  'checkpointed revisions remain immutable after creation'
);

select * from finish();
rollback;
