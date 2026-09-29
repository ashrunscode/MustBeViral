begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values ('ae000000-0000-4000-8000-000000000001','authenticated','authenticated','catalog-records@synthetic.example.test');
select set_config('request.jwt.claim.sub','ae000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Catalog records','catalog-records','ws','req')->>'workspace_id',true);
create function pg_temp.row(p_key text,p_value text,p_record integer) returns jsonb language sql as $$
 select jsonb_build_object('kind','offering','field_key',p_key,'value_text',p_value,'status',case when p_value is null then 'unknown' else 'observed' end,'excerpt',coalesce(p_value,'No value supplied.'),'locator','csv:record:'||p_record||';column:value','method','plaintext_labeled','ends_at',null,'reusable',false);
$$;
create function pg_temp.source(p_brand uuid) returns uuid language plpgsql as $$
declare identity uuid;
begin
 insert into public.brand_sources(workspace_id,brand_id,kind,method,media_type,r2_key,captured_at,created_by)
 values(current_setting('test.ws')::uuid,p_brand,'document','document_upload','text/csv','synthetic-catalog-'||gen_random_uuid(),clock_timestamp(),auth.uid()) returning id into identity;
 return identity;
end $$;
create function pg_temp.extract(p_source uuid,p_rows jsonb) returns jsonb language sql as $$
 select public.record_brand_extraction(p_source,p_rows,'req','ae000000-0000-4000-8000-000000000001');
$$;
select set_config('test.brand_a',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Known first','slug','known-first'),'known','req')->'record'->>'id',true);
select set_config('test.source_a',pg_temp.source(current_setting('test.brand_a')::uuid)::text,true);
select lives_ok($$select pg_temp.extract(current_setting('test.source_a')::uuid,jsonb_build_array(pg_temp.row('sku_a','Product A',2),pg_temp.row('sku_b',null,3),pg_temp.row('sku_c',null,4)))$$,'known then blank records import');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_a')::uuid) where kind='offering'),3,'every explicit same-kind row survives known-first ordering');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_a')::uuid) where field_key in ('sku_b','sku_c') and status='unknown' and value_text is null),2,'both blank keys retain unknown identity');
select set_config('test.brand_b',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Blank first','slug','blank-first'),'blank','req')->'record'->>'id',true);
select set_config('test.source_b',pg_temp.source(current_setting('test.brand_b')::uuid)::text,true);
select lives_ok($$select pg_temp.extract(current_setting('test.source_b')::uuid,jsonb_build_array(pg_temp.row('sku_b',null,2),pg_temp.row('sku_a','Product A',3),pg_temp.row('sku_c',null,4)))$$,'blank then known records import');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_b')::uuid) where kind='offering'),3,'blank-first ordering cannot replace another key');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_b')::uuid) where field_key in ('sku_b','sku_c') and status='unknown'),2,'both explicit blanks remain active');
select lives_ok($$select pg_temp.extract(pg_temp.source(current_setting('test.brand_b')::uuid),jsonb_build_array(pg_temp.row('sku_d','Product D',2)))$$,'later different-key source imports');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_b')::uuid) where field_key in ('sku_b','sku_c') and status='unknown'),2,'later known key does not consume an explicit unknown');
select lives_ok($$select pg_temp.extract(current_setting('test.source_b')::uuid,jsonb_build_array(pg_temp.row('sku_b',null,2),pg_temp.row('sku_a','Product A',3),pg_temp.row('sku_c',null,4)))$$,'source replay remains safe');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_b')::uuid) where kind='offering'),4,'source replay creates no extra explicit rows');
select set_config('test.brand_c',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Forty rows','slug','forty'),'forty','req')->'record'->>'id',true);
select lives_ok($$select pg_temp.extract(pg_temp.source(current_setting('test.brand_c')::uuid),(select jsonb_agg(pg_temp.row('sku'||n,'Product '||n,n+2)) from generate_series(0,39) n))$$,'all forty explicit records cross the machine boundary');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_c')::uuid) where kind='offering'),40,'forty products persist without truncation');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand_c')::uuid) where status='unknown'),5,'database adds only the five absent-kind placeholders');
select is(pg_temp.error_of($$select pg_temp.extract(pg_temp.source(current_setting('test.brand_c')::uuid),(select jsonb_agg(pg_temp.row('sku'||n,'Product '||n,n+2)) from generate_series(0,40) n))$$),'22023:VALIDATION_FAILED','forty-one input rows still fail the unchanged machine bound');
select * from finish();
rollback;
