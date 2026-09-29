begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values
 ('ac000000-0000-4000-8000-000000000001','authenticated','authenticated','lifecycle-wash@synthetic.example.test'),
 ('ac000000-0000-4000-8000-000000000002','authenticated','authenticated','lifecycle-other@synthetic.example.test');
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Lifecycle','lifecycle','ws','req')->>'workspace_id',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','WashBodega','slug','washbodega'),'brand','req')->'record'->>'id',true);
create function pg_temp.scope() returns jsonb language sql as $$
 select jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'));
$$;
create function pg_temp.review() returns jsonb language sql as $$
 select public.platform_knowledge_query('get_knowledge_review',pg_temp.scope());
$$;
create function pg_temp.approve(p_key text) returns jsonb language sql as $$
 select public.platform_knowledge_command('approve_brand_version',pg_temp.scope()||jsonb_build_object('expected_version',pg_temp.review()->'record'->'version','draft_hash',pg_temp.review()->>'draft_hash'),p_key,'req');
$$;
create function pg_temp.pin(p_version uuid,p_key text) returns jsonb language sql as $$
 select public.platform_knowledge_command('pin_brand_version',pg_temp.scope()||jsonb_build_object('brand_version_id',p_version,'pin_key',p_key),p_key,'req');
$$;
create function pg_temp.exact() returns jsonb language sql as $$
 select pg_temp.scope()||jsonb_build_object('expected_version',pg_temp.review()->'record'->'version','draft_hash',pg_temp.review()->>'draft_hash');
$$;
insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,r2_key,captured_at,created_by)
 values(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'website','https_get','https://wash.synthetic.example.test/','synthetic-lifecycle-source',clock_timestamp(),auth.uid());
select set_config('test.source',(select id::text from public.brand_sources where brand_id=current_setting('test.brand')::uuid),true);
select set_config('test.expiry',(clock_timestamp()+interval '2 seconds')::text,true);
select public.record_brand_extraction(current_setting('test.source')::uuid,jsonb_build_array(
 jsonb_build_object('kind','offer','field_key','sale','value_text','WashBodega launch offer','status','observed','excerpt','WashBodega launch offer','locator','offer','method','data_attribute','ends_at',current_setting('test.expiry')::timestamptz,'reusable',false),
 jsonb_build_object('kind','fact','field_key','hours','value_text','Open daily','status','observed','excerpt','Open daily','locator','hours','method','data_attribute','ends_at',null,'reusable',false)
),'extract','ac000000-0000-4000-8000-000000000001');
select set_config('test.offer',(select id::text from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='offer'),true);
select set_config('test.version',pg_temp.approve('first-approval')->'record'->>'id',true);
select set_config('test.snapshot',(select snapshot::text from public.brand_versions where id=current_setting('test.version')::uuid),true);
select lives_ok($$select pg_temp.pin(current_setting('test.version')::uuid,'historical-campaign')$$,'unexpired approval can be pinned');
create function pg_temp.delayed_pin() returns jsonb language plpgsql as $$
begin
 perform pg_sleep(greatest(0,extract(epoch from current_setting('test.expiry')::timestamptz-clock_timestamp()))+0.05);
 return pg_temp.pin(current_setting('test.version')::uuid,'late-campaign');
end $$;
select is(pg_temp.error_of('select pg_temp.delayed_pin()'),'P0001:EXPIRED_OFFER','new pin checks real clock after a command delay');
select is(pg_temp.error_of($$select pg_temp.approve('stale-approval')$$),'P0001:EXPIRED_OFFER','expired draft cannot create later approval');
select lives_ok($$select pg_temp.pin(current_setting('test.version')::uuid,'historical-campaign')$$,'idempotent old pin replay remains historical');
select lives_ok($$select public.platform_knowledge_query('get_brand_version_pin',pg_temp.scope()||'{"pin_key":"historical-campaign"}')$$,'historical pin stays readable after expiry');
select is((select snapshot::text from public.brand_versions where id=current_setting('test.version')::uuid),current_setting('test.snapshot'),'expiry does not mutate old approval');
select is(jsonb_array_length(public.platform_knowledge_lifecycle_query('get_brand_knowledge_changes',pg_temp.scope())->'expired_baseline_assertion_ids'),1,'comparison flags expiry after approval');
select set_config('test.expiry_input',(pg_temp.exact()||jsonb_build_object('assertion_id',current_setting('test.offer'),'value_text',null,'ends_at',null,'excerpt','Offer has ended; withdraw from future content.'))::text,true);
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('review_expired_offer',current_setting('test.expiry_input')::jsonb||jsonb_build_object('draft_hash',repeat('0',64)),'stale-review','req')$$),'P0001:REVISION_CONFLICT','expiry review pins exact draft hash');
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('review_expired_offer',current_setting('test.expiry_input')::jsonb||'{"value_text":"Old offer without expiry"}','bad-renewal','req')$$),'P0001:EXPIRED_OFFER','expiry cannot be cleared to silently renew a stale offer');
select lives_ok($$select public.platform_knowledge_lifecycle_command('review_expired_offer',current_setting('test.expiry_input')::jsonb,'withdraw','req')$$,'operator explicitly withdraws expired offer');
select is((select count(*)::integer from public.brand_knowledge_reviews where brand_id=current_setting('test.brand')::uuid),1,'expiry decision is durably recorded once');
select lives_ok($$select public.platform_knowledge_lifecycle_command('review_expired_offer',current_setting('test.expiry_input')::jsonb,'withdraw','req')$$,'expiry review safely replays');
select is((select count(*)::integer from public.brand_knowledge_reviews where brand_id=current_setting('test.brand')::uuid),1,'replay does not duplicate decision');
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('review_expired_offer',current_setting('test.expiry_input')::jsonb||'{"excerpt":"Different input"}','withdraw','req')$$),'P0001:IDEMPOTENCY_CONFLICT','changed review input cannot reuse key');
select set_config('test.fresh_version',pg_temp.approve('withdrawn-approval')->'record'->>'id',true);
select lives_ok($$select pg_temp.pin(current_setting('test.fresh_version')::uuid,'fresh-campaign')$$,'reviewed withdrawal permits a newly approved version');
select is(pg_temp.error_of($$select pg_temp.pin(current_setting('test.version')::uuid,'old-again')$$),'P0001:EXPIRED_OFFER','reviewing draft never makes old expired approval reusable');

