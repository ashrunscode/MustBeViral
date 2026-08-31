begin;

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
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'authenticated',
  'authenticated',
  'p1b-scope-owner@example.test',
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
  '51000000-0000-4000-8000-000000000001',
  'P1b Scope Workspace',
  'p1b-scope-workspace',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  8000000,
  25000000
);

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values (
  '51000000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'owner',
  'active'
);

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

select ok(
  (
    public.create_api_key(
      '51000000-0000-4000-8000-000000000001',
      'Read-only automation',
      array['run:read'],
      'mbv_sk_read',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'api-key-create-1',
      'api-key-request-1'
    ) ->> 'key_id'
  ) is not null,
  'create_api_key stores a scoped key'
);

reset role;
set local role service_role;

select is(
  (
    select (public.verify_api_key(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ) -> 'scopes')::text
  ),
  '["run:read"]',
  'verify_api_key returns granted scopes only'
);

select ok(
  (public.verify_api_key(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ) ->> 'ok')::boolean,
  'verify_api_key accepts an active scoped key'
);

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

select ok(
  (
    public.revoke_api_key(
      (
        public.create_api_key(
          '51000000-0000-4000-8000-000000000001',
          'Revocation fixture',
          array['run:write'],
          'mbv_sk_rev',
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          'api-key-create-2',
          'api-key-request-2'
        ) ->> 'key_id'
      )::uuid,
      'api-key-revoke-request'
    ) ->> 'revoked_at'
  ) is not null,
  'revoke_api_key stamps revoked_at immediately'
);

reset role;
set local role service_role;

select is(
  (public.verify_api_key(
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  ) ->> 'ok')::boolean,
  false,
  'verify_api_key rejects a revoked key immediately'
);

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

select ok(
  (
    public.create_oauth_client(
      '51000000-0000-4000-8000-000000000001',
      'Automation client',
      'mbv_client_fixture_01',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      array['run:read', 'run:write'],
      'oauth-client-create-1',
      'oauth-client-request-1'
    ) ->> 'client_uuid'
  ) is not null,
  'create_oauth_client stores a scoped OAuth client'
);

reset role;
set local role service_role;

select ok(
  (
    public.issue_oauth_access_token(
      'mbv_client_fixture_01',
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      statement_timestamp() + interval '1 hour'
    ) ->> 'ok'
  )::boolean,
  'issue_oauth_access_token mints a scoped access token'
);

select is(
  (
    select (public.verify_oauth_access_token(
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
    ) -> 'scopes')::text
  ),
  '["run:read", "run:write"]',
  'verify_oauth_access_token returns granted scopes'
);

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

select ok(
  (
    public.revoke_oauth_access_token(
      (
        select id
        from public.oauth_access_tokens
        where token_hash = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
        limit 1
      ),
      'oauth-token-revoke-request'
    ) ->> 'revoked_at'
  ) is not null,
  'revoke_oauth_access_token stamps revoked_at immediately'
);

reset role;
set local role service_role;

select is(
  (public.verify_oauth_access_token(
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
  ) ->> 'ok')::boolean,
  false,
  'verify_oauth_access_token rejects a revoked token immediately'
);

insert into public.oauth_access_tokens (
  id,
  client_id,
  actor_id,
  token_hash,
  scopes,
  expires_at
) values (
  '55000000-0000-4000-8000-000000000001',
  (
    select id
    from public.oauth_clients
    where client_id = 'mbv_client_fixture_01'
    limit 1
  ),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  array['run:read'],
  statement_timestamp() - interval '1 minute'
);

select is(
  (public.verify_oauth_access_token(
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  ) ->> 'ok')::boolean,
  false,
  'verify_oauth_access_token rejects an expired token'
);

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

select is(
  pg_temp.error_of($sql$
    select public.start_run_barrier(
      '51000000-0000-4000-8000-000000000001',
      '52000000-0000-4000-8000-000000000001',
      '52100000-0000-4000-8000-000000000001',
      '54000000-0000-4000-8000-000000000001',
      false,
      'unconfirmed-run-key',
      'unconfirmed-run-request'
    )
  $sql$),
  '22023:VALIDATION_FAILED',
  'start_run_barrier rejects unconfirmed spend'
);

select is(
  pg_temp.error_of($sql$
    select public.create_api_key(
      '51000000-0000-4000-8000-000000000001',
      'Invalid scope fixture',
      array['run:read', 'billing:write'],
      'mbv_sk_bad',
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      'api-key-create-3',
      'api-key-request-3'
    )
  $sql$),
  '22023:VALIDATION_FAILED',
  'create_api_key rejects unknown scopes'
);

select finish();
rollback;
