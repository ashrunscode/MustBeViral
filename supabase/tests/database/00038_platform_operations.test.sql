begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create function pg_temp.command(op text, payload jsonb, key text) returns jsonb language sql as $$
  select public.platform_command(op,payload,key,'platform-operations-test');
$$;
insert into auth.users(id,aud,role,email) values
  ('a2000000-0000-4000-8000-000000000001','authenticated','authenticated','commands-owner@example.test'),
  ('a2000000-0000-4000-8000-000000000002','authenticated','authenticated','commands-editor@example.test');
set local role authenticated;
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000001';
select set_config('test.wb',public.create_workspace('WashBodega synthetic','commands-wb','wb-key','request-wb')->>'workspace_id',true);
select set_config('test.up',public.create_workspace('UnPile synthetic','commands-up','up-key','request-up')->>'workspace_id',true);
select set_config('test.studio',(pg_temp.command('create_studio','{"name":"Synthetic portfolio","slug":"commands-studio"}','studio')->'record'->>'id'),true);
select is(pg_temp.command('create_studio','{"name":"Synthetic portfolio","slug":"commands-studio"}','studio')->'record'->>'id',
  current_setting('test.studio'),'creation replays one durable studio');
select is(pg_temp.error_of($$select pg_temp.command('create_studio','{"name":"Changed","slug":"commands-studio"}','studio')$$),
  'P0001:IDEMPOTENCY_CONFLICT','changed payload with same key conflicts');
select is(pg_temp.error_of($$select pg_temp.command('create_studio','{"name":"Duplicate slug","slug":"commands-studio"}','other')$$),
  '23505:RESOURCE_CONFLICT','duplicate slug has deliberate conflict');
select is(pg_temp.error_of($$select pg_temp.command('create_studio','{"name":"Injected","slug":"injected","created_by":"a2000000-0000-4000-8000-000000000002"}','inject')$$),
  '22023:VALIDATION_FAILED','database rejects forged actor field even without shared handler');
select set_config('test.wb_brand',(pg_temp.command('create_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'name','WashBodega','slug','washbodega'),'brand-wb')->'record'->>'id'),true);
select set_config('test.up_brand',(pg_temp.command('create_brand',jsonb_build_object('workspace_id',current_setting('test.up'),'name','UnPile','slug','unpile'),'brand-up')->'record'->>'id'),true);
select is(public.platform_query('get_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand')))->'record'->>'name','WashBodega','reconnect query reads durable WashBodega');
select is(public.platform_query('get_brand',jsonb_build_object('workspace_id',current_setting('test.up'),'brand_id',current_setting('test.up_brand')))->'record'->>'name','UnPile','reconnect query reads durable UnPile');
select is(pg_temp.error_of($$select public.platform_query('get_brand',jsonb_build_object('workspace_id',current_setting('test.up'),'brand_id',current_setting('test.wb_brand')))$$),
  'P0002:NOT_FOUND','cross-workspace brand lookup hides resource');
select is(pg_temp.error_of($$select pg_temp.command('update_brand',jsonb_build_object('workspace_id',current_setting('test.up'),'brand_id',current_setting('test.wb_brand'),'name','Wrong tenant','slug','wrong','expected_version',1),'wrong')$$),
  'P0002:NOT_FOUND','cross-workspace brand mutation denied');
select set_config('test.location',(pg_temp.command('create_brand_location',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),
  'name','Synthetic service location','slug','location','time_zone','America/Chicago'),'location')->'record'->>'id'),true);
select is(pg_temp.error_of($$select pg_temp.command('create_brand_location',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),
  'name','Invalid time zone','slug','bad-tz','time_zone','Not/A_Zone'),'bad-tz')$$),'22023:VALIDATION_FAILED','invalid time zone rejected by database');
select is(public.platform_query('get_brand_location',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),'location_id',current_setting('test.location')))->'record'->>'time_zone',
  'America/Chicago','location persists time zone without fabricated opening hours');
select is(pg_temp.command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a2000000-0000-4000-8000-000000000002','role','editor','expected_version',1),'member')->'record'->>'version',
  '2','explicit studio member creation increments studio version');
