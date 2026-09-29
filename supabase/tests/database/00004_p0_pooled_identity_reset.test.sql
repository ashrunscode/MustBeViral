select plan(14);

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

begin;
set local role authenticated;
select is(current_user, 'authenticated'::name, 'transaction A assumes only the authenticated role');
select is(
  set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'transaction A actor claim is transaction-local'
);
select is(
  set_config('request.jwt.claim.workspace_id', '10000000-0000-4000-8000-000000000001', true),
  '10000000-0000-4000-8000-000000000001',
  'transaction A workspace claim is transaction-local'
);
commit;

select is(current_user, session_user, 'commit restores the pooled login identity');
select is(
  coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), ''),
  '',
  'commit clears the prior actor claim'
);
select is(
  coalesce(nullif(current_setting('request.jwt.claim.workspace_id', true), ''), ''),
  '',
  'commit clears the prior workspace claim'
);

begin;
select ok(
  current_user = session_user
  and coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), '') = ''
  and coalesce(nullif(current_setting('request.jwt.claim.workspace_id', true), ''), '') = '',
  'reused transaction B observes baseline identity before context setup'
);
set local role authenticated;
select is(current_user, 'authenticated'::name, 'transaction B assumes authenticated independently');
select is(
  set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'transaction B receives only its own actor claim'
);
select is(
  set_config('request.jwt.claim.workspace_id', '20000000-0000-4000-8000-000000000002', true),
  '20000000-0000-4000-8000-000000000002',
  'transaction B receives only its own workspace claim'
);
rollback;

select is(current_user, session_user, 'rollback restores the pooled login identity');
select ok(
  coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), '') = ''
  and coalesce(nullif(current_setting('request.jwt.claim.workspace_id', true), ''), '') = '',
  'rollback clears all transaction B identity settings'
);

begin;
set local role authenticated;
do $context$
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
  perform set_config(
    'request.jwt.claim.workspace_id',
    '10000000-0000-4000-8000-000000000001',
    true
  );
end;
$context$;
select is(
  pg_temp.error_of('select 1 / 0'),
  '22012:division by zero',
  'statement error is classified without promoting session-scoped identity'
);
rollback;

select ok(
  current_user = session_user
  and coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), '') = ''
  and coalesce(nullif(current_setting('request.jwt.claim.workspace_id', true), ''), '') = '',
  'rollback after statement error clears role, actor, and workspace context'
);

select * from finish();
