begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate || ':' || sqlerrm; end $$;
insert into auth.users(id,aud,role,email) values
  ('ab000000-0000-4000-8000-000000000001','authenticated','authenticated','asset-owner@synthetic.example.test'),
  ('ab000000-0000-4000-8000-000000000002','authenticated','authenticated','asset-editor@synthetic.example.test'),
  ('ab000000-0000-4000-8000-000000000003','authenticated','authenticated','asset-other-owner@synthetic.example.test');

-- Client A (owner 1) with two brands; a studio whose editor (user 2) holds a brand-scoped grant on brand A1.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
select set_config('test.ws',public.create_workspace('Asset client A','asset-client-a','asset-ws-a','req')->>'workspace_id',true);
select set_config('test.brand',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Body shop','slug','body-shop'),'brand-a1','req')->'record'->>'id',true);
select set_config('test.brand2',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Second','slug','second'),'brand-a2','req')->'record'->>'id',true);
select set_config('test.studio',public.platform_command('create_studio','{"name":"Asset studio","slug":"asset-studio"}','studio','req')->'record'->>'id',true);
select public.platform_command('set_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','ab000000-0000-4000-8000-000000000002','role','editor','expected_version',1),'member','req');
select set_config('test.grant',public.platform_command('grant_workspace_access',jsonb_build_object('studio_id',current_setting('test.studio'),'workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'actions',jsonb_build_array('brand:read','brand:write')),'grant','req')->'record'->>'id',true);

-- Client B (owner 3) is a separate tenant.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000003',true);
select set_config('test.ws_b',public.create_workspace('Asset client B','asset-client-b','asset-ws-b','req')->>'workspace_id',true);
select set_config('test.brand_b',public.platform_command('create_brand',jsonb_build_object('workspace_id',current_setting('test.ws_b'),'name','Salon','slug','salon'),'brand-b','req')->'record'->>'id',true);
select set_config('test.rights_b',public.platform_asset_command('create_asset_rights',jsonb_build_object('workspace_id',current_setting('test.ws_b'),'brand_id',current_setting('test.brand_b'),'basis','client_supplied','permitted_uses',jsonb_build_array('organic_social'),'identifiable_people','none'),'rights-b','req')->'record'->>'id',true);

create function pg_temp.rights(key text, extra jsonb default '{}') returns jsonb language sql as $$
  select public.platform_asset_command('create_asset_rights',
    jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),
      'basis','commissioned','permitted_uses',jsonb_build_array('organic_social','paid_ads'),'identifiable_people','none') || extra,
    key,'req');
$$;
create function pg_temp.begin_upload(key text, sha text, rights text, extra jsonb default '{}') returns jsonb language sql as $$
  select public.platform_asset_command('begin_asset_upload',
    jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),
      'purpose','photo','filename','storefront.jpg','mime_type','image/jpeg','byte_size',2048000,
      'content_sha256',sha,'rights_id',rights) || extra,
    key,'req');
$$;

-- Owner creates rights and begins an upload.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
select set_config('test.rights',(pg_temp.rights('rights-1'))->'record'->>'id',true);
select is(pg_temp.error_of($$select pg_temp.rights('rights-bad',jsonb_build_object('identifiable_people','released'))$$),'22023:VALIDATION_FAILED','a release requires its reference');
select is(pg_temp.error_of($$select pg_temp.rights('rights-bad2',jsonb_build_object('permitted_uses',jsonb_build_array('resale')))$$),'22023:VALIDATION_FAILED','unknown permitted use is rejected');
select is(pg_temp.error_of($$select pg_temp.rights('rights-bad3',jsonb_build_object('expires_at','2000-01-01T00:00:00Z'))$$),'22023:VALIDATION_FAILED','already expired rights are rejected');
select ok((pg_temp.rights('rights-people',jsonb_build_object('identifiable_people','released','release_reference','Signed release 2026-10-08'))->'record'->>'identifiable_people') = 'released','recognizable-person release is recorded separately');

