begin;
select plan(6);

select has_function('public', 'create_api_key', array['uuid', 'text', 'text[]', 'text', 'text', 'text', 'text'], 'create_api_key exists');
select has_function('public', 'revoke_api_key', array['uuid', 'text'], 'revoke_api_key exists');
select has_function('public', 'create_oauth_client', array['uuid', 'text', 'text', 'text', 'text[]', 'text', 'text'], 'create_oauth_client exists');
select has_function('public', 'issue_oauth_access_token', array['text', 'text', 'text', 'timestamptz'], 'issue_oauth_access_token exists');
select has_function('public', 'publish_skill', array['uuid', 'text', 'text', 'text', 'text', 'text'], 'publish_skill exists');
select has_function('public', 'revoke_oauth_access_token', array['uuid', 'text'], 'revoke_oauth_access_token exists');

select finish();
rollback;
