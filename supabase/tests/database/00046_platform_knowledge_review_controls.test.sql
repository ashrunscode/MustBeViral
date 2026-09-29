-- Setup is shared in shape with 00045; each file owns a rolled-back synthetic workspace.
begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values
  ('aa000000-0000-4000-8000-000000000001','authenticated','authenticated','controls-owner@synthetic.example.test'),
  ('aa000000-0000-4000-8000-000000000002','authenticated','authenticated','controls-editor@synthetic.example.test');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Review controls','review-controls','controls-ws','req')->>'workspace_id',true);
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
create function pg_temp.extract(items jsonb) returns jsonb language sql as $$
  select public.record_brand_extraction(current_setting('test.source')::uuid,items,'controls-regression',auth.uid());
$$;
create function pg_temp.command(op text,extra jsonb default '{}', idem text default null) returns jsonb language sql as $$
  select public.platform_knowledge_command(op,jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')) || extra,coalesce(idem,gen_random_uuid()::text),'controls-regression');
$$;
create function pg_temp.review() returns jsonb language sql as $$
  select public.platform_knowledge_query('get_knowledge_review',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand')));
$$;
create function pg_temp.approve() returns jsonb language plpgsql as $$
declare r jsonb := pg_temp.review();
begin return pg_temp.command('approve_brand_version',jsonb_build_object('expected_version',r->'record'->'version','draft_hash',r->>'draft_hash')); end $$;
create function pg_temp.proposal_input(k text,v text) returns jsonb language sql as $$
  select jsonb_build_object('proposal_id',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'=k),
    'expected_version',pg_temp.review()->'record'->'version','value_text',v,'excerpt','Operator checked the evidence');
$$;

select pg_temp.seed_brand('question-history');
select pg_temp.extract('[]');
select pg_temp.command('propose_brand_knowledge');
select pg_temp.command('ask_brand_knowledge_questions');
do $$declare i integer; q record;
begin for i in 1..5 loop
  for q in select x from jsonb_array_elements(pg_temp.review()->'current_questions') x where x->>'target_kind' in ('voice','audience','positioning') and x->>'status'='open' loop
    perform pg_temp.command('answer_brand_knowledge_question',jsonb_build_object('question_id',q.x->>'id','expected_version',pg_temp.review()->'record'->'version','answer_text','Reviewed answer '||i));
  end loop;
  perform pg_temp.command('propose_brand_knowledge');
  perform pg_temp.command('ask_brand_knowledge_questions');
end loop; end $$;
select is((select count(*)::integer from public.brand_knowledge_questions where brand_id=current_setting('test.brand')::uuid),24,'all 24 historical question rows remain stored');
select is(jsonb_array_length(pg_temp.review()->'current_questions'),9,'review projects one current question per target after repeated answers');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.review()->'current_questions') q where q->>'status'='open'),9,'all current open questions are visible');
select pg_temp.command('answer_brand_knowledge_question',jsonb_build_object('question_id',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_questions') x where x->>'target_kind'='voice' and x->>'status'='open'),'expected_version',pg_temp.review()->'record'->'version','answer_text','Latest voice'));
select is((select string_agg(x->>'answer_text',',') from jsonb_array_elements(pg_temp.review()->'current_questions') x where x->>'target_kind'='voice'),'Latest voice','latest answer remains visible when no open question exists');

select pg_temp.seed_brand('expiry-controls');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offer','sale','Half price','2098-01-01T18:00:00.123456-06:00')));
select is((select ends_at from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='sale'),'2098-01-02T00:00:00.123456Z'::timestamptz,'machine persistence preserves explicit instant and microseconds');
select set_config('test.correction',jsonb_build_object('assertion_id',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_assertions') x where x->>'field_key'='sale'),'expected_version',pg_temp.review()->'record'->'version','value_text','Half price','excerpt','Expiry correction')::text,true);
select set_config('test.before',pg_temp.review()::text,true);
select is(pg_temp.error_of(format('select pg_temp.command(''correct_brand_assertion'',current_setting(''test.correction'')::jsonb || jsonb_build_object(''ends_at'',%L))',v)),
  '22023:VALIDATION_FAILED','command rejects non-wire expiry '||v)
from unnest(array['infinity','-infinity','tomorrow','2098-01-01','2098-01-01T12:00:00','2026-02-30T10:00:00Z','2098-01-01T24:00:00Z','2098-01-01T12:00:00+14:01','0000-01-01T00:00:00Z','9999-12-31T23:59:59-14:00']) v;
select is(pg_temp.error_of(format('select pg_temp.extract(jsonb_build_array(pg_temp.item(''offer'',''other'',''Other'',%L)))',v)),
  '22023:VALIDATION_FAILED','machine rejects non-wire expiry '||v)
from unnest(array['infinity','tomorrow','2098-01-01T12:00:00','2026-02-30T10:00:00Z','10000-01-01T00:00:00Z']) v;
select is(pg_temp.review(),current_setting('test.before')::jsonb,'all invalid expiry commands roll back atomically');
select pg_temp.command('correct_brand_assertion',current_setting('test.correction')::jsonb || jsonb_build_object('ends_at','2098-02-01T12:30:00.654321Z'));
select is((select ends_at from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='sale'),'2098-02-01T12:30:00.654321Z'::timestamptz,'expiry-only correction persists exact updated expiry');
select is((select value_text from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='sale'),'Half price','expiry-only correction preserves the offer text');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offer','sale','Half price','2098-02-01T12:30:00.654322Z')));
select is(pg_temp.error_of('select pg_temp.approve()'),'P0001:CONTRADICTORY_KNOWLEDGE','one-microsecond expiry difference blocks approval');
select pg_temp.command('correct_brand_assertion',jsonb_build_object('assertion_id',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_assertions') x where x->>'field_key'='sale' and x->>'method'<>'manual'),'expected_version',pg_temp.review()->'record'->'version','value_text',null,'excerpt','Withdraw duplicate claim'));
select ok((select ends_at is null from app_private.current_assertions(current_setting('test.ws')::uuid,current_setting('test.brand')::uuid) where field_key='sale' and status='unknown'),'withdrawing an offer also clears its expiry');
select lives_ok('select pg_temp.approve()','withdrawn duplicate no longer creates a false contradiction');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offer','invalid','Unknown end') || '{"status":"disputed","excerpt":"Expiry requires review"}'::jsonb));
select is(pg_temp.error_of('select pg_temp.approve()'),'P0001:CONTRADICTORY_KNOWLEDGE','disputed source expiry cannot be approved');

select pg_temp.seed_brand('proposal-controls');
select pg_temp.extract(jsonb_build_array(pg_temp.item('offering','delivery','Pickup available')));
select pg_temp.command('propose_brand_knowledge');
select set_config('test.approved',pg_temp.approve()::text,true);
select set_config('test.original_proposal',pg_temp.proposal_input('positioning','Owner positioning')::text,true);
select set_config('test.corrected',pg_temp.command('correct_brand_proposal',current_setting('test.original_proposal')::jsonb,'proposal-retry')::text,true);
select is((select x->>'status' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'corrected','observed or inferred proposal can be explicitly corrected');
select is((select x->'evidence_field_keys' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'["delivery"]'::jsonb,'correction preserves evidence keys server-side');
select is(pg_temp.command('correct_brand_proposal',current_setting('test.original_proposal')::jsonb,'proposal-retry'),current_setting('test.corrected')::jsonb,'retry returns the original result even though the proposal is superseded');
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',current_setting('test.original_proposal')::jsonb || '{"value_text":"Changed"}', 'proposal-retry')$$),'P0001:IDEMPOTENCY_CONFLICT','same key with a different proposal edit conflicts');
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',current_setting('test.original_proposal')::jsonb)$$),'P0001:REVISION_CONFLICT','editing a historical proposal fails');
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',pg_temp.proposal_input('positioning','Another') || '{"expected_version":1}')$$),'P0001:REVISION_CONFLICT','stale draft version fails');
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',pg_temp.proposal_input('positioning','Another') || '{"evidence_field_keys":[]}')$$),'22023:VALIDATION_FAILED','client cannot replace provenance');
select is((select p->>'value_text' from public.brand_versions v cross join lateral jsonb_array_elements(v.snapshot->'proposals') p where v.id=(current_setting('test.approved')::jsonb->'record'->>'id')::uuid and p->>'kind'='positioning'),'Pickup available','approved proposal snapshot stays immutable after correction');
select pg_temp.command('correct_brand_proposal',pg_temp.proposal_input('positioning',null));
select is((select x->>'status' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'unknown','operator can withdraw a proposal without deleting history');
select pg_temp.command('correct_brand_proposal',pg_temp.proposal_input('positioning','New reviewed position'));
select is((select x->>'value_text' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),'New reviewed position','unknown proposal can be revised directly');
select set_config('test.other_proposal',(select x->>'id' from jsonb_array_elements(pg_temp.review()->'current_proposals') x where x->>'kind'='positioning'),true);
select pg_temp.seed_brand('another-brand');
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',jsonb_build_object('proposal_id',current_setting('test.other_proposal'),'expected_version',1,'value_text','Forged','excerpt','Forged'))$$),'P0002:NOT_FOUND','forged cross-brand proposal is denied');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',jsonb_build_object('proposal_id',current_setting('test.other_proposal'),'expected_version',1,'value_text','Forged','excerpt','Forged'))$$),'P0002:NOT_FOUND','unrelated tenant cannot inspect or mutate a proposal');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
select pg_temp.seed_brand('proposal-revocation');
select pg_temp.extract(jsonb_build_array(pg_temp.item('language','primary','Plain English')));
select pg_temp.command('propose_brand_knowledge');
select set_config('test.studio',public.platform_command('create_studio','{"name":"Controls studio","slug":"controls-studio"}','controls-studio','req')->'record'->>'id',true);
select public.platform_command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','aa000000-0000-4000-8000-000000000002','role','editor','expected_version',1),'member','req');
select set_config('test.grant',public.platform_command('grant_workspace_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'actions',jsonb_build_array('brand:read','brand:write')),'grant','req')->'record'->>'id',true);
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
select set_config('test.editor_input',pg_temp.proposal_input('voice','Edited plain voice')::text,true);
select lives_ok($$select pg_temp.command('correct_brand_proposal',current_setting('test.editor_input')::jsonb,'editor-proposal')$$,'scoped editor can correct an observed proposal');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
select public.platform_command('revoke_workspace_access',jsonb_build_object('workspace_id',current_setting('test.ws'),'grant_id',current_setting('test.grant'),'expected_version',1),'revoke','req');
select set_config('test.before',pg_temp.review()::text,true);
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',current_setting('test.editor_input')::jsonb,'editor-proposal')$$),'P0002:NOT_FOUND','revoked editor cannot replay a cached proposal response');
select is(pg_temp.error_of($$select pg_temp.command('correct_brand_proposal',current_setting('test.editor_input')::jsonb)$$),'P0002:NOT_FOUND','revoked editor cannot submit another proposal correction');
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
select is(pg_temp.review(),current_setting('test.before')::jsonb,'denied corrections leave the draft and proposals unchanged');
select * from finish();
rollback;
