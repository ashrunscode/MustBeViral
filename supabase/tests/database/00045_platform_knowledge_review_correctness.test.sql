begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values
  ('a9000000-0000-4000-8000-000000000001','authenticated','authenticated','review-owner@synthetic.example.test'),
  ('a9000000-0000-4000-8000-000000000002','authenticated','authenticated','review-editor@synthetic.example.test');
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Review regressions','review-regressions','review-ws','req')->>'workspace_id',true);

create function pg_temp.seed_brand(label text) returns void language plpgsql as $$
declare b uuid; s uuid;
begin
  b := (public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name',label,'slug',label),label,'req')->'record'->>'id')::uuid;
  insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,r2_key,captured_at,created_by)
    values(current_setting('test.ws')::uuid,b,'website','https_get','https://fixture.example.test/','synthetic-private-reference',statement_timestamp(),auth.uid()) returning id into s;
  perform app_private.ensure_knowledge_draft(current_setting('test.ws')::uuid,b,auth.uid());
  perform set_config('test.brand',b::text,true);
  perform set_config('test.source',s::text,true);
end $$;
create function pg_temp.item(k text,f text,v text,expiry text default null) returns jsonb language sql as $$
  select jsonb_build_object('kind',k,'field_key',f,'value_text',v,'status',case when v is null then 'unknown' else 'observed' end,
    'excerpt',coalesce(left(v,100),'No evidence'),'locator',f,'method','data_attribute','ends_at',expiry,'reusable',false);
