begin;

-- Core settles a verified Stripe webhook before it records the receipt in stripe_webhook_events,
-- so Stripe retries and redeliveries replay settlement. These tests prove the settlement RPCs
-- apply each Stripe event exactly once under replay, including when the workspace resolves
-- differently on the replay, and that the operator reconciliation query finds receipts that
-- have no settlement evidence.

select plan(14);

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

-- pgTAP runs in one session, so a second concurrent delivery cannot be started here. Instead
-- this asserts the lock that serializes concurrent deliveries is held until the transaction
-- ends; a separate two-session probe is the behavioral evidence.
create or replace function pg_temp.holds_xact_advisory_lock(p_key text)
returns boolean
language sql
as $$
  select exists (
    select 1
    from pg_locks as held, (select hashtextextended(p_key, 0) as value) as lock_key
    where held.locktype = 'advisory'
      and held.pid = pg_backend_pid()
      and held.granted
      and held.objsubid = 1
      and held.classid::bigint = ((lock_key.value >> 32) & 4294967295)
      and held.objid::bigint = (lock_key.value & 4294967295)
  );
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
  '99920000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'stripe-replay-owner@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values
  (
    '99921000-0000-4000-8000-00000000000a',
    'Stripe replay workspace A',
    'stripe-replay-workspace-a',
    '99920000-0000-4000-8000-000000000001'
  ),
  (
    '99921000-0000-4000-8000-00000000000b',
    'Stripe replay workspace B',
    'stripe-replay-workspace-b',
    '99920000-0000-4000-8000-000000000001'
  );

insert into public.workspace_billing_profiles (workspace_id, stripe_customer_id)
values ('99921000-0000-4000-8000-00000000000a', 'cus_replay_drift');

-- 1-4: an explicit workspace id on replay cannot move a credit to another workspace.
select is(
  (public.apply_stripe_wallet_credit(
    '99921000-0000-4000-8000-00000000000a',
    'evt_replay_explicit', null, 50000000, 'checkout.session.completed',
    'req_replay_explicit_1', '{}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'the first wallet credit for a Stripe event applies'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_credit(
      '99921000-0000-4000-8000-00000000000b',
      'evt_replay_explicit', null, 50000000, 'checkout.session.completed',
      'req_replay_explicit_2', '{}'::jsonb
    )
  $sql$),
  '22023:STRIPE_EVENT_WORKSPACE_MISMATCH',
  'a Stripe wallet credit cannot be replayed into another workspace'
);

select is(
  (select count(*)::integer from public.ledger_transactions
   where workspace_id = '99921000-0000-4000-8000-00000000000b'),
  0,
  'the rejected replay writes no ledger rows in the other workspace'
);

select is(
  (select count(distinct transaction_id)::integer from public.ledger_transactions
   where causative_key = 'stripe:evt_replay_explicit'),
  1,
  'a Stripe event id owns exactly one ledger transaction across all workspaces'
);

-- 5-10: the stripe_customer_id lookup is neither unique nor immutable, so a replay whose payload
-- carries no workspace id can resolve to a different workspace than the original delivery did.
select is(
  public.apply_stripe_wallet_credit(
    null,
    'evt_replay_lookup', 'cus_replay_drift', 20000000, 'invoice.paid',
    'req_replay_lookup_1', '{}'::jsonb
  ) ->> 'workspace_id',
  '99921000-0000-4000-8000-00000000000a',
  'a credit without a workspace id resolves through the Stripe customer mapping'
);

update public.workspace_billing_profiles
set stripe_customer_id = 'cus_replay_moved'
where workspace_id = '99921000-0000-4000-8000-00000000000a';

insert into public.workspace_billing_profiles (workspace_id, stripe_customer_id)
values ('99921000-0000-4000-8000-00000000000b', 'cus_replay_drift')
on conflict (workspace_id) do update set stripe_customer_id = excluded.stripe_customer_id;

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_credit(
      null,
      'evt_replay_lookup', 'cus_replay_drift', 20000000, 'invoice.paid',
      'req_replay_lookup_2', '{}'::jsonb
    )
  $sql$),
  '22023:STRIPE_EVENT_WORKSPACE_MISMATCH',
  'a replay that resolves the customer to another workspace does not credit it again'
);

select is(
  (select wallet_balance_micros from public.workspace_billing_profiles
   where workspace_id = '99921000-0000-4000-8000-00000000000b'),
  0::bigint,
  'the workspace that now owns the customer mapping was not credited'
);

select is(
  (public.apply_stripe_wallet_credit(
    '99921000-0000-4000-8000-00000000000a',
    'evt_replay_lookup', null, 20000000, 'invoice.paid',
    'req_replay_lookup_3', '{}'::jsonb
  ) ->> 'replayed')::boolean,
  true,
  'a replay into the original workspace still reports replayed'
);