insert into public.brand_sources(workspace_id,brand_id,kind,method,origin_url,r2_key,captured_at,created_by)
 values(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'website','https_get','https://wash.synthetic.example.test/new','synthetic-lifecycle-source-2',clock_timestamp(),auth.uid());
select set_config('test.source2',(select id::text from public.brand_sources where brand_id=current_setting('test.brand')::uuid and origin_url='https://wash.synthetic.example.test/new'),true);
select public.record_brand_extraction(current_setting('test.source2')::uuid,
 '[{"kind":"fact","field_key":"hours","value_text":"Closed Sunday","status":"observed","excerpt":"Closed Sunday","locator":"hours","method":"data_attribute","ends_at":null,"reusable":false}]','second','ac000000-0000-4000-8000-000000000001');
select is(pg_temp.error_of($$select pg_temp.approve('conflicting')$$),'P0001:CONTRADICTORY_KNOWLEDGE','conflicting sources require operator review');
select set_config('test.conflict_input',(pg_temp.exact()||jsonb_build_object('kind','fact','field_key','hours','value_text','Closed Sunday','ends_at',null,'excerpt','Operator verified the current opening schedule.'))::text,true);
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',current_setting('test.conflict_input')::jsonb||'{"expected_version":1}','stale-conflict','req')$$),'P0001:REVISION_CONFLICT','stale conflict review cannot overwrite newer evidence');
select lives_ok($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',current_setting('test.conflict_input')::jsonb,'resolve','req')$$,'operator resolves complete exact-hash conflict group atomically');
select is((select count(*)::integer from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='fact' and field_key='hours' and status<>'unknown'),1,'only the explicit selected value remains active');
select is((select value_text from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where kind='fact' and field_key='hours' and status<>'unknown'),'Closed Sunday','selected value remains operator correction');
select is((select cardinality(before_assertion_ids) from public.brand_knowledge_reviews where review_kind='contradiction' and brand_id=current_setting('test.brand')::uuid),2,'review records all conflicting source assertion identities');
select is((select count(*)::integer from public.brand_assertions where brand_id=current_setting('test.brand')::uuid and kind='fact' and field_key='hours' and status='observed'),2,'original contradictory observations remain stored');
select lives_ok($$select pg_temp.approve('resolved-approval')$$,'resolved facts can be explicitly approved');
select is((select snapshot::text from public.brand_versions where id=current_setting('test.version')::uuid),current_setting('test.snapshot'),'conflict resolution does not change prior approved bytes');
select lives_ok($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',current_setting('test.conflict_input')::jsonb,'resolve','req')$$,'conflict resolution replay does not create extra revisions');
select is((select count(*)::integer from public.brand_knowledge_reviews where brand_id=current_setting('test.brand')::uuid),2,'both review events retained exactly once');

set local role authenticated;
select ok(not has_table_privilege('authenticated','public.brand_knowledge_reviews','insert'),'direct review insert denied');
select ok(not has_table_privilege('authenticated','public.brand_knowledge_reviews','update'),'direct review update denied');
select ok(not has_table_privilege('authenticated','public.brand_knowledge_reviews','delete'),'review deletion denied');
select is((select count(*)::integer from public.brand_knowledge_reviews),2,'authorized operator can read scoped decision evidence');
reset role;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::integer from public.brand_knowledge_reviews),0,'other tenant cannot read decisions');
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('resolve_brand_contradiction',current_setting('test.conflict_input')::jsonb,'resolve','req')$$),'P0002:NOT_FOUND','other tenant cannot invoke or replay conflict review');
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('review_expired_offer',current_setting('test.expiry_input')::jsonb,'withdraw','req')$$),'P0002:NOT_FOUND','other tenant cannot invoke or replay expiry review');
reset role;
select set_config('request.jwt.claim.sub','ac000000-0000-4000-8000-000000000001',true);
update public.workspace_memberships set status='revoked',revoked_at=clock_timestamp() where workspace_id=current_setting('test.ws')::uuid;
set local role authenticated;
select is(pg_temp.error_of($$select public.platform_knowledge_lifecycle_command('review_expired_offer',current_setting('test.expiry_input')::jsonb,'withdraw','req')$$),'P0002:NOT_FOUND','revocation denies an existing idempotent review result');
reset role;
select * from finish();
rollback;
