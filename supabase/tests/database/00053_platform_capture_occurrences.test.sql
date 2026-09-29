begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values ('b0000000-0000-4000-8000-000000000001','authenticated','authenticated','occurrences@synthetic.example.test');
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Capture occurrences','capture-occurrences','ws','req')->>'workspace_id',true);
create function pg_temp.scope() returns jsonb language sql as $$ select jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')); $$;
create function pg_temp.changes() returns jsonb language sql as $$ select public.platform_knowledge_lifecycle_query('get_brand_knowledge_changes',pg_temp.scope()); $$;
create function pg_temp.exact() returns jsonb language sql as $$
 select pg_temp.scope()||jsonb_build_object('expected_version',v->'record'->'version','draft_hash',v->>'draft_hash') from (select public.platform_knowledge_query('get_knowledge_review',pg_temp.scope()) v) r;
$$;
create function pg_temp.capture(p_identity text,p_hash text,p_complete boolean default true) returns jsonb language plpgsql as $$
declare job jsonb; source_id uuid:=gen_random_uuid(); kind text:=current_setting('test.kind'); payload jsonb;
begin
 job:=public.platform_knowledge_command(
  case kind when 'website' then 'start_website_capture' else 'start_document_capture' end,
  pg_temp.scope()||case kind when 'website' then jsonb_build_object('url',p_identity) else jsonb_build_object('filename',p_identity,'media_type','text/plain','text_content',p_hash) end,
  gen_random_uuid()::text,'capture');
 if not p_complete then return job; end if;
 payload:=jsonb_build_object('source_id',source_id,'origin_url',case kind when 'website' then p_identity else '' end,
  'final_url',case kind when 'website' then p_identity else '' end,'media_type','text/plain','byte_size',1,
  'content_sha256',repeat(p_hash,64),'r2_key','brand-sources/'||current_setting('test.ws')||'/'||current_setting('test.brand')||'/'||source_id,
  'captured_at',clock_timestamp(),'candidates','[]'::jsonb);
 return public.record_brand_source_capture((job->'job'->>'id')::uuid,payload,'capture',1);
end $$;
create function pg_temp.extract(p_source uuid,p_known boolean default false) returns jsonb language sql as $$
 select public.record_brand_extraction(p_source,case when p_known then
 '[{"kind":"fact","field_key":"hours","value_text":"Open daily","status":"observed","excerpt":"Open daily","locator":"hours","method":"plaintext_labeled","ends_at":null,"reusable":false}]'::jsonb else '[]'::jsonb end,'extract','b0000000-0000-4000-8000-000000000001');
$$;
create function pg_temp.missing() returns integer language sql as $$
 select count(*)::integer from app_private.knowledge_missing_source_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid);
$$;

