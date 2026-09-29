begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email,email_confirmed_at) values
  ('a6000000-0000-4000-8000-000000000001','authenticated','authenticated','directory-owner@example.test',now()),
  ('a6000000-0000-4000-8000-000000000002','authenticated','authenticated','directory-editor@example.test',now()),
  ('a6000000-0000-4000-8000-000000000003','authenticated','authenticated','directory-viewer@example.test',now()),
  ('a6000000-0000-4000-8000-000000000004','authenticated','authenticated','directory-outsider@example.test',now()),
  ('a6000000-0000-4000-8000-000000000005','authenticated','authenticated','directory-other-owner@example.test',now());
set local role authenticated;
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000001';
select set_config('test.studio',public.platform_command('create_studio','{"name":"Directory studio","slug":"directory-studio"}','studio','req')->'record'->>'id',true);
select set_config('test.wb',public.platform_setup_command('start_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'name','WashBodega','slug','washbodega'),'wb','req')::text,true);
select set_config('test.ws',current_setting('test.wb')::jsonb->'brand'->>'workspace_id',true);
select set_config('test.br',current_setting('test.wb')::jsonb->'brand'->>'id',true);
select set_config('test.up',public.platform_setup_command('start_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'name','UnPile','slug','unpile'),'up','req')::text,true);
select is(public.platform_presentation_query('get_studio_access',jsonb_build_object('studio_id',current_setting('test.studio')))->>'role','owner','owner reads selected studio access');
select is(jsonb_array_length(public.platform_presentation_query('list_brand_studios',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br')))->'items'),1,'owner sees only studios they belong to for WashBodega');
select is(public.platform_presentation_query('list_studio_team',jsonb_build_object('studio_id',current_setting('test.studio')))->'items'->0->>'display_label','directory-owner@example.test','owner directory uses the verified email label');
select public.platform_command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a6000000-0000-4000-8000-000000000002','role','editor','expected_version',1),'editor','req');
select public.platform_command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a6000000-0000-4000-8000-000000000003','role','viewer','expected_version',2),'viewer','req');
select set_config('test.member',(select id::text from public.studio_memberships where studio_id=current_setting('test.studio')::uuid and user_id='a6000000-0000-4000-8000-000000000002'),true);
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000005';
select set_config('test.other',public.platform_command('create_studio','{"name":"Other directory studio","slug":"directory-other"}','other','req')->'record'->>'id',true);
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000001';
select public.platform_command('grant_workspace_access',jsonb_build_object('workspace_id',current_setting('test.ws'),'studio_id',current_setting('test.other'),'brand_id',current_setting('test.br'),'actions',jsonb_build_array('brand:read')),'foreign-grant','req');
select is(jsonb_array_length(public.platform_presentation_query('list_brand_studios',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br')))->'items'),1,'grant to a studio the caller does not belong to is not listed');
select is(pg_temp.error_of($$select public.platform_presentation_query('list_brand_studios',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.up')::jsonb->'brand'->>'id'))$$),
  'P0002:NOT_FOUND','forged parent brand pair is hidden');
select is(pg_temp.error_of($$select public.platform_presentation_query('get_studio_access',jsonb_build_object('studio_id',current_setting('test.other')))$$),
  'P0002:NOT_FOUND','foreign studio access is hidden');
select set_config('test.cursor',public.platform_presentation_query('list_studio_team',jsonb_build_object('studio_id',current_setting('test.studio'),'limit',1))->>'next_cursor',true);
select is(jsonb_array_length(public.platform_presentation_query('list_studio_team',jsonb_build_object('studio_id',current_setting('test.studio'),'limit',1,'cursor',current_setting('test.cursor')))->'items'),1,'team pagination has no duplicate first page');
select is(pg_temp.error_of($$select public.platform_presentation_query('list_brand_studios',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br'),'cursor',current_setting('test.cursor')))$$),
  '22023:VALIDATION_FAILED','cursor cannot cross operation or resource scope');
select is(pg_temp.error_of($$select public.platform_presentation_query('list_studio_team',jsonb_build_object('studio_id',current_setting('test.studio'),'limit',101))$$),
  '22023:VALIDATION_FAILED','page size is capped at the database boundary');
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000002';
select is(public.platform_presentation_query('get_studio_access',jsonb_build_object('studio_id',current_setting('test.studio')))->>'role','editor','editor reads selected studio role');
select is(pg_temp.error_of($$select public.platform_presentation_query('list_studio_team',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  '42501:FORBIDDEN','editor cannot enumerate teammate email identities');
select is(app_private.platform_team_label(current_setting('test.member')::uuid),null,'direct helper call does not return email to a non-owner');
select is(jsonb_array_length(public.platform_presentation_query('list_brand_studios',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br')))->'items'),1,'editor lists only the studio they can use');
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000003';
select is(public.platform_presentation_query('get_studio_access',jsonb_build_object('studio_id',current_setting('test.studio')))->>'role','viewer','viewer reads selected studio role');
select is(pg_temp.error_of($$select public.platform_presentation_query('list_studio_team',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  '42501:FORBIDDEN','viewer cannot list studio emails');
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000004';
select is(pg_temp.error_of($$select public.platform_presentation_query('get_studio_access',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  'P0002:NOT_FOUND','unrelated caller cannot probe studio access');
select is(pg_temp.error_of($$select public.platform_presentation_query('list_brand_studios',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br')))$$),
  'P0002:NOT_FOUND','unrelated caller cannot enumerate brand studio contexts');
select is(app_private.platform_team_label(current_setting('test.member')::uuid),null,'outsider helper call returns no identity');
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000005';
select is(jsonb_array_length(public.platform_presentation_query('list_brand_studios',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br')))->'items'),1,'other studio owner sees only their granted studio');
select is(pg_temp.error_of($$select public.platform_presentation_query('list_studio_team',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  'P0002:NOT_FOUND','other studio owner cannot read this studio directory');
set local request.jwt.claim.sub='';
select is(pg_temp.error_of($$select public.platform_presentation_query('get_studio_access',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  '28000:UNAUTHENTICATED','anonymous presentation query is denied');
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000001';
select public.platform_command('revoke_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a6000000-0000-4000-8000-000000000002','expected_version',3),'revoke-editor','req');
set local request.jwt.claim.sub='a6000000-0000-4000-8000-000000000002';
select is(pg_temp.error_of($$select public.platform_presentation_query('get_studio_access',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  'P0002:NOT_FOUND','revoked membership cannot keep presentation access');
select is(app_private.platform_team_label(current_setting('test.member')::uuid),null,'revoked member cannot read directory labels');
select is(pg_temp.error_of($$select public.platform_presentation_query('missing',jsonb_build_object('studio_id',current_setting('test.studio')))$$),
  '22023:VALIDATION_FAILED','unknown presentation operation fails closed');
select * from finish();
rollback;
