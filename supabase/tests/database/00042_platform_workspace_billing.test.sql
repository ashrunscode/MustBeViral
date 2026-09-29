begin;
select no_plan();
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return '00000'; exception when others then return sqlstate||':'||sqlerrm; end $$;
insert into auth.users(id,aud,role,email,email_confirmed_at) values
  ('a7000000-0000-4000-8000-000000000001','authenticated','authenticated','billing-owner@example.test',now()),
  ('a7000000-0000-4000-8000-000000000002','authenticated','authenticated','billing-editor@example.test',now()),
  ('a7000000-0000-4000-8000-000000000003','authenticated','authenticated','billing-outsider@example.test',now());
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select set_config('test.ws',public.create_workspace('Billing WashBodega','billing-wb','wb','req')->>'workspace_id',true);
select set_config('test.other',public.create_workspace('Billing UnPile','billing-up','up','req')->>'workspace_id',true);
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))->>'profile_present','false','owner read without a profile does not invent a wallet');
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))->>'wallet_balance_micros',null,'missing profile keeps wallet unknown rather than zero');
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))->>'ledger_wallet_available_micros','0','successful ledger read may prove a true zero');
reset role;
insert into public.workspace_billing_profiles(workspace_id,wallet_balance_micros,subscription_status)
  values(current_setting('test.ws')::uuid,250000000,'active'),
        (current_setting('test.other')::uuid,0,'none');
insert into public.ledger_transactions(workspace_id,transaction_id,entry_type,account_code,direction,amount_micros,causative_key)
  values
    (current_setting('test.ws')::uuid,'a7000000-0000-4000-8000-000000000010','credit','funding_clearing','debit',250000000,'synthetic-wb-credit'),
    (current_setting('test.ws')::uuid,'a7000000-0000-4000-8000-000000000010','credit','wallet_available','credit',250000000,'synthetic-wb-credit'),
    (current_setting('test.other')::uuid,'a7000000-0000-4000-8000-000000000011','credit','funding_clearing','debit',1,'synthetic-up-credit'),
    (current_setting('test.other')::uuid,'a7000000-0000-4000-8000-000000000011','credit','wallet_available','credit',1,'synthetic-up-credit');
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))->>'wallet_balance_micros','250000000','WashBodega wallet is the seeded integer micros value');
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.other')))->>'wallet_balance_micros','0','UnPile profile zero is distinct from WashBodega');
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.other')))->>'balances_match','false','mismatched ledger and profile are returned without overwrite');
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))->>'subscription_status','active','active subscription is preserved');
select is(jsonb_typeof(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))->'wallet_balance_micros'),'string','money values stay decimal strings');
reset role;
update public.workspace_billing_profiles set wallet_balance_micros=9007199254740993 where workspace_id=current_setting('test.ws')::uuid;
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select is(public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))->>'wallet_balance_micros','9007199254740993','values above JSON safe integers remain exact');
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000002';
select is(pg_temp.error_of($$select public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))$$),
  'P0002:NOT_FOUND','studio membership is not billing authority');
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000003';
select is(pg_temp.error_of($$select public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))$$),
  'P0002:NOT_FOUND','outsider cannot read workspace billing');
select is(pg_temp.error_of($$select public.platform_billing_query('list_studios','{}')$$),'22023:VALIDATION_FAILED','unknown billing operation fails closed');
set local request.jwt.claim.sub='';
select is(pg_temp.error_of($$select public.platform_billing_query('get_workspace_billing',jsonb_build_object('workspace_id',current_setting('test.ws')))$$),
  '28000:UNAUTHENTICATED','anonymous billing read is denied');
select * from finish();
rollback;