-- Exercise real machine capture deduplication for website origins.
select set_config('test.kind','website',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','website occurrences','slug','website'),'website','req')->'record'->>'id',true);
select set_config('test.a',pg_temp.capture('https://first.synthetic.example.test/','a')->'job'->>'source_id',true);
select pg_temp.extract(current_setting('test.a')::uuid,true);
select set_config('test.approved',public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),current_setting('test.kind')||':first','req')->'record'->>'id',true);
select set_config('test.snapshot',(select snapshot::text from public.brand_versions where id=current_setting('test.approved')::uuid),true);
select set_config('test.b',pg_temp.capture('https://first.synthetic.example.test/','b')->'job'->>'source_id',true);
select pg_temp.extract(current_setting('test.b')::uuid);
select is(pg_temp.missing(),1,'website: A to B missing claim is reviewable');
select set_config('test.return',pg_temp.capture('https://first.synthetic.example.test/','a')::text,true);
select is(current_setting('test.return')::jsonb->'job'->>'status','duplicate','website: A recapture deduplicates canonical bytes');
select is(current_setting('test.return')::jsonb->'job'->>'source_id',current_setting('test.a'),'website: duplicate points to original canonical A');
update public.brand_source_jobs set updated_at='2000-01-01T00:00:00Z' where id=(current_setting('test.return')::jsonb->'job'->>'id')::uuid;
select is(pg_temp.error_of($$update public.brand_source_jobs set completion_sequence=0 where id=(current_setting('test.return')::jsonb->'job'->>'id')::uuid$$),'55000:SOURCE_JOB_IDENTITY_IMMUTABLE','website: logical capture order is immutable');
select is(pg_temp.missing(),0,'website: A to B to A uses the last capture, not source creation');
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),0,'website: restored A has no stale B warning');
select is((select count(*)::integer from public.brand_sources where brand_id=current_setting('test.brand')::uuid),2,'website: occurrence tracking keeps byte deduplication');
select lives_ok($$select public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),current_setting('test.kind')||':restored','req')$$,'website: restored A can be newly approved');
select set_config('test.return_b',pg_temp.capture('https://first.synthetic.example.test/','b')::text,true);
select is(pg_temp.missing(),1,'website: cached B captured after approval creates a fresh review');
select is(pg_temp.changes()->'source_changes'->0->>'capture_job_id',current_setting('test.return_b')::jsonb->'job'->>'id','website: comparison identifies the exact new capture occurrence');
select is(pg_temp.changes()->'source_changes'->0->>'captured_at',(select to_jsonb(updated_at)#>>'{}' from public.brand_source_jobs where id=(current_setting('test.return_b')::jsonb->'job'->>'id')::uuid),'website: comparison time belongs to new duplicate capture');
select pg_temp.extract(current_setting('test.a')::uuid,true);
select is(pg_temp.missing(),1,'website: extraction replay cannot reorder captures');
select set_config('test.alias',pg_temp.capture('https://second.synthetic.example.test/','a')::text,true);
select is(current_setting('test.alias')::jsonb->'job'->>'source_id',current_setting('test.a'),'website: second origin shares canonical A');
select pg_temp.capture('https://second.synthetic.example.test/','b');
select is(pg_temp.changes()->'source_changes'->0->>'changed_origin_count','2','website: both origins survive canonical deduplication');
select pg_temp.capture('https://first.synthetic.example.test/','a');
select is(pg_temp.missing(),1,'website: restoring first origin cannot conceal missing claim at second');
select is(pg_temp.changes()->'source_changes'->0->>'changed_origin_count','1','website: summary counts only changed origins');
select pg_temp.capture('https://second.synthetic.example.test/','a');
select is(pg_temp.missing(),0,'website: restoring second origin resolves the remaining source gap');
select pg_temp.capture('https://unrelated.synthetic.example.test/','b');
select is(pg_temp.missing(),0,'website: unrelated matching bytes do not create an A-origin change');
select set_config('test.pending',pg_temp.capture('https://first.synthetic.example.test/','c',false)::text,true);
select is(pg_temp.missing(),0,'website: unfinished capture cannot become latest');
select public.fail_brand_source_job((current_setting('test.pending')::jsonb->'job'->>'id')::uuid,'SOURCE_INTERRUPTED','capture',1);
select is(pg_temp.missing(),0,'website: failed capture cannot become latest');
select set_config('test.c',pg_temp.capture('https://second.synthetic.example.test/','c')->'job'->>'source_id',true);
select is(pg_temp.missing(),0,'website: unextracted canonical bytes are not treated as absent facts');
select pg_temp.extract(current_setting('test.c')::uuid);
select is(pg_temp.missing(),1,'website: completed empty extraction is actionable');
select pg_temp.extract(current_setting('test.b')::uuid);
select is(pg_temp.changes()->'source_changes'->0->>'latest_source_id',current_setting('test.c'),'website: old extraction replay does not reorder the newer occurrence');
select lives_ok($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',pg_temp.exact()||'{"kind":"fact","field_key":"hours","value_text":null,"ends_at":null,"excerpt":"Withdraw hours until verified."}',current_setting('test.kind')||':withdraw','req')$$,'website: explicit operator review still resolves missing claim');
select lives_ok($$select public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),current_setting('test.kind')||':reviewed','req')$$,'website: reviewed source change can be approved');
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),0,'website: reviewed occurrence notices clear after new approval');
select is((select snapshot::text from public.brand_versions where id=current_setting('test.approved')::uuid),current_setting('test.snapshot'),'website: original approval bytes remain immutable');

