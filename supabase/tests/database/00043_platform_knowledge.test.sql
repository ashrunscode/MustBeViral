begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
create function pg_temp.knowledge(op text, payload jsonb, key text) returns jsonb language sql as $$
  select public.platform_knowledge_command(op, payload, key, 'knowledge-test');
$$;
create function pg_temp.attempt(p_cfg text) returns integer language sql as $$
  select (current_setting(p_cfg)::jsonb->'job'->>'attempt_count')::integer;
$$;
insert into auth.users(id,aud,role,email) values
  ('a7000000-0000-4000-8000-000000000001','authenticated','authenticated','knowledge-owner@example.test'),
  ('a7000000-0000-4000-8000-000000000002','authenticated','authenticated','knowledge-editor@example.test');
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select set_config('test.wb', public.create_workspace('WashBodega knowledge','knowledge-wb','wb-k','req-wb')->>'workspace_id', true);
select set_config('test.up', public.create_workspace('UnPile knowledge','knowledge-up','up-k','req-up')->>'workspace_id', true);
select set_config('test.studio', public.platform_command('create_studio','{"name":"Knowledge studio","slug":"knowledge-studio"}','studio','req')->'record'->>'id', true);
select set_config('test.wb_brand', public.platform_command('create_brand', jsonb_build_object('workspace_id', current_setting('test.wb'), 'name','WashBodega','slug','washbodega'),'wb-brand','req')->'record'->>'id', true);
select set_config('test.up_brand', public.platform_command('create_brand', jsonb_build_object('workspace_id', current_setting('test.up'), 'name','UnPile','slug','unpile'),'up-brand','req')->'record'->>'id', true);

select is(pg_temp.error_of($$update public.brand_sources set origin_url='https://bypass.test'$$),'42501:permission denied for table brand_sources','direct source writes remain forbidden');
select is(pg_temp.error_of($$insert into public.brand_knowledge_candidates default values$$),'42501:permission denied for table brand_knowledge_candidates','direct candidate writes remain forbidden');
select is(pg_temp.error_of($$select public.record_brand_source_capture('00000000-0000-4000-8000-000000000001','{}','req',1)$$),
  '42501:permission denied for function record_brand_source_capture','authenticated cannot fabricate HTTPS capture');
select is(pg_temp.error_of($$select public.fail_brand_source_job('00000000-0000-4000-8000-000000000001','SOURCE_TIMEOUT','req',1)$$),
  '42501:permission denied for function fail_brand_source_job','authenticated cannot fail capture jobs');

select is(pg_temp.error_of($$select pg_temp.knowledge('start_website_capture', jsonb_build_object('workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'), 'url', 'http://example.test'), 'http')$$),
  '22023:SOURCE_UNSAFE','http website capture is unsafe');
select is(pg_temp.error_of($$select pg_temp.knowledge('start_website_capture', jsonb_build_object('workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'), 'url', 'https://127.0.0.1/'), 'loop')$$),
  '22023:SOURCE_UNSAFE','loopback website capture is unsafe');
select is(pg_temp.error_of($$select pg_temp.knowledge('start_document_capture', jsonb_build_object('workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'), 'filename', 'guide.pdf', 'media_type', 'application/pdf'), 'pdf')$$),
  '22023:SOURCE_UNSUPPORTED','PDF documents are unsupported');

select set_config('test.manual', pg_temp.knowledge('start_manual_knowledge_draft', jsonb_build_object('workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')), 'manual')::text, true);
select is((current_setting('test.manual')::jsonb->'record'->>'version'), '1', 'manual draft is unapproved version 1');
select is(jsonb_array_length(current_setting('test.manual')::jsonb->'current_candidates'), 1, 'manual draft has an unknown gap');
select is(current_setting('test.manual')::jsonb->'current_candidates'->0->>'status', 'unknown', 'unknown remains unlabeled');
select is(current_setting('test.manual')::jsonb->'current_candidates'->0->>'method', 'manual', 'manual provenance is explicit');
select ok((current_setting('test.manual')::jsonb->'current_candidates'->0->>'source_id') is not null, 'manual candidate has a durable source');
select is(pg_temp.knowledge('start_manual_knowledge_draft', jsonb_build_object('workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')), 'manual')->'record'->>'id',
  current_setting('test.manual')::jsonb->'record'->>'id', 'manual start replays the same draft');
select ok(current_setting('test.manual')::jsonb ? 'next_cursor', 'knowledge views include a candidate cursor');

