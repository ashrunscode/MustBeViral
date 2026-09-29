begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values ('af000000-0000-4000-8000-000000000001','authenticated','authenticated','source-changes@synthetic.example.test');
select set_config('request.jwt.claim.sub','af000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Source changes','recapture-diff','ws','req')->>'workspace_id',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','WashBodega','slug','washbodega'),'brand','req')->'record'->>'id',true);
create function pg_temp.scope() returns jsonb language sql as $$ select jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')); $$;
create function pg_temp.changes() returns jsonb language sql as $$ select public.platform_knowledge_lifecycle_query('get_brand_knowledge_changes',pg_temp.scope()); $$;
create function pg_temp.source(p_url text,p_hash text) returns uuid language plpgsql as $$
declare identity uuid;
begin
 insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,media_type,content_sha256,r2_key,captured_at,created_by)
 values(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'website','https_get',p_url,'text/html',repeat(p_hash,64),'synthetic-source-'||gen_random_uuid(),clock_timestamp(),auth.uid()) returning id into identity;
 return identity;
end $$;
create function pg_temp.extract(p_source uuid,p_rows jsonb) returns jsonb language sql as $$ select public.record_brand_extraction(p_source,p_rows,'req','af000000-0000-4000-8000-000000000001'); $$;
create function pg_temp.exact() returns jsonb language sql as $$
 select pg_temp.scope()||jsonb_build_object('expected_version',v->'record'->'version','draft_hash',v->>'draft_hash') from (select public.platform_knowledge_query('get_knowledge_review',pg_temp.scope()) v) r;
$$;
select set_config('test.original',pg_temp.source('https://wash.synthetic.example.test/','a')::text,true);
select pg_temp.extract(current_setting('test.original')::uuid,'[{"kind":"fact","field_key":"hours","value_text":"Open daily","status":"observed","excerpt":"Open daily","locator":"hours","method":"data_attribute","ends_at":null,"reusable":false}]');
select set_config('test.approved',public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),'approve','req')->'record'->>'id',true);
select set_config('test.snapshot',(select snapshot::text from public.brand_versions where id=current_setting('test.approved')::uuid),true);
select set_config('test.different',pg_temp.source('https://other.synthetic.example.test/','b')::text,true);
select pg_temp.extract(current_setting('test.different')::uuid,'[]');
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),0,'unrelated source cannot imply a recapture');
select set_config('test.new',pg_temp.source('https://wash.synthetic.example.test/','c')::text,true);
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),0,'capture without completed extraction is not disappearance evidence');
select pg_temp.extract(current_setting('test.new')::uuid,'[]');
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),1,'changed source bytes are exposed even without new assertions');
select is(pg_temp.changes()->'source_changes'->0->>'latest_source_id',current_setting('test.new'),'difference identifies authoritative latest extraction');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.changes()->'groups') g where g->>'field_key'='hours' and (g->>'source_missing')::boolean and (g->>'conflicted')::boolean),'disappeared claim requests review while retaining old evidence');
select is((select value_text from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='hours'),'Open daily','recapture never silently deletes or replaces approved fact');
select is(pg_temp.error_of($$select public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),'unreviewed','req')$$),'P0001:CONTRADICTORY_KNOWLEDGE','missing source claim cannot be newly approved without review');
select lives_ok($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',pg_temp.exact()||'{"kind":"fact","field_key":"hours","value_text":null,"ends_at":null,"excerpt":"Latest website no longer confirms hours; withdraw pending confirmation."}','withdraw','req')$$,'operator can explicitly withdraw disappeared claim');
select is((select count(*)::integer from app_private.knowledge_missing_source_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid)),0,'explicit decision clears the missing-claim blocker');
select lives_ok($$select public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),'reviewed','req')$$,'reviewed source changes can be approved');
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),0,'reviewed source change does not remain a new-source warning');
select is((select snapshot::text from public.brand_versions where id=current_setting('test.approved')::uuid),current_setting('test.snapshot'),'original snapshot remains byte-identical');
select ok(not has_function_privilege('authenticated','app_private.knowledge_missing_source_assertions(uuid,uuid)','execute'),'private disappearance helper cannot bypass authorization');
select * from finish();
rollback;