$$;
create function pg_temp.extract(items jsonb,actor uuid default 'a9000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
  select public.record_brand_extraction(current_setting('test.source')::uuid,items,'review-regression',actor);
$$;
create function pg_temp.command(op text,extra jsonb default '{}') returns jsonb language sql as $$
  select public.platform_knowledge_command(op,jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')) || extra,gen_random_uuid()::text,'review-regression');
$$;
create function pg_temp.review() returns jsonb language sql as $$
  select public.platform_knowledge_query('get_knowledge_review',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')));
$$;
create function pg_temp.approve() returns jsonb language plpgsql as $$
declare r jsonb := pg_temp.review();
begin return pg_temp.command('approve_brand_version',jsonb_build_object('expected_version',r->'record'->'version','draft_hash',r->>'draft_hash')); end $$;
create function pg_temp.correct(k text,v text) returns jsonb language plpgsql as $$
declare r jsonb := pg_temp.review(); a jsonb;
begin
  select x into a from jsonb_array_elements(r->'current_assertions') x where x->>'field_key'=k order by (x->>'value_text' is distinct from v) desc limit 1;
  return pg_temp.command('correct_brand_assertion',jsonb_build_object('assertion_id',a->>'id','expected_version',r->'record'->'version','value_text',v,'excerpt','Operator correction'));
end $$;

select ok(to_regprocedure('public.record_brand_extraction(uuid,jsonb,text,uuid)') is not null,'machine completion requires an initiating actor');
set local role authenticated;
select is(pg_temp.error_of($$select public.record_brand_extraction(gen_random_uuid(),'[]','req','a9000000-0000-4000-8000-000000000001')$$),
  '42501:permission denied for function record_brand_extraction','authenticated cannot call actor-bound completion');
reset role;
set local role anon;
select is(pg_temp.error_of($$select public.record_brand_extraction(gen_random_uuid(),'[]','req','a9000000-0000-4000-8000-000000000001')$$),
  '42501:permission denied for function record_brand_extraction','anonymous cannot call actor-bound completion');
reset role;
set local role service_role;
select is(pg_temp.error_of($$select public.record_brand_extraction(gen_random_uuid(),'[]','req')$$),
  '42501:permission denied for function record_brand_extraction','legacy completion is not callable by the service role');
reset role;
select is(pg_temp.error_of($$select public.record_brand_extraction(gen_random_uuid(),'[]','req')$$),
  '42501:FORBIDDEN','legacy privileged reuse also fails closed');

select pg_temp.seed_brand('revocation');
select set_config('test.studio',public.platform_command('create_studio','{"name":"Review studio","slug":"review-studio"}','studio','req')->'record'->>'id',true);
select public.platform_command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a9000000-0000-4000-8000-000000000002','role','editor','expected_version',1),'member','req');
select set_config('test.grant',public.platform_command('grant_workspace_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'actions',jsonb_build_array('brand:read','brand:write')),'grant','req')->'record'->>'id',true);
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000002',true);
select is(pg_temp.command('extract_brand_knowledge',jsonb_build_object('source_id',current_setting('test.source')))->>'extract_pending','true','editor is authorized when extraction begins');
select set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',true);
select public.platform_command('revoke_workspace_access',jsonb_build_object('workspace_id',current_setting('test.ws'),'grant_id',current_setting('test.grant'),'expected_version',1),'revoke','req');
set local role service_role;
select is(pg_temp.error_of($$select pg_temp.extract(jsonb_build_array(pg_temp.item('fact','hours','Open 24 hours')),'a9000000-0000-4000-8000-000000000002')$$),
  'P0002:NOT_FOUND','revoked initiator cannot complete using the still-authorized source owner');
reset role;
select is(jsonb_array_length(pg_temp.review()->'current_assertions'),0,'revoked completion commits no assertions');
set local role service_role;
select is(pg_temp.extract(jsonb_build_array(pg_temp.item('fact','hours','Open 24 hours')))->>'extract_pending','false','authorized initiating owner can complete');
reset role;

select pg_temp.seed_brand('conflicts');
select pg_temp.extract(jsonb_build_array(pg_temp.item('fact','hours','Open 24 hours'),pg_temp.item('fact','hours','Closed Sundays')));
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='hours'),2,'real extraction preserves conflicting observations');
select is(pg_temp.error_of('select pg_temp.approve()'),'P0001:CONTRADICTORY_KNOWLEDGE','extraction-created contradiction cannot be approved');
select pg_temp.correct('hours','Closed Sundays');
select lives_ok('select pg_temp.approve()','explicit correction can align conflicting facts');
select set_config('test.count',(select count(*)::text from public.brand_assertions where brand_id=current_setting('test.brand')::uuid),true);
select pg_temp.extract(jsonb_build_array(pg_temp.item('fact','hours','Open 24 hours'),pg_temp.item('fact','hours','Closed Sundays')));
select is((select count(*)::integer from public.brand_assertions where brand_id=current_setting('test.brand')::uuid),current_setting('test.count')::integer,'delayed replay does not resurrect a corrected historical observation');

select pg_temp.seed_brand('offer-conflict');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offer','sale','Half price','2098-01-01T00:00:00Z'),pg_temp.item('offer','sale','Half price','2099-01-01T00:00:00Z')));
select is(pg_temp.error_of('select pg_temp.approve()'),'P0001:CONTRADICTORY_KNOWLEDGE','different expiry dates are a contradiction even with equal offer text');

select pg_temp.seed_brand('proposals');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offering','delivery','Pickup available'),pg_temp.item('language','language','en')));
select pg_temp.command('propose_brand_knowledge');
select set_config('test.approved',pg_temp.approve()::text,true);
select set_config('test.before',pg_temp.review()::text,true);
select pg_temp.correct('delivery','Drop-off only');
select is((select x->>'status' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'unknown','correction invalidates unsupported positioning');
select ok((select x->>'value_text' is null from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'invalidated proposal contains no stale claim');
select is((select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='voice'),
  (select x->>'id' from jsonb_array_elements(current_setting('test.before')::jsonb->'current_proposals') x where x->>'kind'='voice'),'unrelated proposal is preserved');
select isnt(pg_temp.review()->>'draft_hash',current_setting('test.before')::jsonb->>'draft_hash','invalidation changes the exact review hash');
select is(pg_temp.error_of($$select pg_temp.command('approve_brand_version',jsonb_build_object('expected_version',pg_temp.review()->'record'->'version','draft_hash',current_setting('test.before')::jsonb->>'draft_hash'))$$),
  'P0001:REVISION_CONFLICT','old proposal hash cannot approve the corrected review');
select is((select p->>'value_text' from public.brand_versions v cross join lateral jsonb_array_elements(v.snapshot->'proposals') p where v.id=(current_setting('test.approved')::jsonb->'record'->>'id')::uuid and p->>'kind'='positioning'),
  'Pickup available','approved historical snapshot remains immutable');
select pg_temp.command('propose_brand_knowledge');
select is((select x->>'value_text' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'Drop-off only','regeneration uses corrected evidence');
select pg_temp.correct('delivery',null);
select pg_temp.extract(jsonb_build_array(pg_temp.item('offering','another','New offering')));
select ok(exists(select 1 from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='delivery' and method='manual' and status='unknown'),'machine extraction preserves an explicitly cleared operator assertion');

select pg_temp.seed_brand('evidence-limits');
select pg_temp.extract((select jsonb_agg(pg_temp.item('offering','service-'||i,'Service '||i)) from generate_series(1,9) i));
select pg_temp.command('propose_brand_knowledge');
select is((select jsonb_array_length(x->'evidence_field_keys') from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),9,'all nine offering evidence keys survive proposal generation');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offering','offering',null)));
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='offering' and status='unknown'),0,'missing-kind placeholders cannot obscure known brand evidence');
select pg_temp.extract((select jsonb_agg(pg_temp.item('offering','service-'||i,'Service '||i)) from generate_series(10,40) i));
select set_config('test.before',pg_temp.review()::text,true);
select is(pg_temp.error_of($$select pg_temp.extract((select jsonb_agg(pg_temp.item('offering','service-'||i,'Service '||i)) from generate_series(41,50) i))$$),
  '22023:VALIDATION_FAILED','more than 50 current assertions fails atomically, including missing-kind placeholders');
select is(pg_temp.review(),current_setting('test.before')::jsonb,'overflow preserves the entire prior readable review');

select pg_temp.seed_brand('long-summary');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offering','first',repeat('a',4000)),pg_temp.item('offering','second',repeat('b',4000))));
select lives_ok($$select pg_temp.command('propose_brand_knowledge')$$,'oversized proposal does not fail the review');
select is((select x->>'status' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'unknown','oversized summary requires operator input');
select is((select sum(length(value_text))::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='offering'),8000,'original evidence is not truncated');
select pg_temp.seed_brand('unicode-summary');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offering','first',repeat('😀',2000)),pg_temp.item('offering','second',repeat('😀',2000))));
select pg_temp.command('propose_brand_knowledge');
select is((select x->>'status' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'unknown','summary bound uses the same Unicode units as the wire contract');

select pg_temp.seed_brand('long-answer');
select pg_temp.extract('[]');
select pg_temp.command('propose_brand_knowledge');
select pg_temp.command('ask_brand_knowledge_questions');
select lives_ok($$select pg_temp.command('answer_brand_knowledge_question',jsonb_build_object('question_id',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_questions') x where x->>'target_kind'='offering'),'expected_version',pg_temp.review()->'record'->'version','answer_text',repeat('a',4000)))$$,'4000-character assertion answer remains valid');
select is((select length(value_text) from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='offering'),4000,'full answer remains in the assertion');
select ok((select excerpt like '%Excerpt%' and length(excerpt)<=2000 from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='offering'),'short excerpt is explicitly identified');
select lives_ok($$select pg_temp.command('answer_brand_knowledge_question',jsonb_build_object('question_id',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_questions') x where x->>'target_kind'='audience'),'expected_version',pg_temp.review()->'record'->'version','answer_text',repeat('😀',2000)))$$,'4000 UTF-16-unit proposal answer remains valid');
select is((select length(value_text) from app_private.current_proposals(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='audience'),2000,'full Unicode answer remains in the proposal');
select set_config('test.before',pg_temp.review()::text,true);
select is(pg_temp.error_of($$select pg_temp.command('answer_brand_knowledge_question',jsonb_build_object('question_id',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_questions') x where x->>'target_kind'='voice'),'expected_version',pg_temp.review()->'record'->'version','answer_text',repeat('😀',4000)))$$),
  '22023:VALIDATION_FAILED','direct RPC cannot bypass the wire answer limit with supplementary Unicode');
select is(pg_temp.review(),current_setting('test.before')::jsonb,'invalid answer leaves the question and review unchanged');

select pg_temp.seed_brand('corroboration');
select pg_temp.extract(jsonb_build_array(pg_temp.item('fact','hours','Open daily')));
insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,r2_key,captured_at,created_by)
  values(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'website','https_get','https://other.example.test/','second-synthetic-source',statement_timestamp(),auth.uid());
select set_config('test.source',(select id::text from public.brand_sources where brand_id=current_setting('test.brand')::uuid and origin_url='https://other.example.test/'),true);
select pg_temp.extract(jsonb_build_array(pg_temp.item('fact','hours','Open daily')));
select is((select count(distinct source_id)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='hours'),2,'agreeing independent sources retain both provenance records');
select lives_ok('select pg_temp.approve()','corroborating identical observations do not create a false contradiction');
select app_private.supersede_kind_proposal((select d from public.brand_knowledge_drafts d where d.brand_id=current_setting('test.brand')::uuid),auth.uid(),'voice','corrected','Plain language','medium','["original"]','Original excerpt');
select app_private.supersede_kind_proposal((select d from public.brand_knowledge_drafts d where d.brand_id=current_setting('test.brand')::uuid),auth.uid(),'voice','corrected','Plain language','medium','["hours"]','Updated excerpt');
select is((select evidence_field_keys from app_private.current_proposals(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='voice'),'["hours"]'::jsonb,'equal proposal text still refreshes changed evidence');
select is((select excerpt from app_private.current_proposals(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='voice'),'Updated excerpt','equal proposal text still refreshes its excerpt');
select pg_temp.correct('hours','Open weekdays');
select is((select status from app_private.current_proposals(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='voice'),'unknown','an explicit evidence dependency invalidates even a manually corrected proposal');

select * from finish();
rollback;