select is(
  (select wallet_balance_micros from public.workspace_billing_profiles
   where workspace_id = '99921000-0000-4000-8000-00000000000a'),
  70000000::bigint,
  'the original workspace was credited once per Stripe event'
);

select is(
  (select sum(case direction when 'credit' then amount_micros else -amount_micros end)::bigint
   from public.ledger_transactions
   where workspace_id = '99921000-0000-4000-8000-00000000000a'
     and account_code = 'wallet_available'),
  70000000::bigint,
  'the wallet_available ledger matches the profile balance after replays'
);

-- 11-12: concurrent deliveries of one Stripe event serialize on a transaction-scoped lock.
select public.apply_stripe_wallet_credit(
  '99921000-0000-4000-8000-00000000000a',
  'evt_replay_lock_credit', null, 1000000, 'checkout.session.completed',
  'req_replay_lock_credit', '{}'::jsonb
);

select ok(
  pg_temp.holds_xact_advisory_lock('stripe-credit:evt_replay_lock_credit'),
  'a wallet credit holds its per-event lock until the transaction ends'
);

select public.apply_stripe_subscription_update(
  '99921000-0000-4000-8000-00000000000a',
  'evt_replay_lock_subscription', null, 'sub_replay_lock', 'active', false,
  'req_replay_lock_subscription'
);

select ok(
  pg_temp.holds_xact_advisory_lock('stripe-sub:evt_replay_lock_subscription'),
  'a subscription update holds its per-event lock until the transaction ends'
);

-- 13: the replaced function keeps its security contract.
select ok(
  (select proc.prosecdef
     and proc.proconfig = array['search_path=pg_catalog, public']
   from pg_proc as proc
   where proc.oid =
     'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)'::regprocedure)
  and has_function_privilege('service_role',
    'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)', 'execute')
  and not has_function_privilege('anon',
    'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated',
    'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)', 'execute'),
  'apply_stripe_wallet_credit stays security definer, pinned search_path and service_role only'
);

-- 14: the operator reconciliation query lists receipts that have no settlement evidence.
insert into public.stripe_webhook_events (
  stripe_event_id, event_type, livemode, payload_hash, processed_at, created_at
) values
  ('evt_recon_credit_settled', 'checkout.session.completed', false, repeat('1', 64),
   '2026-09-01 00:00:01+00', '2026-09-01 00:00:01+00'),
  ('evt_recon_credit_lost', 'invoice.paid', true, repeat('2', 64),
   '2026-09-01 00:00:02+00', '2026-09-01 00:00:02+00'),
  ('evt_recon_subscription_settled', 'customer.subscription.updated', false, repeat('3', 64),
   '2026-09-01 00:00:03+00', '2026-09-01 00:00:03+00'),
  ('evt_recon_subscription_lost', 'customer.subscription.deleted', false, repeat('4', 64),
   '2026-09-01 00:00:04+00', '2026-09-01 00:00:04+00'),
  ('evt_recon_ignored', 'payment_intent.succeeded', false, repeat('5', 64),
   '2026-09-01 00:00:05+00', '2026-09-01 00:00:05+00'),
  ('evt_replay_explicit', 'checkout.session.completed', false, repeat('6', 64),
   '2026-09-01 00:00:06+00', '2026-09-01 00:00:06+00');

select public.apply_stripe_wallet_credit(
  '99921000-0000-4000-8000-00000000000b',
  'evt_recon_credit_settled', null, 3000000, 'checkout.session.completed',
  'req_recon_credit_settled', '{}'::jsonb
);

select public.apply_stripe_subscription_update(
  '99921000-0000-4000-8000-00000000000b',
  'evt_recon_subscription_settled', null, 'sub_recon', 'past_due', false,
  'req_recon_subscription_settled'
);

-- A subscription update for an unrelated event id must not count as evidence for a receipt.
select public.apply_stripe_subscription_update(
  '99921000-0000-4000-8000-00000000000b',
  'evt_recon_unrelated', null, 'sub_recon', 'active', false,
  'req_recon_unrelated'
);

-- The operator runs this file in a read-only session. Switching this transaction to read only
-- first means any write in the file would abort the test.
set transaction read only;

\o /dev/null
\ir ../operator/stripe_webhook_settlement_gaps.psql
\o

select results_eq(
  'stripe_webhook_settlement_gaps',
  $$
    values
      ('evt_recon_credit_lost'::text, 'invoice.paid'::text, true,
       'wallet_credit'::text, '2026-09-01 00:00:02+00'::timestamptz),
      ('evt_recon_subscription_lost'::text, 'customer.subscription.deleted'::text, false,
       'subscription_update'::text, '2026-09-01 00:00:04+00'::timestamptz)
  $$,
  'reconciliation lists only settling receipts without ledger or audit evidence'
);

select * from finish();

rollback;