select set_config('test.upload',pg_temp.begin_upload('upload-1',repeat('a',64),current_setting('test.rights'))::text,true);
select set_config('test.asset',current_setting('test.upload')::jsonb->'record'->>'id',true);
select set_config('test.artifact',current_setting('test.upload')::jsonb->'record'->>'artifact_id',true);
select is(current_setting('test.upload')::jsonb->>'upload_required','true','new intent requires bytes');
select is(current_setting('test.upload')::jsonb->'record'->>'usable','false','pending bytes are not usable');
select is(current_setting('test.upload')::jsonb->'record'->>'unusable_reason','BYTES_NOT_VERIFIED','pending reason is explicit');
select is((select artifact_kind||':'||coalesce(project_id::text,'none')||':'||status from public.artifacts where id=current_setting('test.artifact')::uuid),'brand_original:none:pending','original extends the artifact store without a project');
select ok((select object_key from public.artifacts where id=current_setting('test.artifact')::uuid) like 'workspaces/'||current_setting('test.ws')||'/brands/'||current_setting('test.brand')||'/originals/%','object key is private and brand scoped');

-- Same idempotency key replays; a different key with the same bytes restarts without a duplicate.
select is(pg_temp.begin_upload('upload-1',repeat('a',64),current_setting('test.rights'))->'record'->>'id',current_setting('test.asset'),'idempotent replay returns the same asset');
select is(pg_temp.begin_upload('upload-restart',repeat('a',64),current_setting('test.rights'))->>'replayed','true','restarted interrupted upload reuses the pending asset');
select is((select count(*)::integer from public.asset_metadata where brand_id=current_setting('test.brand')::uuid and content_sha256=repeat('a',64)),1,'no duplicate asset for the same bytes');
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-1',repeat('b',64),current_setting('test.rights'))$$),'P0001:IDEMPOTENCY_CONFLICT','same key with different input conflicts');
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-size',repeat('a',64),current_setting('test.rights'),jsonb_build_object('byte_size',999))$$),'P0001:IDEMPOTENCY_CONFLICT','same bytes with a different declared length conflict');

-- Media rules per purpose.
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-mime',repeat('c',64),current_setting('test.rights'),jsonb_build_object('mime_type','application/x-msdownload'))$$),'22023:MEDIA_UNSUPPORTED','unsupported MIME is rejected');
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-big',repeat('c',64),current_setting('test.rights'),jsonb_build_object('byte_size',60000000))$$),'22023:MEDIA_UNSUPPORTED','oversized photo is rejected');
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-shape',repeat('c',64),current_setting('test.rights'),jsonb_build_object('byte_size',-1))$$),'22023:VALIDATION_FAILED','negative length is rejected');