select set_config('test.up_manual', pg_temp.knowledge('start_manual_knowledge_draft', jsonb_build_object('workspace_id', current_setting('test.up'), 'brand_id', current_setting('test.up_brand')), 'up-manual')::text, true);
select isnt(current_setting('test.up_manual')::jsonb->'record'->>'id', current_setting('test.manual')::jsonb->'record'->>'id', 'UnPile draft is independent');
select is(pg_temp.error_of($$select public.platform_knowledge_query('get_knowledge_draft', jsonb_build_object('workspace_id', current_setting('test.up'), 'brand_id', current_setting('test.wb_brand')))$$),
  'P0002:NOT_FOUND','cross-workspace knowledge lookup hides the resource');

select set_config('test.candidate', current_setting('test.manual')::jsonb->'current_candidates'->0->>'id', true);
select set_config('test.corrected', pg_temp.knowledge('correct_knowledge_candidate', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'candidate_id', current_setting('test.candidate'), 'expected_version', 1,
  'value_text', 'Customer access is 24/7 for machines only.', 'excerpt', 'Operator correction of hours.'), 'correct')::text, true);
select is(current_setting('test.corrected')::jsonb->'record'->>'version', '2', 'correction increments the draft version');
select is(jsonb_array_length(current_setting('test.corrected')::jsonb->'current_candidates'), 1, 'superseded original is not a current item');
select is(current_setting('test.corrected')::jsonb->'current_candidates'->0->>'status', 'corrected', 'correction is a new revision');
select isnt(current_setting('test.corrected')::jsonb->'current_candidates'->0->>'source_id',
  current_setting('test.manual')::jsonb->'current_candidates'->0->>'source_id', 'correction has its own manual source');
select is(current_setting('test.corrected')::jsonb->'current_candidates'->0->>'supersedes_id', current_setting('test.candidate'), 'correction links the original candidate');
select is(pg_temp.error_of($$select pg_temp.knowledge('correct_knowledge_candidate', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'candidate_id', current_setting('test.candidate'), 'expected_version', 1,
  'value_text', 'stale', 'excerpt', 'stale'), 'stale')$$),
  'P0001:REVISION_CONFLICT','stale draft version cannot correct');
select is(pg_temp.knowledge('start_manual_knowledge_draft', jsonb_build_object('workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')), 'manual')->'record'->>'version',
  '1', 'manual idempotent replay returns the stored receipt after a later correction');

select set_config('test.job', pg_temp.knowledge('start_website_capture', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'url', 'https://washbodega.example/'), 'site')::text, true);
select is(current_setting('test.job')::jsonb->'job'->>'status', 'capturing', 'website start leases a capturing job');
select is(current_setting('test.job')::jsonb->>'capture_pending', 'true', 'the leasing caller must complete capture in Core');
select is(pg_temp.knowledge('start_website_capture', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'url', 'https://washbodega.example/'), 'site')->'capture_pending', 'false'::jsonb, 'in-flight replay does not double-lease');
select is(pg_temp.error_of($$select pg_temp.knowledge('start_website_capture', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'url', 'https://other.example/'), 'site')$$),
  'P0001:IDEMPOTENCY_CONFLICT','changed URL with the same key conflicts');

reset role;
select ok(has_function_privilege('service_role', 'public.record_brand_source_capture(uuid,jsonb,text,integer)'::regprocedure, 'execute'),
  'service_role can record machine capture');
select ok(not has_function_privilege('authenticated', 'public.record_brand_source_capture(uuid,jsonb,text,integer)'::regprocedure, 'execute'),
  'authenticated has no machine capture grant');
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='brand_sources'),
  'brand_sources has RLS forced');

