begin;

select plan(10);

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
  'ffffffff-ffff-4fff-8fff-fffffffffff1',
  'authenticated',
  'authenticated',
  'p1b-skill-owner@example.test',
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
  '52000000-0000-4000-8000-000000000001',
  'P1b Skills Workspace',
  'p1b-skills-workspace',
  'ffffffff-ffff-4fff-8fff-fffffffffff1',
  8000000,
  25000000
);

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values (
  '52000000-0000-4000-8000-000000000001',
  'ffffffff-ffff-4fff-8fff-fffffffffff1',
  'owner',
  'active'
);

set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-ffff-4fff-8fff-fffffffffff1';

select is(
  (
    public.publish_skill(
      '52000000-0000-4000-8000-000000000001',
      'launch-copy',
      'Launch copy v1',
      'Write concise launch copy.',
      'skill-publish-1',
      'skill-request-1'
    ) ->> 'version_number'
  ),
  '1',
  'publish_skill creates version 1 for a new Skill name'
);

select is(
  (
    public.publish_skill(
      '52000000-0000-4000-8000-000000000001',
      'launch-copy',
      'Launch copy v2',
      'Write concise launch copy with a stronger hook.',
      'skill-publish-2',
      'skill-request-2'
    ) ->> 'version_number'
  ),
  '2',
  'publish_skill increments version number for the same Skill name'
);

select is(
  (
    select count(*)::text
    from public.skill_versions as version
    join public.skills as skill on skill.id = version.skill_id
    where skill.workspace_id = '52000000-0000-4000-8000-000000000001'
      and skill.name = 'launch-copy'
  ),
  '2',
  'edits create a new immutable version row instead of replacing the prior snapshot'
);

select isnt(
  (
    select title
    from public.skill_versions as version
    join public.skills as skill on skill.id = version.skill_id
    where skill.name = 'launch-copy'
      and version.version_number = 1
  ),
  'Launch copy v2',
  'published version 1 title remains unchanged after version 2 is published'
);

select is(
  (
    public.publish_skill(
      '52000000-0000-4000-8000-000000000001',
      'launch-copy',
      'Launch copy v2',
      'Write concise launch copy with a stronger hook.',
      'skill-publish-2',
      'skill-request-2'
    ) ->> 'version_number'
  ),
  '2',
  'publish_skill replays the same idempotency key without creating version 3'
);

select ok(
  pg_temp.error_of($sql$
    update public.skill_versions
    set title = 'Mutated title'
    where version_number = 1
  $sql$) like '42501:%',
  'authenticated users cannot mutate published skill_versions rows'
);

select ok(
  pg_temp.error_of($sql$
    delete from public.skill_versions
    where version_number = 1
  $sql$) like '42501:%',
  'authenticated users cannot delete published skill_versions rows'
);

select ok(
  pg_temp.error_of($sql$
    insert into public.skill_versions (
      id,
      skill_id,
      version_number,
      title,
      instructions,
      published_by
    )
    select
      gen_random_uuid(),
      skill.id,
      99,
      'Bypass title',
      'Bypass instructions',
      'ffffffff-ffff-4fff-8fff-fffffffffff1'
    from public.skills as skill
    where skill.name = 'launch-copy'
    limit 1
  $sql$) like '42501:%',
  'authenticated users cannot insert skill_versions outside publish_skill'
);

select ok(
  pg_temp.error_of($sql$
    insert into public.api_keys (
      workspace_id,
      created_by,
      name,
      prefix,
      secret_hash,
      scopes
    ) values (
      '52000000-0000-4000-8000-000000000001',
      'ffffffff-ffff-4fff-8fff-fffffffffff1',
      'Skill bypass key',
      'mbv_sk_bypass',
      repeat('a', 64),
      array['run:read']
    )
  $sql$) like '42501:%',
  'skill workflow tables do not grant direct credential storage access to authenticated users'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'skill_versions'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'skill_versions grants are read-only for authenticated users'
);

select finish();
rollback;
