begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values
 ('ab000000-0000-4000-8000-000000000001','authenticated','authenticated','changes-wash@synthetic.example.test'),
 ('ab000000-0000-4000-8000-000000000002','authenticated','authenticated','changes-unpile@synthetic.example.test');
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('WashBodega changes','changes-wash','changes-ws','req')->>'workspace_id',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','WashBodega','slug','washbodega'),'brand','req')->'record'->>'id',true);
select set_config('test.empty',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Empty','slug','empty'),'empty','req')->'record'->>'id',true);
create function pg_temp.changes(p_version uuid default null) returns jsonb language sql as $$
 select public.platform_knowledge_lifecycle_query('get_brand_knowledge_changes',
   jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')) ||
   case when p_version is null then '{}'::jsonb else jsonb_build_object('brand_version_id',p_version) end);
$$;
create function pg_temp.group_for(p_field text) returns jsonb language sql as $$
 select g from jsonb_array_elements(pg_temp.changes()->'groups') g where g->>'field_key'=p_field;
$$;
select is(pg_temp.changes()->'baseline','null'::jsonb,'brand without approval has no invented baseline');
select is(pg_temp.changes()->'draft_version','null'::jsonb,'brand without draft remains explicitly empty');
select is(pg_temp.changes()->'groups','[]'::jsonb,'empty brand has no fabricated differences');
insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,r2_key,content_sha256,captured_at,created_by)
 values(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'website','https_get','https://wash.synthetic.example.test/services','synthetic-private-source-1',repeat('a',64),clock_timestamp(),auth.uid());
select set_config('test.source',(select id::text from public.brand_sources where brand_id=current_setting('test.brand')::uuid),true);
select public.record_brand_extraction(current_setting('test.source')::uuid,
 '[{"kind":"fact","field_key":"hours","value_text":"Open daily","status":"observed","excerpt":"Open daily","locator":"hours","method":"data_attribute","ends_at":null,"reusable":false},
   {"kind":"offering","field_key":"pickup","value_text":"WashBodega pickup","status":"observed","excerpt":"WashBodega pickup","locator":"pickup","method":"data_attribute","ends_at":null,"reusable":false}]',
 'changes-first','ab000000-0000-4000-8000-000000000001');
select is(pg_temp.group_for('hours')->>'change','added','unapproved source is an addition for review');
select set_config('test.review',public.platform_knowledge_query('get_knowledge_review',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')))::text,true);
select set_config('test.version',public.platform_knowledge_command('approve_brand_version',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'expected_version',current_setting('test.review')::jsonb->'record'->'version','draft_hash',current_setting('test.review')::jsonb->>'draft_hash'),'approve','req')->'record'->>'id',true);
select set_config('test.snapshot',(select snapshot::text from public.brand_versions where id=current_setting('test.version')::uuid),true);
select is(pg_temp.group_for('hours')->>'change','unchanged','new approval exactly matches current facts');
select is(pg_temp.group_for('hours')->>'conflicted','false','single observation has no conflict');
insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,r2_key,content_sha256,captured_at,created_by)
 values(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'website','https_get','https://wash.synthetic.example.test/services','synthetic-private-source-2',repeat('b',64),clock_timestamp(),auth.uid());
select set_config('test.source2',(select id::text from public.brand_sources where brand_id=current_setting('test.brand')::uuid and content_sha256=repeat('b',64)),true);
select public.record_brand_extraction(current_setting('test.source2')::uuid,
 '[{"kind":"fact","field_key":"hours","value_text":"Closed Sunday","status":"observed","excerpt":"Closed Sunday","locator":"hours","method":"data_attribute","ends_at":null,"reusable":false},
   {"kind":"offering","field_key":"pickup","value_text":"WashBodega pickup","status":"observed","excerpt":"WashBodega pickup","locator":"pickup","method":"data_attribute","ends_at":null,"reusable":false}]',
 'changes-second','ab000000-0000-4000-8000-000000000001');
select is(pg_temp.group_for('hours')->>'change','changed','recapture exposes changed fact for review');
select is(pg_temp.group_for('hours')->>'conflicted','true','conflicting recapture does not silently replace approved fact');
select is(pg_temp.group_for('pickup')->>'change','evidence_changed','independent equal observation is supporting evidence, not a changed fact');
select is(pg_temp.group_for('pickup')->>'conflicted','false','agreeing sources are not contradictory');
select is(jsonb_array_length(pg_temp.group_for('hours')->'baseline_assertions'),1,'approved side remains the original fact');
select is(jsonb_array_length(pg_temp.group_for('hours')->'current_assertions'),2,'current side retains both source observations');
select ok((pg_temp.group_for('hours')->'current_assertions') @> jsonb_build_array(jsonb_build_object('source_id',current_setting('test.source2'),'excerpt','Closed Sunday','method','data_attribute')),'difference retains source, excerpt and method');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.group_for('hours')->'current_assertions') a where a->>'captured_at' is null),'every difference retains capture time');
select is((select snapshot::text from public.brand_versions where id=current_setting('test.version')::uuid),current_setting('test.snapshot'),'recapture leaves immutable snapshot bytes unchanged');
select is(pg_temp.changes(current_setting('test.version')::uuid)->'baseline'->>'id',current_setting('test.version'),'exact permitted baseline can be selected');
select is(pg_temp.error_of('select pg_temp.changes(gen_random_uuid())'),'P0002:NOT_FOUND','forged baseline denied');
select ok(not has_function_privilege('authenticated','app_private.knowledge_changes_view(uuid,uuid,uuid)','execute'),'private comparison cannot bypass public authorization');

select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000002',true);
select set_config('test.other_ws',public.create_workspace('UnPile changes','changes-unpile','other-ws','req')->>'workspace_id',true);
select set_config('test.other_brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.other_ws'),'name','UnPile','slug','unpile'),'other-brand','req')->'record'->>'id',true);
set local role authenticated;
select is(pg_temp.error_of('select pg_temp.changes()'),'P0002:NOT_FOUND','other tenant cannot read WashBodega differences');
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_query('get_brand_knowledge_changes',jsonb_build_object('workspace_id',current_setting('test.other_ws'),'brand_id',current_setting('test.brand')))$$),'P0002:NOT_FOUND','forged parent/child pair denied');
select is(public.platform_knowledge_lifecycle_query('get_brand_knowledge_changes',jsonb_build_object('workspace_id',current_setting('test.other_ws'),'brand_id',current_setting('test.other_brand')))->'groups','[]'::jsonb,'UnPile does not inherit WashBodega observations');
reset role;
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
update public.workspace_memberships set status='revoked',revoked_at=clock_timestamp() where workspace_id=current_setting('test.ws')::uuid;
set local role authenticated;
select is(pg_temp.error_of('select pg_temp.changes()'),'P0002:NOT_FOUND','revoked owner cannot inspect previous differences');
reset role;
select set_config('request.jwt.claim.sub','',true);
select is(pg_temp.error_of('select pg_temp.changes()'),'28000:UNAUTHENTICATED','missing session denied');
select * from finish();
rollback;