set local role service_role;
select is(public.record_brand_source_capture(
  (current_setting('test.job')::jsonb->'job'->>'id')::uuid,
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-000000000099',
    'origin_url', 'https://washbodega.example/',
    'final_url', 'https://washbodega.example/',
    'media_type', 'text/html',
    'byte_size', 32,
    'content_sha256', repeat('cd', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand') || '/d7000000-0000-4000-8000-000000000099',
    'http_status', 200,
    'redirect_hops', '[]'::jsonb,
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','page_title','value_text','Late','status','observed',
      'excerpt','late','locator','title','method','html_title'))
  ),
  'late-attempt',
  pg_temp.attempt('test.job')
)->'job'->>'status', 'capturing', 'a late request cannot complete a different lease');
select is(pg_temp.error_of(format(
  $sql$select public.record_brand_source_capture(%L::uuid, %L::jsonb, 'knowledge-test', %s)$sql$,
  current_setting('test.job')::jsonb->'job'->>'id',
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-0000000000ee',
    'origin_url', 'https://washbodega.example/',
    'final_url', 'https://washbodega.example/',
    'media_type', 'text/html',
    'byte_size', 32,
    'content_sha256', repeat('ee', 32),
    'r2_key', 'brand-sources/' || current_setting('test.up') || '/' || current_setting('test.up_brand') || '/d7000000-0000-4000-8000-0000000000ee',
    'http_status', 200,
    'redirect_hops', '[]'::jsonb,
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','page_title','value_text','Other','status','observed',
      'excerpt','other','locator','title','method','html_title'))
  )::text,
  pg_temp.attempt('test.job')
)), '22023:VALIDATION_FAILED', 'cross-tenant r2 key is denied');
select is(pg_temp.error_of(format(
  $sql$select public.record_brand_source_capture(%L::uuid, %L::jsonb, 'knowledge-test', %s)$sql$,
  current_setting('test.job')::jsonb->'job'->>'id',
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-0000000000ff',
    'origin_url', 'https://washbodega.example/',
    'final_url', 'https://127.0.0.1/secret',
    'media_type', 'text/html',
    'byte_size', 32,
    'content_sha256', repeat('ff', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand') || '/d7000000-0000-4000-8000-0000000000ff',
    'http_status', 200,
    'redirect_hops', '[]'::jsonb,
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','page_title','value_text','Private','status','observed',
      'excerpt','private','locator','title','method','html_title'))
  )::text,
  pg_temp.attempt('test.job')
)), '22023:SOURCE_UNSAFE', 'unsafe website final url is denied');
select public.record_brand_source_capture(
  (current_setting('test.job')::jsonb->'job'->>'id')::uuid,
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-000000000001',
    'origin_url', 'https://washbodega.example/',
    'final_url', 'https://washbodega.example/',
    'media_type', 'text/html',
    'byte_size', 32,
    'content_sha256', repeat('ab', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand') || '/d7000000-0000-4000-8000-000000000001',
    'http_status', 200,
    'redirect_hops', '[]'::jsonb,
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','page_title','value_text','WashBodega','status','observed',
      'excerpt','<title>WashBodega</title>','locator','title','method','html_title'))
  ),
  'knowledge-test',
  pg_temp.attempt('test.job')
);
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select is(public.platform_knowledge_query('get_source_job', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'job_id', current_setting('test.job')::jsonb->'job'->>'id'))->'record'->>'status',
  'captured', 'machine complete persists a captured job');
select ok(jsonb_array_length(public.platform_knowledge_query('get_knowledge_draft', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')))->'current_candidates') >= 1,
  'captured website candidates are current and sourced');
select is(public.platform_knowledge_query('get_brand_source', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'source_id', 'd7000000-0000-4000-8000-000000000001'))->'record'->>'method',
  'https_get', 'website method is machine https_get');
select is(pg_temp.error_of($$select public.platform_knowledge_query('get_brand_source', jsonb_build_object(
  'workspace_id', current_setting('test.up'), 'brand_id', current_setting('test.up_brand'),
  'source_id', 'd7000000-0000-4000-8000-000000000001'))$$),
  'P0002:NOT_FOUND','UnPile cannot read WashBodega source');

select set_config('test.doc', pg_temp.knowledge('start_document_capture', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'filename', 'washbodega-notes.md', 'media_type', 'text/markdown'), 'doc-upload')::text, true);
select is(current_setting('test.doc')::jsonb->'job'->>'status', 'awaiting_bytes', 'large-document start waits for bytes');
select is(current_setting('test.doc')::jsonb->>'capture_pending', 'false', 'awaiting bytes is not yet leased');
select is(public.platform_knowledge_query('list_latest_source_job', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')))->'record'->>'id',
  current_setting('test.doc')::jsonb->'job'->>'id', 'latest job recovers an awaiting_bytes document without a source');
reset role;
set local role service_role;
select is(pg_temp.error_of(format(
  $sql$select public.record_brand_source_capture(%L::uuid, %L::jsonb, 'knowledge-test', 1)$sql$,
  current_setting('test.doc')::jsonb->'job'->>'id',
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-0000000000aa',
    'origin_url', '', 'final_url', '', 'media_type', 'text/markdown', 'byte_size', 24,
    'content_sha256', repeat('11', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand') || '/d7000000-0000-4000-8000-0000000000aa',
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','document_filename','value_text','washbodega-notes.md','status','observed',
      'excerpt','notes','locator','filename','method','document_text'))
  )::text
)), '22023:VALIDATION_FAILED', 'service completion cannot bypass an unclaimed document upload');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select set_config('test.doc_claim', pg_temp.knowledge('claim_document_upload', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'job_id', current_setting('test.doc')::jsonb->'job'->>'id'), 'doc-claim')::text, true);
select is(current_setting('test.doc_claim')::jsonb->'job'->>'status', 'capturing', 'claim leases awaiting_bytes with the caller request');
select is(current_setting('test.doc_claim')::jsonb->>'capture_pending', 'true', 'claimed upload is fenced to the caller lease');
select is(pg_temp.knowledge('claim_document_upload', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'job_id', current_setting('test.doc')::jsonb->'job'->>'id'), 'doc-claim')->'capture_pending',
  'false'::jsonb, 'claim replay does not double-work the upload');