-- Rights must belong to the same brand and be current.
select is(pg_temp.error_of(format($$select pg_temp.begin_upload('upload-xb',repeat('d',64),%L)$$,current_setting('test.rights_b'))),'P0002:NOT_FOUND','another tenant''s rights cannot be attached');
select set_config('test.rights_other_brand',public.platform_asset_command('create_asset_rights',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand2'),'basis','owner_created','permitted_uses',jsonb_build_array('website'),'identifiable_people','none'),'rights-a2','req')->'record'->>'id',true);
select is(pg_temp.error_of(format($$select pg_temp.begin_upload('upload-xbrand',repeat('d',64),%L)$$,current_setting('test.rights_other_brand'))),'P0002:NOT_FOUND','another brand''s rights cannot be attached');

-- Machine verification under the persisted actor.
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
select is(pg_temp.error_of(format($$select public.finalize_brand_asset_upload(%L,%L,2048000,'ab000000-0000-4000-8000-000000000001',4000,3000)$$,current_setting('test.artifact'),repeat('f',64))),'P0001:BYTES_MISMATCH','mismatched hash never becomes usable');
select is(pg_temp.error_of(format($$select public.finalize_brand_asset_upload(%L,%L,1000,'ab000000-0000-4000-8000-000000000001',4000,3000)$$,current_setting('test.artifact'),repeat('a',64))),'P0001:BYTES_MISMATCH','incomplete bytes never become usable');
select is(pg_temp.error_of(format($$select public.finalize_brand_asset_upload(%L,%L,2048000,'ab000000-0000-4000-8000-000000000001')$$,current_setting('test.artifact'),repeat('a',64))),'22023:VALIDATION_FAILED','photo verification requires measured dimensions');
select is(pg_temp.error_of(format($$select public.finalize_brand_asset_upload(%L,%L,2048000,'ab000000-0000-4000-8000-000000000003',4000,3000)$$,current_setting('test.artifact'),repeat('a',64))),'P0002:NOT_FOUND','an unrelated actor cannot verify another tenant''s upload');
select is(public.finalize_brand_asset_upload(current_setting('test.artifact')::uuid,repeat('a',64),2048000,'ab000000-0000-4000-8000-000000000001',4000,3000)->'record'->>'usable','true','verified bytes with current rights are usable');
select is(public.finalize_brand_asset_upload(current_setting('test.artifact')::uuid,repeat('a',64),2048000,'ab000000-0000-4000-8000-000000000001',4000,3000)->>'replayed','true','repeated verification is idempotent');
reset role;
select is((select status from public.artifacts where id=current_setting('test.artifact')::uuid),'available','artifact store records verified bytes');
select is(pg_temp.error_of(format($$update public.asset_metadata set width_px=1 where id=%L$$,current_setting('test.asset'))),'55000:ASSET_METADATA_IMMUTABLE','verified dimensions are immutable');
select is(pg_temp.error_of(format($$update public.asset_metadata set filename='renamed.jpg' where id=%L$$,current_setting('test.asset'))),'55000:ASSET_METADATA_IMMUTABLE','original identity is immutable');
select is(pg_temp.error_of(format($$delete from public.asset_metadata where id=%L$$,current_setting('test.asset'))),'55000:asset_metadata_IMMUTABLE','asset metadata cannot be deleted');
select is(pg_temp.error_of(format($$update public.asset_rights set basis='licensed' where id=%L$$,current_setting('test.rights'))),'55000:ASSET_RIGHTS_IMMUTABLE','rights basis is immutable');
select is(pg_temp.error_of(format($$delete from public.asset_rights where id=%L$$,current_setting('test.rights'))),'55000:asset_rights_IMMUTABLE','rights cannot be deleted');
select is(pg_temp.error_of($$insert into public.artifacts(workspace_id,project_id,artifact_kind,object_key,mime_type,byte_size) values (current_setting('test.ws')::uuid,null,'input','x/no-project','image/png',1)$$),'23514:new row for relation "artifacts" violates check constraint "artifacts_brand_original_has_no_project"','only brand originals may omit the project');

-- The workspace owner cannot reach the original through the legacy artifact read path.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*)::integer from public.artifacts where id=current_setting('test.artifact')::uuid),0,'legacy artifact reads cannot see brand originals');
select ok((public.platform_asset_query('get_brand_asset',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'asset_id',current_setting('test.asset')))->'record'->>'id') = current_setting('test.asset'),'owner reaches the original through the asset query');
reset role;

