begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values
  ('aa000000-0000-4000-8000-000000000001','authenticated','authenticated','machine-owner@synthetic.example.test'),
  ('aa000000-0000-4000-8000-000000000002','authenticated','authenticated','machine-editor@synthetic.example.test'),
  ('aa000000-0000-4000-8000-000000000003','authenticated','authenticated','machine-other@synthetic.example.test');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Machine actor','machine-actor','machine-ws','req')->>'workspace_id',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Granted','slug','granted'),'brand','req')->'record'->>'id',true);
select set_config('test.other_brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Other','slug','other'),'other-brand','req')->'record'->>'id',true);
select set_config('test.studio',public.platform_command('create_studio','{"name":"Machine studio","slug":"machine-studio"}','studio','req')->'record'->>'id',true);
select public.platform_command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','aa000000-0000-4000-8000-000000000002','role','editor','expected_version',1),'member','req');
select set_config('test.grant',public.platform_command('grant_workspace_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'actions',jsonb_build_array('brand:read','brand:write')),'grant','req')->'record'->>'id',true);
insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,r2_key,captured_at,created_by)
  values(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'website','https_get','https://fixture.example.test/','synthetic-private-reference',statement_timestamp(),auth.uid());
select set_config('test.source',(select id::text from public.brand_sources where brand_id=current_setting('test.brand')::uuid),true);
select app_private.ensure_knowledge_draft(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,auth.uid());
create function pg_temp.extract(actor uuid default 'aa000000-0000-4000-8000-000000000002') returns jsonb language sql as $$
  select public.record_brand_extraction(current_setting('test.source')::uuid,
    '[{"kind":"fact","field_key":"hours","value_text":"Open daily","status":"observed","excerpt":"Open daily","locator":"hours","method":"data_attribute","ends_at":null,"reusable":false}]',
    'machine-actor-regression',actor);
$$;
create function pg_temp.can_write(brand uuid default null) returns boolean language sql as $$
  select app_private.platform_can_for('aa000000-0000-4000-8000-000000000002',current_setting('test.ws')::uuid,coalesce(brand,current_setting('test.brand')::uuid),'brand:write');
$$;
create function pg_temp.replace_grant(actions text[], issuer uuid default 'aa000000-0000-4000-8000-000000000001') returns void language plpgsql as $$
declare prior public.workspace_access_grants%rowtype; next_id uuid;
begin
  update public.workspace_access_grants set status='revoked',revoked_at=statement_timestamp()
    where id=current_setting('test.grant')::uuid returning * into prior;
  insert into public.workspace_access_grants(workspace_id,studio_id,brand_id,owner_membership_id,granted_by,actions)
    values(prior.workspace_id,prior.studio_id,prior.brand_id,prior.owner_membership_id,issuer,actions) returning id into next_id;
  perform set_config('test.grant',next_id::text,true);
end $$;

-- Initial browser command uses the editor identity; actual Core completion has no operator subject.
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
select is(public.platform_knowledge_command('extract_brand_knowledge',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'source_id',current_setting('test.source')),'extract','req')->>'extract_pending','true','editor can start extraction');
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select ok(auth.uid() is null,'machine credential has no ambient operator identity');
select lives_ok('select pg_temp.extract()','active delegated editor can complete under a subjectless service credential');
select is(pg_temp.error_of($$select pg_temp.extract('aa000000-0000-4000-8000-000000000003')$$),'P0002:NOT_FOUND','unrelated actor cannot use the service credential');
select is(pg_temp.error_of('select pg_temp.extract(null)'),'22023:VALIDATION_FAILED','null initiating actor fails closed');
reset role;
select is((select created_by from public.brand_assertions where brand_id=current_setting('test.brand')::uuid limit 1),'aa000000-0000-4000-8000-000000000002'::uuid,'stored assertion names the editor, not the source owner or machine');
select set_config('test.assertion_count',(select count(*)::text from public.brand_assertions where brand_id=current_setting('test.brand')::uuid),true);
select ok(pg_temp.can_write(),'actor-explicit helper allows current editor');
select ok(not pg_temp.can_write(current_setting('test.other_brand')::uuid),'brand-scoped grant cannot write another brand');
select ok(not app_private.platform_can_for('aa000000-0000-4000-8000-000000000002',gen_random_uuid(),current_setting('test.brand')::uuid,'brand:write'),'forged workspace cannot reuse a real brand grant');
select ok(not app_private.platform_can_for('aa000000-0000-4000-8000-000000000002',current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'billing:write'),'unknown action is denied');
select ok(not app_private.platform_grant_current(current_setting('test.grant')::uuid),'authenticated RLS helper remains subject-bound');
select ok(not has_function_privilege('authenticated','app_private.platform_can_for(uuid,uuid,uuid,text)','execute'),'authenticated cannot call the actor-explicit private helper');
select ok(not has_function_privilege('service_role','app_private.platform_can_for(uuid,uuid,uuid,text)','execute'),'service role cannot call the actor-explicit helper directly');

