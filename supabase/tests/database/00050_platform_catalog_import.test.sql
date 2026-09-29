begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values
 ('ad000000-0000-4000-8000-000000000001','authenticated','authenticated','catalog-wash@synthetic.example.test'),
 ('ad000000-0000-4000-8000-000000000002','authenticated','authenticated','catalog-unpile@synthetic.example.test');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('WashBodega catalog','catalog-wash','ws','req')->>'workspace_id',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','WashBodega','slug','washbodega'),'brand','req')->'record'->>'id',true);
select set_config('test.input',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'filename','catalog.csv','media_type','text/csv','text_content',E'kind,field_key,value\nfact,hours,WashBodega opens daily')::text,true);
create function pg_temp.import(p_key text default 'catalog',p_patch jsonb default '{}') returns jsonb language sql as $$
 select public.platform_knowledge_lifecycle_command('import_brand_catalog',current_setting('test.input')::jsonb||p_patch,p_key,'req');
$$;
select set_config('test.job',pg_temp.import()->'job'->>'id',true);
select is(pg_temp.import()->'job'->>'id',current_setting('test.job'),'same input replays the acquired import job');
select is(pg_temp.import()->'job'->>'kind','document','catalog reuses the document job domain');
select is(pg_temp.import()->'job'->>'media_type','text/csv','declared CSV is retained');
select is(pg_temp.error_of($$select pg_temp.import('catalog','{"text_content":"changed"}')$$),'P0001:IDEMPOTENCY_CONFLICT','changed bytes cannot reuse an import key');
select is(pg_temp.error_of($$select pg_temp.import('extra','{"approved":true}')$$),'22023:VALIDATION_FAILED','import cannot manufacture approval');
select is(pg_temp.error_of($$select pg_temp.import('pdf','{"media_type":"application/pdf"}')$$),'22023:SOURCE_UNSUPPORTED','PDF remains unsupported');
select is(pg_temp.error_of($$select pg_temp.import('large',jsonb_build_object('text_content',repeat('x',32769)))$$),'22023:VALIDATION_FAILED','catalog text is bounded');
select isnt(public.platform_knowledge_command('start_document_capture',current_setting('test.input')::jsonb,'catalog','req')->'job'->>'id',current_setting('test.job'),'ordinary upload cannot collide with catalog import identity');
select set_config('test.source',gen_random_uuid()::text,true);
select set_config('test.payload',jsonb_build_object('source_id',current_setting('test.source'),'origin_url','','final_url','','media_type','text/csv','byte_size',52,'content_sha256',repeat('c',64),'r2_key','brand-sources/'||current_setting('test.ws')||'/'||current_setting('test.brand')||'/'||current_setting('test.source'),'captured_at',clock_timestamp(),'candidates','[]'::jsonb)::text,true);
select lives_ok($$select public.record_brand_source_capture(current_setting('test.job')::uuid,current_setting('test.payload')::jsonb,'req',1)$$,'owned CSV capture completion persists private source identity');
select is(pg_temp.import()->'job'->>'status','captured','replay discovers completed capture for extraction recovery');
select is((select media_type from public.brand_sources where id=current_setting('test.source')::uuid),'text/csv','source records the verified media type');
select is((select content_sha256 from public.brand_sources where id=current_setting('test.source')::uuid),repeat('c',64),'source retains content hash');
select is((select count(*)::integer from public.brand_versions where brand_id=current_setting('test.brand')::uuid),0,'import does not create approved brand versions');
select is((select count(*)::integer from public.brand_assertions where brand_id=current_setting('test.brand')::uuid),0,'capture never fabricates typed assertions before extraction');
select lives_ok($$select public.record_brand_extraction(current_setting('test.source')::uuid,
 '[{"kind":"fact","field_key":"hours","value_text":"WashBodega opens daily","status":"observed","excerpt":"WashBodega opens daily","locator":"csv:record:2;column:value","method":"plaintext_labeled","ends_at":null,"reusable":false},
 {"kind":"offering","field_key":"catalog_price","value_text":null,"status":"unknown","excerpt":"Unknown catalog price","locator":"csv:record:3;column:value","method":"plaintext_labeled","ends_at":null,"reusable":false}]','extract','ad000000-0000-4000-8000-000000000001')$$,'actor-bound extraction persists unapproved typed catalog facts');
select is((select count(*)::integer from public.brand_assertions where brand_id=current_setting('test.brand')::uuid and field_key='catalog_price' and status='unknown' and value_text is null),1,'missing catalog value remains unknown');
select ok((select bool_and(not reusable) from public.brand_assertions where brand_id=current_setting('test.brand')::uuid),'catalog import never creates reusable creative assets');
select is((select locator from public.brand_assertions where brand_id=current_setting('test.brand')::uuid and field_key='hours'),'csv:record:2;column:value','assertion retains CSV record provenance');
select set_config('test.job2',pg_temp.import('same-bytes')->'job'->>'id',true);
select is(public.record_brand_source_capture(current_setting('test.job2')::uuid,current_setting('test.payload')::jsonb,'req',1)->'job'->>'status','duplicate','identical verified bytes deduplicate within the brand');
select is((select count(*)::integer from public.brand_sources where brand_id=current_setting('test.brand')::uuid),1,'same bytes have one canonical source');
select ok(not has_function_privilege('authenticated','public.record_brand_source_capture(uuid,jsonb,text,integer)','execute'),'browser cannot forge capture completion');
select ok(not has_function_privilege('authenticated','public.record_brand_extraction(uuid,jsonb,text,uuid)','execute'),'browser cannot forge extraction completion');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
select set_config('test.other_ws',public.create_workspace('UnPile catalog','catalog-unpile','other-ws','req')->>'workspace_id',true);
select set_config('test.other_brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.other_ws'),'name','UnPile','slug','unpile'),'other-brand','req')->'record'->>'id',true);
set local role authenticated;
select is(pg_temp.error_of('select pg_temp.import()'),'P0002:NOT_FOUND','other tenant cannot replay import');
select is(pg_temp.error_of($$select pg_temp.import('forged',jsonb_build_object('workspace_id',current_setting('test.other_ws')))$$),'P0002:NOT_FOUND','forged parent with another tenant brand fails');
select is((select count(*)::integer from public.brand_sources),0,'source RLS prevents cross-tenant catalog discovery');
select is((select count(*)::integer from public.brand_assertions),0,'assertion RLS prevents cross-tenant facts');
reset role;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
update public.workspace_memberships set status='revoked',revoked_at=clock_timestamp() where workspace_id=current_setting('test.ws')::uuid;
set local role authenticated;
select is(pg_temp.error_of('select pg_temp.import()'),'P0002:NOT_FOUND','revocation denies previously completed import replay');
reset role;
select set_config('request.jwt.claim.sub','',true);
select is(pg_temp.error_of('select pg_temp.import()'),'28000:UNAUTHENTICATED','unauthenticated import is denied');
select * from finish();
rollback;
