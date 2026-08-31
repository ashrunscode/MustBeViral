begin;

select plan(8);

create or replace function pg_temp.error_of(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000:';
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '99900000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'stripe-wallet-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '99910000-0000-4000-8000-000000000001',
  'Stripe Wallet Workspace',
  'stripe-wallet-workspace',
  '99900000-0000-4000-8000-000000000001'
);

insert into public.workspace_billing_profiles (
  workspace_id,
  stripe_customer_id,
  wallet_balance_micros,
  subscription_status
)
values (
  '99910000-0000-4000-8000-000000000001',
  'cus_wallet_test',
  0,
  'none'
);

select is(
  (
    select (public.apply_stripe_wallet_credit(
      '99910000-0000-4000-8000-000000000001',
      'evt_wallet_credit_1',
      'cus_wallet_test',
      50000000,
      'checkout.session.completed',
      'req_wallet_1',
      '{}'::jsonb
    ) ->> 'replayed')::boolean
  ),
  false,
  'first wallet credit applies ledger and profile balance'
);

select is(
  (
    select wallet_balance_micros
    from public.workspace_billing_profiles
    where workspace_id = '99910000-0000-4000-8000-000000000001'
  ),
  50000000::bigint,
  'wallet profile balance increases by credited micros'
);

select is(
  (
    select count(*)::integer
    from public.ledger_transactions
    where workspace_id = '99910000-0000-4000-8000-000000000001'
      and entry_type = 'credit'
      and causative_key = 'stripe:evt_wallet_credit_1'
  ),
  2,
  'wallet credit writes a balanced ledger pair'
);

select is(
  (
    select (public.apply_stripe_wallet_credit(
      '99910000-0000-4000-8000-000000000001',
      'evt_wallet_credit_1',
      'cus_wallet_test',
      50000000,
      'checkout.session.completed',
      'req_wallet_2',
      '{}'::jsonb
    ) ->> 'replayed')::boolean
  ),
  true,
  'duplicate stripe event id replays without double credit'
);

select is(
  (
    select wallet_balance_micros
    from public.workspace_billing_profiles
    where workspace_id = '99910000-0000-4000-8000-000000000001'
  ),
  50000000::bigint,
  'duplicate wallet credit leaves profile balance unchanged'
);

select is(
  (
    select (public.apply_stripe_subscription_update(
      '99910000-0000-4000-8000-000000000001',
      'evt_sub_active_1',
      'cus_wallet_test',
      'sub_wallet_test',
      'active',
      true,
      'req_sub_1'
    ) ->> 'replayed')::boolean
  ),
  false,
  'first subscription update applies profile state'
);

select is(
  (
    select subscription_status
    from public.workspace_billing_profiles
    where workspace_id = '99910000-0000-4000-8000-000000000001'
  ),
  'active',
  'subscription status persists on billing profile'
);

select is(
  (
    select (public.apply_stripe_subscription_update(
      '99910000-0000-4000-8000-000000000001',
      'evt_sub_active_1',
      'cus_wallet_test',
      'sub_wallet_test',
      'active',
      true,
      'req_sub_2'
    ) ->> 'replayed')::boolean
  ),
  true,
  'duplicate subscription event id replays without duplicate audit'
);

select * from finish();

rollback;