select is(pg_temp.knowledge('claim_document_upload', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'job_id', current_setting('test.doc')::jsonb->'job'->>'id'), 'doc-claim')->'job'->>'status',
  'capturing', 'claim replay keeps the same capturing lease');
select is(pg_temp.error_of($$select pg_temp.knowledge('claim_document_upload', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'job_id', '00000000-0000-4000-8000-00000000dead'), 'forged-claim')$$),
  'P0002:NOT_FOUND','forged upload job is hidden');
reset role;
set local role service_role;
select is(public.record_brand_source_capture(
  (current_setting('test.doc')::jsonb->'job'->>'id')::uuid,
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-0000000000aa',
    'origin_url', '', 'final_url', '', 'media_type', 'text/markdown', 'byte_size', 24,
    'content_sha256', repeat('11', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand') || '/d7000000-0000-4000-8000-0000000000aa',
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','document_filename','value_text','washbodega-notes.md','status','observed',
      'excerpt','notes','locator','filename','method','document_text'))
  ),
  'other-lease',
  pg_temp.attempt('test.doc_claim')
)->'job'->>'status', 'capturing', 'a mismatched lease cannot complete a claimed upload');
select public.record_brand_source_capture(
  (current_setting('test.doc')::jsonb->'job'->>'id')::uuid,
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-0000000000aa',
    'origin_url', '', 'final_url', '', 'media_type', 'text/markdown', 'byte_size', 24,
    'content_sha256', repeat('11', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand') || '/d7000000-0000-4000-8000-0000000000aa',
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','document_filename','value_text','washbodega-notes.md','status','observed',
      'excerpt','notes','locator','filename','method','document_text'))
  ),
  'knowledge-test',
  pg_temp.attempt('test.doc_claim')
);
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select is(public.platform_knowledge_query('get_source_job', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'job_id', current_setting('test.doc')::jsonb->'job'->>'id'))->'record'->>'status',
  'captured', 'matching lease completes the claimed document');

select set_config('test.draft_id', public.platform_knowledge_query('get_knowledge_draft', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')))->'record'->>'id', true);
select public.platform_command('set_studio_member', jsonb_build_object(
  'studio_id', current_setting('test.studio'), 'user_id', 'a7000000-0000-4000-8000-000000000002',
  'role', 'editor', 'expected_version', 1), 'member', 'req');
select set_config('test.write_grant', public.platform_command('grant_workspace_access', jsonb_build_object(
  'studio_id', current_setting('test.studio'), 'workspace_id', current_setting('test.wb'),
  'brand_id', current_setting('test.wb_brand'), 'actions', jsonb_build_array('brand:read','brand:write')), 'grant-write', 'req')->'record'->>'id', true);
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000002';
select set_config('test.editor_job', pg_temp.knowledge('start_website_capture', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'url', 'https://washbodega.example/hours'), 'editor-site')::text, true);
select is(current_setting('test.editor_job')::jsonb->'job'->>'status', 'capturing', 'editor with write can start a capture');
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select public.platform_command('revoke_workspace_access', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'grant_id', current_setting('test.write_grant'),
  'expected_version', 1), 'revoke-write', 'req');
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select public.platform_command('grant_workspace_access', jsonb_build_object(
  'studio_id', current_setting('test.studio'), 'workspace_id', current_setting('test.wb'),
  'brand_id', current_setting('test.wb_brand'), 'actions', jsonb_build_array('brand:read')), 'grant-read', 'req');
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000002';
select is(pg_temp.error_of($$select pg_temp.knowledge('start_website_capture', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'url', 'https://washbodega.example/hours'), 'editor-site')$$),
  'P0002:NOT_FOUND','same actor replay after grant revocation hides the stored payload');