-- Studio editor with a brand-scoped grant.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(public.platform_asset_query('get_brand_asset',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'asset_id',current_setting('test.asset')))->'record'->>'usable','true','granted studio editor reads the usable asset');
select is((public.platform_asset_query('list_brand_assets',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'limit',1))->'items'->0->>'id'),current_setting('test.asset'),'granted studio editor lists brand assets');
select ok(pg_temp.begin_upload('upload-editor',repeat('e',64),current_setting('test.rights'))->>'upload_required' = 'true','granted studio editor can begin an upload');
select is(pg_temp.error_of(format($$select public.platform_asset_command('begin_asset_upload',jsonb_build_object('workspace_id',%L,'brand_id',%L,'purpose','photo','filename','x.jpg','mime_type','image/jpeg','byte_size',10,'content_sha256',repeat('9',64),'rights_id',%L),'upload-other-brand','req')$$,current_setting('test.ws'),current_setting('test.brand2'),current_setting('test.rights_other_brand'))),'P0002:NOT_FOUND','brand-scoped grant cannot reach another brand');
select is((select count(*)::integer from public.asset_metadata where workspace_id=current_setting('test.ws')::uuid and brand_id=current_setting('test.brand2')::uuid),0,'RLS hides the ungranted brand''s assets');
select is(pg_temp.error_of(format($$insert into public.asset_rights(workspace_id,brand_id,basis,permitted_uses,identifiable_people,created_by) values (%L,%L,'licensed','{website}','none',auth.uid())$$,current_setting('test.ws'),current_setting('test.brand'))),'42501:permission denied for table asset_rights','clients cannot write rights directly');
select is(pg_temp.error_of(format($$update public.asset_metadata set rights_id=rights_id where id=%L$$,current_setting('test.asset'))),'42501:permission denied for table asset_metadata','clients cannot write asset metadata directly');
reset role;

-- Viewer and revoked grants lose write and, when revoked, read.
update public.studio_memberships set role='viewer' where user_id='ab000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-viewer',repeat('8',64),current_setting('test.rights'))$$),'42501:FORBIDDEN','viewer cannot begin uploads');
reset role;
update public.studio_memberships set role='editor' where user_id='ab000000-0000-4000-8000-000000000002';
update public.workspace_access_grants set status='revoked',revoked_at=statement_timestamp() where id=current_setting('test.grant')::uuid;
set local role authenticated;
select is(pg_temp.error_of(format($$select public.platform_asset_query('get_brand_asset',jsonb_build_object('workspace_id',%L,'brand_id',%L,'asset_id',%L))$$,current_setting('test.ws'),current_setting('test.brand'),current_setting('test.asset'))),'P0002:NOT_FOUND','revoked grant cannot read the asset');
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-editor',repeat('e',64),current_setting('test.rights'))$$),'P0002:NOT_FOUND','revoked grant cannot replay a stored upload intent');
select is((select count(*)::integer from public.asset_metadata where workspace_id=current_setting('test.ws')::uuid),0,'RLS hides all assets after revocation');
reset role;
select set_config('test.editor_artifact',(select artifact_id::text from public.asset_metadata where content_sha256=repeat('e',64)),true);
select set_config('request.jwt.claim.sub','',true);
set local role service_role;
select is(pg_temp.error_of(format($$select public.finalize_brand_asset_upload(%L,%L,2048000,'ab000000-0000-4000-8000-000000000002',10,10)$$,current_setting('test.editor_artifact'),repeat('e',64))),'P0002:NOT_FOUND','queued verification rechecks the revoked initiating actor');
reset role;

-- Other tenant cannot reach client A.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is(pg_temp.error_of(format($$select public.platform_asset_query('list_brand_assets',jsonb_build_object('workspace_id',%L,'brand_id',%L))$$,current_setting('test.ws'),current_setting('test.brand'))),'P0002:NOT_FOUND','another tenant cannot list client A assets');
select is(pg_temp.error_of(format($$select public.platform_asset_query('get_brand_asset',jsonb_build_object('workspace_id',%L,'brand_id',%L,'asset_id',%L))$$,current_setting('test.ws_b'),current_setting('test.brand_b'),current_setting('test.asset'))),'P0002:NOT_FOUND','a forged asset ID under the caller''s own brand is not found');
select is((select count(*)::integer from public.asset_rights where workspace_id=current_setting('test.ws')::uuid),0,'RLS hides client A rights from client B');
reset role;