-- Exercise real machine capture deduplication for document origins.
select set_config('test.kind','document',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','document occurrences','slug','document'),'document','req')->'record'->>'id',true);
select set_config('test.a',pg_temp.capture('first.txt','a')->'job'->>'source_id',true);
select pg_temp.extract(current_setting('test.a')::uuid,true);
select set_config('test.approved',public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),current_setting('test.kind')||':first','req')->'record'->>'id',true);
select set_config('test.snapshot',(select snapshot::text from public.brand_versions where id=current_setting('test.approved')::uuid),true);
select set_config('test.b',pg_temp.capture('first.txt','b')->'job'->>'source_id',true);
select pg_temp.extract(current_setting('test.b')::uuid);
select is(pg_temp.missing(),1,'document: A to B missing claim is reviewable');
select set_config('test.return',pg_temp.capture('first.txt','a')::text,true);
select is(current_setting('test.return')::jsonb->'job'->>'status','duplicate','document: A recapture deduplicates canonical bytes');
select is(current_setting('test.return')::jsonb->'job'->>'source_id',current_setting('test.a'),'document: duplicate points to original canonical A');
update public.brand_source_jobs set updated_at='2000-01-01T00:00:00Z' where id=(current_setting('test.return')::jsonb->'job'->>'id')::uuid;
select is(pg_temp.error_of($$update public.brand_source_jobs set completion_sequence=0 where id=(current_setting('test.return')::jsonb->'job'->>'id')::uuid$$),'55000:SOURCE_JOB_IDENTITY_IMMUTABLE','document: logical capture order is immutable');
select is(pg_temp.missing(),0,'document: A to B to A uses the last capture, not source creation');
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),0,'document: restored A has no stale B warning');
select is((select count(*)::integer from public.brand_sources where brand_id=current_setting('test.brand')::uuid),2,'document: occurrence tracking keeps byte deduplication');
select lives_ok($$select public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),current_setting('test.kind')||':restored','req')$$,'document: restored A can be newly approved');
select set_config('test.return_b',pg_temp.capture('first.txt','b')::text,true);
select is(pg_temp.missing(),1,'document: cached B captured after approval creates a fresh review');
select is(pg_temp.changes()->'source_changes'->0->>'capture_job_id',current_setting('test.return_b')::jsonb->'job'->>'id','document: comparison identifies the exact new capture occurrence');
select is(pg_temp.changes()->'source_changes'->0->>'captured_at',(select to_jsonb(updated_at)#>>'{}' from public.brand_source_jobs where id=(current_setting('test.return_b')::jsonb->'job'->>'id')::uuid),'document: comparison time belongs to new duplicate capture');
select pg_temp.extract(current_setting('test.a')::uuid,true);
select is(pg_temp.missing(),1,'document: extraction replay cannot reorder captures');
select set_config('test.alias',pg_temp.capture('second.txt','a')::text,true);
select is(current_setting('test.alias')::jsonb->'job'->>'source_id',current_setting('test.a'),'document: second origin shares canonical A');
select pg_temp.capture('second.txt','b');
select is(pg_temp.changes()->'source_changes'->0->>'changed_origin_count','2','document: both origins survive canonical deduplication');
select pg_temp.capture('first.txt','a');
select is(pg_temp.missing(),1,'document: restoring first origin cannot conceal missing claim at second');
select is(pg_temp.changes()->'source_changes'->0->>'changed_origin_count','1','document: summary counts only changed origins');
select pg_temp.capture('second.txt','a');
select is(pg_temp.missing(),0,'document: restoring second origin resolves the remaining source gap');
select pg_temp.capture('unrelated.txt','b');
select is(pg_temp.missing(),0,'document: unrelated matching bytes do not create an A-origin change');
select set_config('test.pending',pg_temp.capture('first.txt','c',false)::text,true);
select is(pg_temp.missing(),0,'document: unfinished capture cannot become latest');
select public.fail_brand_source_job((current_setting('test.pending')::jsonb->'job'->>'id')::uuid,'SOURCE_INTERRUPTED','capture',1);
select is(pg_temp.missing(),0,'document: failed capture cannot become latest');
select set_config('test.c',pg_temp.capture('second.txt','c')->'job'->>'source_id',true);
select is(pg_temp.missing(),0,'document: unextracted canonical bytes are not treated as absent facts');
select pg_temp.extract(current_setting('test.c')::uuid);
select is(pg_temp.missing(),1,'document: completed empty extraction is actionable');
select pg_temp.extract(current_setting('test.b')::uuid);
select is(pg_temp.changes()->'source_changes'->0->>'latest_source_id',current_setting('test.c'),'document: old extraction replay does not reorder the newer occurrence');
select lives_ok($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',pg_temp.exact()||'{"kind":"fact","field_key":"hours","value_text":null,"ends_at":null,"excerpt":"Withdraw hours until verified."}',current_setting('test.kind')||':withdraw','req')$$,'document: explicit operator review still resolves missing claim');
select lives_ok($$select public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),current_setting('test.kind')||':reviewed','req')$$,'document: reviewed source change can be approved');
select is(jsonb_array_length(pg_temp.changes()->'source_changes'),0,'document: reviewed occurrence notices clear after new approval');
select is((select snapshot::text from public.brand_versions where id=current_setting('test.approved')::uuid),current_setting('test.snapshot'),'document: original approval bytes remain immutable');
-- Cached sources retain current nonmatching assertions, so the Core command
-- skips extraction. Only the new occurrence changes the review evidence.
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Stale review','slug','stale-review'),'stale-review','req')->'record'->>'id',true);
create function pg_temp.extract_field(p_source uuid,p_field text) returns jsonb language sql as $$
 select public.record_brand_extraction(p_source,jsonb_build_array(jsonb_build_object('kind','fact','field_key',p_field,'value_text',p_field,
  'status','observed','excerpt',p_field,'locator',p_field,'method','plaintext_labeled','ends_at',null,'reusable',false)),
  'extract','b0000000-0000-4000-8000-000000000001');
$$;
select set_config('test.a',pg_temp.capture('review.txt','a')->'job'->>'source_id',true);
select pg_temp.extract(current_setting('test.a')::uuid,true);
select set_config('test.b',pg_temp.capture('cached-b.txt','b')->'job'->>'source_id',true);
select pg_temp.extract_field(current_setting('test.b')::uuid,'about_b');
select set_config('test.c',pg_temp.capture('cached-c.txt','c')->'job'->>'source_id',true);
select pg_temp.extract_field(current_setting('test.c')::uuid,'about_c');
select public.platform_knowledge_command('approve_brand_version',pg_temp.exact(),'stale-baseline','req');
select pg_temp.capture('review.txt','b');
select is(public.platform_knowledge_command('extract_brand_knowledge',pg_temp.scope()||jsonb_build_object('source_id',current_setting('test.b')),'cached-b','req')->>'extract_pending','false','cached B needs no extraction rerun');
select set_config('test.review_b',pg_temp.exact()::text,true);
select pg_temp.capture('review.txt','c');
select is(public.platform_knowledge_command('extract_brand_knowledge',pg_temp.scope()||jsonb_build_object('source_id',current_setting('test.c')),'cached-c','req')->>'extract_pending','false','cached C needs no extraction rerun');
select is(pg_temp.exact()->>'expected_version',current_setting('test.review_b')::jsonb->>'expected_version','duplicate recapture does not manufacture a new assertion revision');
select isnt(pg_temp.exact()->>'draft_hash',current_setting('test.review_b')::jsonb->>'draft_hash','available occurrence changes the exact review hash');
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',current_setting('test.review_b')::jsonb||'{"kind":"fact","field_key":"hours","value_text":null,"ends_at":null,"excerpt":"Reviewed cached B."}','stale-decision','req')$$),'P0001:REVISION_CONFLICT','review of cached B cannot submit after cached C replaces it');
select is(pg_temp.error_of($$select public.platform_knowledge_command('approve_brand_version',current_setting('test.review_b')::jsonb,'stale-approval','req')$$),'P0001:REVISION_CONFLICT','approval also binds available capture evidence');
select is((select count(*)::integer from public.brand_knowledge_reviews where brand_id=current_setting('test.brand')::uuid),0,'stale review creates no decision record');
select is((select value_text from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='hours'),'Open daily','stale review preserves the current claim');
select lives_ok($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',pg_temp.exact()||'{"kind":"fact","field_key":"hours","value_text":null,"ends_at":null,"excerpt":"Reviewed current cached C."}','fresh-decision','req')$$,'refreshed exact evidence permits the explicit decision');
select ok(not has_function_privilege('authenticated','app_private.latest_knowledge_source_captures(public.brand_sources)','execute'),'occurrence helper is private');
select ok(not has_sequence_privilege('authenticated','app_private.knowledge_event_sequence','usage'),'browser cannot assign logical evidence order');
select * from finish();
rollback;
