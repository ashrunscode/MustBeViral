begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate || ':' || sqlerrm; end $$;

insert into auth.users(id, aud, role, email) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'platform-owner@example.test'),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'platform-editor@example.test'),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'platform-outsider@example.test');
insert into public.workspaces(id, name, slug, created_by) values
  ('b1000000-0000-4000-8000-000000000001', 'WashBodega synthetic', 'platform-washbodega', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'UnPile synthetic', 'platform-unpile', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000003', 'Orphan synthetic', 'platform-orphan', 'a1000000-0000-4000-8000-000000000001');
insert into public.workspace_memberships(workspace_id, user_id) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001');
create temporary table original_counts as select
  (select count(*) from public.ledger_transactions) ledger,
  (select count(*) from public.workspaces) workspaces,
  (select count(*) from public.workspace_memberships) memberships;
select is(pg_temp.error_of($$select app_private.backfill_platform_identity(array[
  'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003']::uuid[])$$),
  'P0001:BACKFILL_OWNER_CONFLICT', 'orphan prevents the entire bounded backfill');
select is((select count(*) from public.brands), 0::bigint, 'failed backfill creates no partial brands');
select is(pg_temp.error_of($$select app_private.backfill_platform_identity(array[
  'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001']::uuid[])$$),
  '22023:BACKFILL_INVALID_WORKSPACE_SET', 'duplicate input is explicit');
select is(pg_temp.error_of($$select app_private.backfill_platform_identity(array[
  'b1000000-0000-4000-8000-000000000099']::uuid[])$$),
  'P0002:BACKFILL_WORKSPACE_NOT_ACTIVE', 'missing workspace is explicit');
select is(app_private.backfill_platform_identity(array[
  'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002']::uuid[]) ->> 'workspaces_created',
  '2', 'authoritative owner maps WashBodega and UnPile separately');
select is((select count(*) from public.studios), 1::bigint, 'same owner has one mapped personal studio');
select is((select count(distinct brand_id) from public.platform_workspace_mappings), 2::bigint, 'brands preserve separate IDs');
select is(app_private.backfill_platform_identity(array[
  'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002']::uuid[]) ->> 'workspaces_created',
  '0', 'backfill replay preserves identities');
select is((select count(*) from public.ledger_transactions), (select ledger from original_counts), 'ledger row count unchanged');
select is((select count(*) from public.workspaces), (select workspaces from original_counts), 'workspace identities unchanged');
select is((select count(*) from public.workspace_memberships), (select memberships from original_counts), 'no implicit workspace membership added');

select set_config('test.studio', (select studio_id::text from public.platform_owner_studio_mappings), true);
select set_config('test.wb_brand', (select brand_id::text from public.platform_workspace_mappings where workspace_id = 'b1000000-0000-4000-8000-000000000001'), true);
select set_config('test.up_brand', (select brand_id::text from public.platform_workspace_mappings where workspace_id = 'b1000000-0000-4000-8000-000000000002'), true);
select set_config('test.wb_grant', (select grant_id::text from public.platform_workspace_mappings where workspace_id = 'b1000000-0000-4000-8000-000000000001'), true);
insert into public.studio_memberships(studio_id, user_id, role)
  values (current_setting('test.studio')::uuid, 'a1000000-0000-4000-8000-000000000002', 'editor');
insert into public.brand_locations(workspace_id, brand_id, name, slug, time_zone, created_by)
  values ('b1000000-0000-4000-8000-000000000001', current_setting('test.wb_brand')::uuid,
    'Synthetic location', 'synthetic-location', 'America/Chicago', 'a1000000-0000-4000-8000-000000000001');
select alike(pg_temp.error_of($$insert into public.brand_locations(workspace_id,brand_id,name,slug,time_zone,created_by)
  values ('b1000000-0000-4000-8000-000000000002',current_setting('test.wb_brand')::uuid,'Cross tenant','cross','UTC',
    'a1000000-0000-4000-8000-000000000001')$$), '23503:%', 'composite FK rejects cross-workspace child');

set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000002';
select is((select count(*) from public.studios), 1::bigint, 'explicit studio member reads studio');
select is((select count(*) from public.brands), 2::bigint, 'editor reads both currently granted brands');
select is((select count(*) from public.brand_locations), 1::bigint, 'location grant permits scoped read');
select is((select count(*) from public.workspaces), 0::bigint, 'portfolio grant does not weaken legacy workspace RLS');
select ok(not app_private.is_workspace_owner('b1000000-0000-4000-8000-000000000001'), 'portfolio editor is not workspace owner');
select ok(not app_private.platform_can('b1000000-0000-4000-8000-000000000001',null,'billing:read'), 'no implicit billing action');
select alike(pg_temp.error_of($$update public.brands set name='Unauthorized direct write'$$), '42501:%', 'all direct brand writes denied');
select alike(pg_temp.error_of($$select app_private.backfill_platform_identity('{}'::uuid[])$$), '42501:%', 'user cannot call operator backfill');
reset role;
update public.studio_memberships set role='viewer', version=version+1
  where studio_id=current_setting('test.studio')::uuid and user_id='a1000000-0000-4000-8000-000000000002';
set local role authenticated;
select ok(not app_private.platform_can('b1000000-0000-4000-8000-000000000001',current_setting('test.wb_brand')::uuid,'brand:write'),
  'viewer excludes writes even when studio grant allows them');
reset role;
update public.workspace_access_grants set status='revoked', revoked_at=statement_timestamp(), version=version+1
  where workspace_id='b1000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select count(*) from public.brands), 1::bigint, 'revoked UnPile grant immediately removes its brand');
select is((select count(*) from public.workspace_access_grants), 1::bigint, 'studio list contains only current permitted grants');
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000003';
select is((select count(*) from public.studios), 0::bigint, 'forged studio identity cannot read portfolio');
select is((select count(*) from public.brands), 0::bigint, 'outsider cannot read either brand');
select ok(not app_private.platform_grant_current(current_setting('test.wb_grant')::uuid), 'helper does not reveal another tenant grant state');
reset role;
update public.workspace_memberships set status='revoked', revoked_at=statement_timestamp()
  where workspace_id='b1000000-0000-4000-8000-000000000001';
insert into public.workspace_memberships(workspace_id,user_id)
  values ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003');
select is(pg_temp.error_of($$select app_private.backfill_platform_identity(array['b1000000-0000-4000-8000-000000000001']::uuid[])$$),
  'P0001:BACKFILL_MAPPING_CONFLICT', 'owner transfer never silently reassigns recorded mapping');
set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000002';
select is((select count(*) from public.brands), 0::bigint, 'old owner grant becomes unusable after ownership changes');
reset role;
select is((select status from public.workspace_access_grants where id=current_setting('test.wb_grant')::uuid), 'revoked', 'owner change revokes grant durably');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('studios','studio_memberships','brands','brand_locations','workspace_access_grants',
    'platform_owner_studio_mappings','platform_workspace_mappings','project_brand_mappings','studio_events') and c.relrowsecurity and c.relforcerowsecurity),
  9::bigint, 'RLS enabled and forced on every new user-visible table');
select alike(pg_temp.error_of($$update public.brands set id=gen_random_uuid()$$), '22023:PLATFORM_IDENTITY_IMMUTABLE', 'brand identity immutable');
select alike(pg_temp.error_of($$delete from public.platform_workspace_mappings$$), '55000:%', 'mapping cannot be destroyed to fake rollback');
set local role authenticated;
set local request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';
select ok(public.create_workspace('Old client synthetic','old-client-platform','old-contract','old-client-request')->>'workspace_id' is not null,
  'previous application create_workspace remains callable after additive migration');
reset role;
select finish();
rollback;