-- Rights lifecycle controls usability without deleting history.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.platform_asset_command('revoke_asset_rights',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'rights_id',current_setting('test.rights'),'reason','Client withdrew permission'),'revoke-1','req')->'record'->>'current','false','revoked rights are not current');
select is(public.platform_asset_query('get_brand_asset',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'asset_id',current_setting('test.asset')))->'record'->>'unusable_reason','RIGHTS_REVOKED','revoked rights make the asset unusable');
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-after-revoke',repeat('7',64),current_setting('test.rights'))$$),'P0001:RIGHTS_UNAVAILABLE','revoked rights cannot start new uploads');
select is(pg_temp.error_of(format($$select public.platform_asset_command('revoke_asset_rights',jsonb_build_object('workspace_id',%L,'brand_id',%L,'rights_id',%L,'reason','again'),'revoke-2','req')$$,current_setting('test.ws'),current_setting('test.brand'),current_setting('test.rights'))),'P0001:REVISION_CONFLICT','rights are revoked once');
select set_config('test.rights_new',(pg_temp.rights('rights-renewed'))->'record'->>'id',true);
select is(public.platform_asset_command('reassign_asset_rights',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'asset_id',current_setting('test.asset'),'rights_id',current_setting('test.rights_new'),'expected_version',1),'reassign-1','req')->'record'->>'usable','true','renewed rights restore usability for new work');
select is(pg_temp.error_of(format($$select public.platform_asset_command('reassign_asset_rights',jsonb_build_object('workspace_id',%L,'brand_id',%L,'asset_id',%L,'rights_id',%L,'expected_version',1),'reassign-stale','req')$$,current_setting('test.ws'),current_setting('test.brand'),current_setting('test.asset'),current_setting('test.rights_new'))),'P0001:REVISION_CONFLICT','stale reassignment is rejected');
reset role;
-- Expired rights: seeded directly (the command refuses already-expired rights) to model time passing.
insert into public.asset_rights(id,workspace_id,brand_id,basis,permitted_uses,identifiable_people,expires_at,created_by,created_at)
  values ('ab000000-0000-4000-8000-0000000000e1',current_setting('test.ws')::uuid,current_setting('test.brand')::uuid,'licensed','{website}','none',
    statement_timestamp() - interval '1 day','ab000000-0000-4000-8000-000000000001',statement_timestamp() - interval '2 days');
update public.asset_metadata set rights_id='ab000000-0000-4000-8000-0000000000e1' where id=current_setting('test.asset')::uuid;
set local role authenticated;
select is(public.platform_asset_query('get_brand_asset',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.brand'),'asset_id',current_setting('test.asset')))->'record'->>'unusable_reason','RIGHTS_EXPIRED','expired rights make the asset unusable');
select is(pg_temp.error_of($$select pg_temp.begin_upload('upload-expired',repeat('6',64),'ab000000-0000-4000-8000-0000000000e1')$$),'P0001:RIGHTS_UNAVAILABLE','expired rights cannot start new uploads');
reset role;
select is((select count(*)::integer from public.asset_rights where id=current_setting('test.rights')::uuid and revoked_at is not null),1,'revocation history is preserved');
select ok((select count(*) from public.audit_events where workspace_id=current_setting('test.ws')::uuid and action='platform.begin_asset_upload') >= 1,'upload intents are audited');
select ok((select count(*) from public.audit_events where workspace_id=current_setting('test.ws')::uuid and action='platform.revoke_asset_rights') = 1,'rights revocation is audited');
select ok((select count(*) from public.audit_events where workspace_id=current_setting('test.ws')::uuid and action='platform.finalize_brand_asset_upload') = 1,'verification is audited once despite replay');
select ok(not has_function_privilege('authenticated','public.finalize_brand_asset_upload(uuid,text,bigint,uuid,integer,integer,integer)','execute'),'clients cannot call machine verification');
select ok(not has_function_privilege('anon','public.platform_asset_command(text,jsonb,text,text)','execute'),'anonymous callers cannot run asset commands');
select * from finish();
rollback;