select is(public.platform_knowledge_query('get_knowledge_draft', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')))->'record'->>'id',
  current_setting('test.draft_id'),
  'viewer can read the draft');
select is(public.platform_knowledge_query('list_latest_source_job', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')))->'record'->>'id',
  current_setting('test.editor_job')::jsonb->'job'->>'id',
  'authorized latest job query still returns the capture the actor created');
select is(pg_temp.error_of($$select pg_temp.knowledge('start_manual_knowledge_draft', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand')), 'viewer-write')$$),
  '42501:FORBIDDEN','viewer cannot start a knowledge draft');
select is(pg_temp.error_of($$select pg_temp.knowledge('start_website_capture', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'url', 'https://washbodega.example/'), 'site')$$),
  '42501:FORBIDDEN','read-only actor cannot start a new capture');
select is(pg_temp.error_of($$select pg_temp.knowledge('claim_document_upload', jsonb_build_object(
  'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
  'job_id', current_setting('test.doc')::jsonb->'job'->>'id'), 'viewer-claim')$$),
  '42501:FORBIDDEN','viewer cannot claim an owner document upload');

set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select set_config('test.repeat', public.platform_knowledge_command(
  'start_website_capture',
  jsonb_build_object(
    'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
    'url', 'https://washbodega.example/reused-id'),
  'same-correlation-fence', 'correlation-reused')::text, true);
select is(current_setting('test.repeat')::jsonb->'job'->>'attempt_count', '1', 'first lease captures attempt generation 1');
select is(current_setting('test.repeat')::jsonb->'job'->>'status', 'capturing', 'first correlation lease is capturing');
reset role;
update public.brand_source_jobs
  set lease_expires_at = clock_timestamp() - interval '1 second'
  where id = (current_setting('test.repeat')::jsonb->'job'->>'id')::uuid;
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select set_config('test.repeat_b', public.platform_knowledge_command(
  'start_website_capture',
  jsonb_build_object(
    'workspace_id', current_setting('test.wb'), 'brand_id', current_setting('test.wb_brand'),
    'url', 'https://washbodega.example/reused-id'),
  'same-correlation-fence', 'correlation-reused')::text, true);
select is(current_setting('test.repeat_b')::jsonb->'job'->>'attempt_count', '2',
  'same correlation id creates a second expired-job attempt');
select is(current_setting('test.repeat_b')::jsonb->'job'->>'id',
  current_setting('test.repeat')::jsonb->'job'->>'id',
  're-lease keeps the same job');
reset role;
set local role service_role;
select is(public.fail_brand_source_job(
  (current_setting('test.repeat')::jsonb->'job'->>'id')::uuid,
  'SOURCE_TIMEOUT', 'correlation-reused', pg_temp.attempt('test.repeat'))->'job'->>'status',
  'capturing', 'late old attempt must not fail the newer lease when correlation id is reused');
select is(public.fail_brand_source_job(
  (current_setting('test.repeat')::jsonb->'job'->>'id')::uuid,
  'SOURCE_TIMEOUT', 'correlation-reused', pg_temp.attempt('test.repeat'))->'job'->>'attempt_count',
  '2', 'late old failure leaves attempt B generation unchanged');
select is(public.record_brand_source_capture(
  (current_setting('test.repeat')::jsonb->'job'->>'id')::uuid,
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-0000000000b1',
    'origin_url', 'https://washbodega.example/reused-id',
    'final_url', 'https://washbodega.example/reused-id',
    'media_type', 'text/html', 'byte_size', 32, 'content_sha256', repeat('b1', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand')
      || '/d7000000-0000-4000-8000-0000000000b1',
    'http_status', 200, 'redirect_hops', '[]'::jsonb,
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','page_title','value_text','Stale','status','observed',
      'excerpt','stale','locator','title','method','html_title'))
  ),
  'correlation-reused',
  pg_temp.attempt('test.repeat')
)->'job'->>'status', 'capturing', 'late old completion must not finish the newer lease when correlation id is reused');
select is(public.record_brand_source_capture(
  (current_setting('test.repeat')::jsonb->'job'->>'id')::uuid,
  jsonb_build_object(
    'source_id', 'd7000000-0000-4000-8000-0000000000b2',
    'origin_url', 'https://washbodega.example/reused-id',
    'final_url', 'https://washbodega.example/reused-id',
    'media_type', 'text/html', 'byte_size', 32, 'content_sha256', repeat('b2', 32),
    'r2_key', 'brand-sources/' || current_setting('test.wb') || '/' || current_setting('test.wb_brand')
      || '/d7000000-0000-4000-8000-0000000000b2',
    'http_status', 200, 'redirect_hops', '[]'::jsonb,
    'candidates', jsonb_build_array(jsonb_build_object(
      'field_key','page_title','value_text','Current','status','observed',
      'excerpt','current','locator','title','method','html_title'))
  ),
  'correlation-reused',
  pg_temp.attempt('test.repeat_b')
)->'job'->>'status', 'captured', 'current attempt still completes with its acquired generation');

select finish();
rollback;
