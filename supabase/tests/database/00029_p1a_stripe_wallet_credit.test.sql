begin;

select plan(6);

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
  'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
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

insert into public.workspaces (
  id, name, slug, created_by, per_run_spend_cap_micros, daily_spend_cap_micros
) values (
  '50000000-0000-4000-8000-000000000001',
  'Stripe Wallet Workspace',
  'stripe-wallet-workspace',
  'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
  8000000,
  25000000
);

insert into public.workspace_memberships (workspace_id, user_id)
values (
  '50000000-0000-4000-8000-000000000001',
  'dddddddd-dddd-4ddd-8ddd-dddddddddd01'
);

select is(
  (public.apply_stripe_wallet_credit(
    '50000000-0000-4000-8000-000000000001',
    'evt_wallet_credit_1',
    'cus_wallet_1',
    50000000,
    'checkout.session.completed',
    'req-wallet-credit-1',
    '{}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'apply_stripe_wallet_credit writes the first wallet credit once'
);

select is(
  (public.apply_stripe_wallet_credit(
    '50000000-0000-4000-8000-000000000001',
    'evt_wallet_credit_1',
    'cus_wallet_1',
    50000000,
    'checkout.session.completed',
    'req-wallet-credit-replay',
    '{}'::jsonb
  ) ->> 'replayed')::boolean,
  true,
  'apply_stripe_wallet_credit replays duplicate stripe event ids'
);

select is(
  (
    select profile.wallet_balance_micros
    from public.workspace_billing_profiles as profile
    where profile.workspace_id = '50000000-0000-4000-8000-000000000001'
  ),
  50000000::bigint,
  'wallet profile balance reflects a single credited amount'
);

select is(
  (
    select count(*)::integer
    from public.ledger_transactions
    where causative_key = 'stripe:evt_wallet_credit_1'
  ),
  2,
  'duplicate wallet credit replay creates no extra ledger rows'
);

select is(
  (
    select sum(case direction when 'credit' then amount_micros else -amount_micros end)::bigint
    from public.ledger_transactions
    where workspace_id = '50000000-0000-4000-8000-000000000001'
      and account_code = 'wallet_available'
  ),
  50000000::bigint,
  'wallet available balance stays balanced after stripe credit replay'
);

select is(
  (
    select profile.stripe_customer_id
    from public.workspace_billing_profiles as profile
    where profile.workspace_id = '50000000-0000-4000-8000-000000000001'
  ),
  'cus_wallet_1',
  'wallet credit upserts stripe customer linkage on the billing profile'
);

select * from finish();

rollback;
