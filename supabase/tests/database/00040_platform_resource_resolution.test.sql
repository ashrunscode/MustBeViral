begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email,email_confirmed_at) values
  ('a5000000-0000-4000-8000-000000000001','authenticated','authenticated','resolution-owner@example.test',now()),
  ('a5000000-0000-4000-8000-000000000002','authenticated','authenticated','resolution-viewer@example.test',now());
set local role authenticated;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000001';
select set_config('test.ws',public.create_workspace('Legacy synthetic','resolution-legacy','ws','req')->>'workspace_id',true);
insert into public.projects(workspace_id,name,created_by) values(current_setting('test.ws')::uuid,'Legacy synthetic campaign',auth.uid()) returning set_config('test.project',id::text,true);
select is(public.platform_setup_query('resolve_project_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'project_id',current_setting('test.project')))->>'state','mapping_required','visible old project without explicit mapping requests recovery');
reset role;
select app_private.backfill_platform_identity(array[current_setting('test.ws')::uuid]);
set local role authenticated;
select set_config('test.studio',(select studio_id::text from public.platform_workspace_mappings where workspace_id=current_setting('test.ws')::uuid),true);
select set_config('test.brand',public.platform_setup_query('resolve_project_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'project_id',current_setting('test.project')))->>'brand_id',true);
select is(public.platform_setup_query('resolve_project_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'project_id',current_setting('test.project')))->>'state','mapped','old project resolves only after explicit bounded mapping');
select is(public.platform_setup_query('get_brand_draft',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')))->'record','null'::jsonb,'brand with no onboarding has explicit empty state');
select is(public.platform_onboarding_command('initialize_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')),'initialize','req')->'record'->>'brand_id',
  current_setting('test.brand'),'existing mapped brand gets draft without new tenant');
select is((select count(*)::integer from public.brands),1,'initialization preserves one existing brand');
select is(public.platform_setup_query('get_brand_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')))->>'workspace_owner','true','selected explicit studio grant reports owner settings capability');
select set_config('test.other',public.platform_command('create_studio','{"name":"Unrelated studio","slug":"resolution-other"}','other','req')->'record'->>'id',true);
select is(pg_temp.error_of($$select public.platform_setup_query('get_brand_access',jsonb_build_object('studio_id',current_setting('test.other'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')))$$),
  'P0002:NOT_FOUND','another studio membership does not authorize selected studio presentation');
select is(jsonb_array_length(public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.other')))->'items'),0,'empty unrelated studio does not absorb all owned brands');
select public.platform_command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a5000000-0000-4000-8000-000000000002','role','viewer','expected_version',1),'viewer','req');
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000002';
select is(jsonb_array_length(public.platform_setup_query('get_brand_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')))->'actions'),2,'viewer receives read actions only');
select is(pg_temp.error_of($$select public.platform_onboarding_command('initialize_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')),'viewer-init','req')$$),
  '42501:FORBIDDEN','viewer cannot initialize a draft');
select is(pg_temp.error_of($$select public.platform_setup_query('resolve_project_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'project_id',current_setting('test.project')))$$),
  'P0002:NOT_FOUND','studio read grant does not imply legacy execution access');
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000001';
select public.platform_command('archive_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'expected_version',1),'archive','req');
select is(jsonb_array_length(public.platform_setup_query('get_brand_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')))->'actions'),2,'archived brand presentation excludes write actions');
select is(public.platform_setup_query('get_brand_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')))->'brand'->>'status','archived','exact archived URL resolves recovery state');
select is(jsonb_array_length(public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio')))->'items'),0,'normal portfolio excludes archived brand');
select is(jsonb_array_length(public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio'),'include_archived',true))->'items'),1,'explicit archive list retains durable brand');
select * from finish();
rollback;