update public.studio_memberships set role='viewer' where user_id='aa000000-0000-4000-8000-000000000002';
select ok(not pg_temp.can_write(),'viewer cannot complete writes');
select ok(app_private.platform_can_for('aa000000-0000-4000-8000-000000000002',current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'brand:read'),'viewer retains only the granted read action');
set local role service_role;
select is(pg_temp.error_of('select pg_temp.extract()'),'P0002:NOT_FOUND','downgraded editor cannot replay completion');
reset role;
update public.studio_memberships set role='editor',status='revoked',revoked_at=statement_timestamp() where user_id='aa000000-0000-4000-8000-000000000002';
select ok(not pg_temp.can_write(),'revoked studio member is denied');
update public.studio_memberships set status='active',revoked_at=null where user_id='aa000000-0000-4000-8000-000000000002';
select pg_temp.replace_grant(array['brand:read']);
select ok(not pg_temp.can_write(),'read-only grant cannot complete writes');
select pg_temp.replace_grant(array['brand:read','brand:write']);
update public.workspace_access_grants set status='revoked',revoked_at=statement_timestamp() where id=current_setting('test.grant')::uuid;
set local role service_role;
select is(pg_temp.error_of('select pg_temp.extract()'),'P0002:NOT_FOUND','revoked grant cannot replay completion');
reset role;
update public.workspace_access_grants set status='active',revoked_at=null where id=current_setting('test.grant')::uuid;
update public.studios set status='archived' where id=current_setting('test.studio')::uuid;
select ok(not pg_temp.can_write(),'archived studio is denied');
update public.studios set status='active' where id=current_setting('test.studio')::uuid;
update public.brands set status='archived' where id=current_setting('test.brand')::uuid;
select ok(not pg_temp.can_write(),'archived brand is denied');
update public.brands set status='active' where id=current_setting('test.brand')::uuid;
update public.workspaces set status='suspended' where id=current_setting('test.ws')::uuid;
select ok(not pg_temp.can_write(),'suspended workspace is denied');
update public.workspaces set status='active' where id=current_setting('test.ws')::uuid;
select pg_temp.replace_grant(array['brand:read','brand:write'],'aa000000-0000-4000-8000-000000000003');
select ok(not pg_temp.can_write(),'grant issuer must still match the owner membership');
select pg_temp.replace_grant(array['brand:read','brand:write']);
select ok(pg_temp.can_write(),'all restored current grant requirements allow the editor again');
update public.workspace_memberships set status='revoked',revoked_at=statement_timestamp() where workspace_id=current_setting('test.ws')::uuid and user_id='aa000000-0000-4000-8000-000000000001';
select ok(not pg_temp.can_write(),'revoked granting owner is denied');
update public.workspace_memberships set status='active',revoked_at=null where workspace_id=current_setting('test.ws')::uuid and user_id='aa000000-0000-4000-8000-000000000001';
select ok(not pg_temp.can_write(),'restoring owner membership does not revive revoked grants');
select is((select count(*)::integer from public.brand_assertions where brand_id=current_setting('test.brand')::uuid),current_setting('test.assertion_count')::integer,'denied or duplicate completions add no assertions or unknown placeholders');
select * from finish();
rollback;
