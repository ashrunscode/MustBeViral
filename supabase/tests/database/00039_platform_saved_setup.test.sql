begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
create function pg_temp.cmd(op text,payload jsonb,key text) returns jsonb language sql as $$
  select public.platform_setup_command(op,payload,key,'synthetic-setup-test');
$$;
create function pg_temp.draft_input() returns jsonb language sql as $$
  select jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br'),
    'expected_version',1,'website_url','https://example.test','description','Operator input, not approved knowledge',
    'audience','Synthetic audience','goals','Synthetic goals','current_step','details');
$$;
insert into auth.users(id,aud,role,email,email_confirmed_at) values
  ('a4000000-0000-4000-8000-000000000001','authenticated','authenticated','setup-owner@example.test',now()),
  ('a4000000-0000-4000-8000-000000000002','authenticated','authenticated','setup-editor@example.test',now()),
  ('a4000000-0000-4000-8000-000000000003','authenticated','authenticated','setup-outsider@example.test',now()),
  ('a4000000-0000-4000-8000-000000000004','authenticated','authenticated','setup-unverified@example.test',null);
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select set_config('test.studio',public.platform_command('create_studio','{"name":"Synthetic setup studio","slug":"setup-studio"}','studio','req')->'record'->>'id',true);
select set_config('test.wb',pg_temp.cmd('start_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'name','WashBodega','slug','washbodega'),'wb')::text,true);
select set_config('test.ws',current_setting('test.wb')::jsonb->'brand'->>'workspace_id',true);
select set_config('test.br',current_setting('test.wb')::jsonb->'brand'->>'id',true);
select is(pg_temp.cmd('start_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'name','WashBodega','slug','washbodega'),'wb')::text,
  current_setting('test.wb'),'start replay returns one durable workspace, brand and draft');
select is(pg_temp.error_of($$select pg_temp.cmd('start_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'name','Changed','slug','washbodega'),'wb')$$),
  'P0001:IDEMPOTENCY_CONFLICT','changed start payload does not allocate another tenant');
select set_config('test.up',pg_temp.cmd('start_brand_draft',jsonb_build_object('studio_id',current_setting('test.studio'),'name','UnPile','slug','unpile'),'up')::text,true);
select isnt(current_setting('test.up')::jsonb->'brand'->>'workspace_id',current_setting('test.ws'),'two brands can have separate durable tenant boundaries');
select is(jsonb_array_length(public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio')))->'items'),2,'portfolio resolves both explicit grants');
select is(public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio'),'search','PILE'))->'items'->0->>'name','UnPile','case-insensitive portfolio search');
select is(jsonb_array_length(public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio'),'search','%'))->'items'),0,'search treats SQL wildcards literally');
select set_config('test.cursor',public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio'),'limit',1))->>'next_cursor',true);
select is(jsonb_array_length(public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio'),'limit',1,'cursor',current_setting('test.cursor')))->'items'),1,'portfolio pagination has no duplicate first page');
select is(pg_temp.error_of($$select public.platform_setup_query('list_studio_brands',jsonb_build_object('studio_id',current_setting('test.studio'),'search','different','cursor',current_setting('test.cursor')))$$),
  '22023:VALIDATION_FAILED','cursor cannot cross search scope');
select is(pg_temp.cmd('save_brand_draft',pg_temp.draft_input(),'save')->'record'->>'version','2','save persists an acknowledged revision');
select is(pg_temp.cmd('save_brand_draft',pg_temp.draft_input(),'save')->'record'->>'version','2','retry after lost acknowledgement replays same save');
select is(pg_temp.error_of($$select pg_temp.cmd('save_brand_draft',pg_temp.draft_input(),'stale')$$),'P0001:REVISION_CONFLICT','concurrent stale draft cannot overwrite');
select is(public.platform_setup_query('get_brand_draft',jsonb_build_object('workspace_id',current_setting('test.ws'),'brand_id',current_setting('test.br')))->'record'->>'description',
  'Operator input, not approved knowledge','reload reads committed operator input');
select is(public.platform_setup_query('get_brand_draft',jsonb_build_object('workspace_id',current_setting('test.up')::jsonb->'brand'->>'workspace_id','brand_id',current_setting('test.up')::jsonb->'brand'->>'id'))->'record'->>'description',
  '','other brand draft remains untouched');
select is(pg_temp.error_of($$select pg_temp.cmd('save_brand_draft',pg_temp.draft_input()||'{"website_url":"https://user:password@example.test"}','url')$$),'22023:VALIDATION_FAILED','credential-bearing website input denied');
select is(pg_temp.error_of($$select pg_temp.cmd('save_brand_draft',pg_temp.draft_input()||'{"approved":true}','approved')$$),'22023:VALIDATION_FAILED','draft cannot smuggle approval');
select is(pg_temp.error_of($$update public.brand_onboarding_drafts set goals='bypass'$$),'42501:permission denied for table brand_onboarding_drafts','direct draft writes remain forbidden');
select is(pg_temp.error_of($$select public.platform_setup_query('get_brand_draft',jsonb_build_object('workspace_id',current_setting('test.up')::jsonb->'brand'->>'workspace_id','brand_id',current_setting('test.br')))$$),
  'P0002:NOT_FOUND','forged parent brand relation is hidden');
select set_config('test.settings',public.platform_setup_query('get_workspace_settings',jsonb_build_object('workspace_id',current_setting('test.ws')))->'record'->>'updated_at',true);
select is(pg_temp.cmd('update_workspace_settings',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Synthetic workspace settings','slug','setup-workspace-settings','expected_updated_at',current_setting('test.settings')),'settings')->'record'->>'name',
  'Synthetic workspace settings','owner can change workspace identity without touching money');
select is(pg_temp.error_of($$select pg_temp.cmd('update_workspace_settings',jsonb_build_object('workspace_id',current_setting('test.ws'),'name','Stale','slug','stale','expected_updated_at',current_setting('test.settings')),'stale-settings')$$),
  'P0001:REVISION_CONFLICT','stale workspace settings conflict');
select set_config('test.invite',pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','setup-editor@example.test','role','editor','expected_version',1),'invite')->'record'->>'id',true);
select is(pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','setup-editor@example.test','role','editor','expected_version',1),'invite')->'record'->>'id',current_setting('test.invite'),'invitation creation replays without duplicate or extra access');
select is(pg_temp.error_of($$select pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','other@example.test','role','owner','expected_version',2),'owner-escalation')$$),
  '22023:VALIDATION_FAILED','owner role cannot be invited');
select is(pg_temp.error_of($$select pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','other@example.test','role','viewer','expected_version',1),'stale-team')$$),
  'P0001:REVISION_CONFLICT','stale team changes are rejected');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from public.studio_invitations),0,'outsider cannot enumerate invitation email addresses');
select is(pg_temp.error_of($$select pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.invite'),'expected_version',1),'wrong-recipient')$$),
  'P0002:NOT_FOUND','exact wrong recipient cannot accept');
select is(pg_temp.error_of($$select public.platform_setup_query('get_workspace_settings',jsonb_build_object('workspace_id',current_setting('test.ws')))$$),'P0002:NOT_FOUND','outsider cannot read workspace settings');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.brands),0,'pending invitation grants no brand read');
select is(public.platform_setup_query('list_my_invitations','{}')->'items'->0->>'studio_name','Synthetic setup studio','verified intended recipient can preview exact invited studio');
select is(pg_temp.error_of($$select pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.invite'),'expected_version',2),'stale-accept')$$),'P0001:REVISION_CONFLICT','accept requires current invitation version');
select is(pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.invite'),'expected_version',1),'accept')->'record'->>'status','accepted','intended verified recipient accepts');
select is(pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.invite'),'expected_version',1),'accept')->'record'->>'status','accepted','accepted invitation replays without another membership');
select is((select count(*)::integer from public.brands),2,'accepted editor sees only the studio explicit grants');
select is(pg_temp.cmd('save_brand_draft',pg_temp.draft_input()||'{"expected_version":2,"goals":"Editor correction"}','editor-save')->'record'->>'goals','Editor correction','accepted editor may save permitted brand input');
select is(pg_temp.error_of($$select public.platform_setup_query('get_workspace_settings',jsonb_build_object('workspace_id',current_setting('test.ws')))$$),'P0002:NOT_FOUND','studio role never implies tenant billing or owner settings');
select is(pg_temp.error_of($$select pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','other@example.test','role','viewer','expected_version',3),'editor-invite')$$),
  '42501:FORBIDDEN','editor cannot invite or expand studio membership');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select public.platform_command('revoke_studio_member',jsonb_build_object('studio_id',current_setting('test.studio'),'user_id','a4000000-0000-4000-8000-000000000002','expected_version',3),'revoke-member','req');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000002';
select is(pg_temp.error_of($$select pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.invite'),'expected_version',1),'accept')$$),'42501:FORBIDDEN','accepted replay cannot resurrect revoked membership');
select is(pg_temp.error_of($$select pg_temp.cmd('save_brand_draft',pg_temp.draft_input()||'{"expected_version":2,"goals":"Editor correction"}','editor-save')$$),'P0002:NOT_FOUND','revoked editor cannot replay saved tenant data');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select set_config('test.unverified',pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','setup-unverified@example.test','role','viewer','expected_version',4),'unverified')->'record'->>'id',true);
select set_config('test.expired',pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','setup-outsider@example.test','role','viewer','expected_version',5),'expired')->'record'->>'id',true);
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000004';
select is(jsonb_array_length(public.platform_setup_query('list_my_invitations','{}')->'items'),0,'unverified email sees no invitations');
select is(pg_temp.error_of($$select pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.unverified'),'expected_version',1),'unverified-accept')$$),'P0002:NOT_FOUND','unverified recipient cannot accept');
reset role;
update public.studio_invitations set created_at=now()-interval '9 days',expires_at=now()-interval '2 days' where id=current_setting('test.expired')::uuid;
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000003';
select is(pg_temp.error_of($$select pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.expired'),'expected_version',1),'expired-accept')$$),'P0001:RESOURCE_ARCHIVED','expired invitation cannot create access');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select set_config('test.fresh',pg_temp.cmd('create_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'recipient_email','setup-outsider@example.test','role','viewer','expected_version',6),'fresh')->'record'->>'id',true);
select isnt(current_setting('test.fresh'),current_setting('test.expired'),'expired invitation replacement has fresh identity');
select is(pg_temp.cmd('revoke_studio_invitation',jsonb_build_object('studio_id',current_setting('test.studio'),'invitation_id',current_setting('test.fresh'),'expected_version',1),'revoke-invite')->'record'->>'status','revoked','owner can revoke pending invitation');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000003';
select is(pg_temp.error_of($$select pg_temp.cmd('accept_studio_invitation',jsonb_build_object('invitation_id',current_setting('test.fresh'),'expected_version',1),'revoked-accept')$$),'P0001:RESOURCE_ARCHIVED','revoked invitation cannot be accepted');
reset role;
update public.studio_memberships set status='revoked',revoked_at=now(),version=version+1 where studio_id=current_setting('test.studio')::uuid and role='owner';
select is((select status from public.studio_invitations where id=current_setting('test.unverified')::uuid),'revoked','owner revocation durably revokes pending invitations');
update public.studio_memberships set status='active',revoked_at=null,version=version+1 where studio_id=current_setting('test.studio')::uuid and role='owner';
select is((select status from public.studio_invitations where id=current_setting('test.unverified')::uuid),'revoked','restoring owner cannot restore an old invitation');
select ok((select count(*) from public.studio_events where action like '%invitation%')>=6,'invitation transitions audited without email in audit details');
select ok((select count(*) from public.audit_events where action='platform.save_brand_draft' and workspace_id=current_setting('test.ws')::uuid)=2,'exactly two acknowledged saves audited');
select * from finish();
rollback;