select set_config('test.grant',(pg_temp.command('grant_workspace_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.wb'),
  'brand_id',current_setting('test.wb_brand'),'actions',jsonb_build_array('brand:read','brand:write','location:read','location:write')),'grant')->'record'->>'id'),true);
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000002';
select is(jsonb_array_length(public.platform_query('list_brands',jsonb_build_object('workspace_id',current_setting('test.wb')))->'items'),1,'editor reads only explicitly granted brand');
select is(pg_temp.error_of($$select public.platform_query('list_brands',jsonb_build_object('workspace_id',current_setting('test.up')))$$),'P0002:NOT_FOUND','UnPile remains hidden without its grant');
select is(pg_temp.command('update_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),'name','WashBodega draft','slug','washbodega','expected_version',1),'editor-update')->'record'->>'version',
  '2','editor with explicit brand write can edit');
select is(pg_temp.error_of($$select pg_temp.command('update_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),'name','Stale','slug','washbodega','expected_version',1),'stale')$$),
  'P0001:REVISION_CONFLICT','stale expected version rejected');
select is(pg_temp.error_of($$select pg_temp.command('create_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'name','Unauthorized new brand','slug','new'),'new-brand')$$),
  'P0002:NOT_FOUND','brand-scoped grant cannot create another brand');
select is(pg_temp.error_of($$select pg_temp.command('grant_workspace_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.wb'),'actions',jsonb_build_array('brand:read')),'forged-grant')$$),
  'P0002:NOT_FOUND','studio membership cannot issue workspace grants');
select is(pg_temp.error_of($$select public.platform_query('list_studio_members',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  '42501:FORBIDDEN','visible studio does not imply team administration');
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000001';
select is(pg_temp.command('revoke_workspace_access',jsonb_build_object('workspace_id',current_setting('test.wb'),'grant_id',current_setting('test.grant'),'expected_version',1),'revoke-grant')->'record'->>'status','revoked','owner can revoke exact grant');
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000002';
select is(pg_temp.error_of($$select pg_temp.command('update_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),'name','WashBodega draft','slug','washbodega','expected_version',1),'editor-update')$$),
  'P0002:NOT_FOUND','revocation checked before replaying earlier successful mutation');
select is(jsonb_array_length(public.platform_query('list_workspace_access_grants',jsonb_build_object('studio_id',current_setting('test.studio')))->'items'),0,'revoked grant excluded from studio query');
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000001';
select set_config('test.cursor',(public.platform_query('list_studios','{"limit":1}')->>'next_cursor'),true);
select pg_temp.command('create_studio','{"name":"Second synthetic portfolio","slug":"commands-second"}','second-studio');
select set_config('test.cursor',(public.platform_query('list_studios','{"limit":1}')->>'next_cursor'),true);
select ok(length(current_setting('test.cursor'))>0,'bounded page emits opaque cursor');
select is(jsonb_array_length(public.platform_query('list_studios',jsonb_build_object('limit',1,'cursor',current_setting('test.cursor')))->'items'),1,'cursor returns remaining studio without repeat');
select is(pg_temp.error_of($$select public.platform_query('list_brands',jsonb_build_object('workspace_id',current_setting('test.wb'),'cursor',current_setting('test.cursor')))$$),
  '22023:VALIDATION_FAILED','cursor bound to resource query');
select is(pg_temp.error_of($$select public.platform_query('list_studios','{"limit":101}')$$),'22023:VALIDATION_FAILED','overlarge page rejected');
select is(pg_temp.error_of($$select public.platform_query('list_studios','{"cursor":"bad"}')$$),'22023:VALIDATION_FAILED','malformed cursor rejected safely');
select is(pg_temp.command('archive_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),'expected_version',2),'archive-brand')->'record'->>'status','archived','archive preserves record');
select is(jsonb_array_length(public.platform_query('list_brands',jsonb_build_object('workspace_id',current_setting('test.wb')))->'items'),0,'normal list excludes archived brand');
select is(public.platform_query('get_brand',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand')))->'record'->>'status','archived','exact archived link remains resolvable');
select is(pg_temp.error_of($$select pg_temp.command('create_brand_location',jsonb_build_object('workspace_id',current_setting('test.wb'),'brand_id',current_setting('test.wb_brand'),'name','No','slug','no','time_zone','UTC'),'archived-parent')$$),
  'P0001:RESOURCE_ARCHIVED','archived parent cannot receive new locations');
select is(pg_temp.command('revoke_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a2000000-0000-4000-8000-000000000002','expected_version',2),'revoke-member')->'record'->>'version','3','membership revocation persists');
set local request.jwt.claim.sub='a2000000-0000-4000-8000-000000000002';
select is(pg_temp.error_of($$select public.platform_query('get_studio',jsonb_build_object('studio_id',current_setting('test.studio')))$$),'P0002:NOT_FOUND','revoked member loses studio lookup');
reset role;
select ok((select count(*) from public.studio_events)>0,'studio control-plane mutations audited');
select ok((select count(*) from public.audit_events where action like 'platform.%')>0,'tenant mutations use existing audit log');
select finish();
rollback;
