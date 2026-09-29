begin;
select plan(4);

select has_function('public', 'verify_api_key', array['text'], 'verify_api_key exists');
select has_function('public', 'verify_oauth_access_token', array['text'], 'verify_oauth_access_token exists');
select has_table('public', 'api_keys', 'api_keys table exists');
select has_table('public', 'skill_versions', 'skill_versions table exists');

select finish();
rollback;
