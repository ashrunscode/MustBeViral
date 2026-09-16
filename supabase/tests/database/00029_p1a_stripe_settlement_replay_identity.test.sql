begin;

-- Core settles a verified Stripe webhook before it records the receipt in stripe_webhook_events,
-- so Stripe retries and redeliveries replay settlement. These tests prove a subscription update
-- serializes concurrent deliveries of one event, and that the operator reconciliation query finds
-- receipts that have no settlement evidence. Wallet top-up replay identity is proven by
-- 00029_p1a_stripe_wallet_top_up.

select plan(2);

-- pgTAP runs in one session, so a second concurrent delivery cannot be started here (dblink
-- would need a password-authenticated connection). Instead this asserts the lock that serializes
-- concurrent deliveries is held and transaction scoped; a two-session probe is the behavioral
-- evidence.
create or replace function pg_temp.holds_xact_advisory_lock(p_key text)
returns boolean
language plpgsql
set client_min_messages = error
as $$
declare
  v_key bigint := hashtextextended(p_key, 0);
  v_held boolean;
begin
  select exists (
    select 1
    from pg_locks as held
    where held.locktype = 'advisory'
      and held.pid = pg_backend_pid()
      and held.granted
      and held.objsubid = 1
      and held.classid::bigint = ((v_key >> 32) & 4294967295)
      and held.objid::bigint = (v_key & 4294967295)
  )
  into v_held;
  -- pg_advisory_unlock releases only session-level locks, so false means transaction scoped.
  return v_held and not pg_advisory_unlock(v_key);
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

-- 1: concurrent deliveries of one subscription event serialize on a transaction-scoped lock.
select public.apply_stripe_subscription_update(
  '99921000-0000-4000-8000-00000000000a',
  'evt_replay_lock_subscription', null, 'sub_replay_lock', 'active', false,
  'req_replay_lock_subscription'
);

select ok(
  pg_temp.holds_xact_advisory_lock('stripe-sub:evt_replay_lock_subscription'),
  'a subscription update holds a transaction-scoped per-event lock'
);

-- 2: the operator reconciliation query lists receipts that have no settlement evidence.
insert into public.stripe_webhook_events (
  stripe_event_id, event_type, livemode, payload_hash, processed_at, created_at
) values
  ('evt_recon_second_event', 'checkout.session.async_payment_succeeded', false, repeat('1', 64),
   '2026-09-01 00:00:01+00', '2026-09-01 00:00:01+00'),
  ('evt_recon_credit_lost', 'checkout.session.async_payment_succeeded', true, repeat('2', 64),
   '2026-09-01 00:00:02+00', '2026-09-01 00:00:02+00'),
  ('evt_recon_subscription_settled', 'customer.subscription.updated', false, repeat('3', 64),
   '2026-09-01 00:00:03+00', '2026-09-01 00:00:03+00'),
  ('evt_recon_subscription_lost', 'customer.subscription.deleted', false, repeat('4', 64),
   '2026-09-01 00:00:04+00', '2026-09-01 00:00:04+00'),
  ('evt_recon_ignored', 'payment_intent.succeeded', false, repeat('5', 64),
   '2026-09-01 00:00:05+00', '2026-09-01 00:00:05+00'),
  ('evt_recon_legacy_credit', 'checkout.session.completed', false, repeat('6', 64),
   '2026-09-01 00:00:06+00', '2026-09-01 00:00:06+00'),
  ('evt_recon_topup_settled', 'checkout.session.completed', false, repeat('7', 64),
   '2026-09-01 00:00:07+00', '2026-09-01 00:00:07+00'),
  ('evt_recon_invoice_paid', 'invoice.paid', false, repeat('8', 64),
   '2026-09-01 00:00:08+00', '2026-09-01 00:00:08+00');

-- Before top-ups were keyed on the Checkout Session, a credit was keyed on its event id. Its
-- metadata names the event, so it is still evidence for its receipt.
select public.record_ledger_movement(
  '99921000-0000-4000-8000-00000000000b', 'credit', 3000000, 'stripe:evt_recon_legacy_credit',
  null, null, 'req_recon_legacy_credit',
  jsonb_build_object('source', 'stripe_webhook', 'stripe_event_id', 'evt_recon_legacy_credit')
);

-- A top-up credit is keyed on its Checkout Session; its metadata names the event that settled it.
select public.apply_stripe_wallet_top_up(
  '99921000-0000-4000-8000-00000000000b', 'cs_test_recon_topup',
  'evt_recon_topup_settled', null, 4000000, 'checkout.session.completed',
  'req_recon_topup_settled', '{}'::jsonb
);

-- A second event for a session another event already credited replays, so it has no evidence of
-- its own and is listed as a candidate.
select public.apply_stripe_wallet_top_up(
  '99921000-0000-4000-8000-00000000000b', 'cs_test_recon_topup',
  'evt_recon_second_event', null, 4000000, 'checkout.session.async_payment_succeeded',
  'req_recon_second_event', '{}'::jsonb
);

-- invoice.paid no longer funds the wallet (ADR-0007), so its receipt is not a settlement gap.

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
      ('evt_recon_second_event'::text, 'checkout.session.async_payment_succeeded'::text, false,
       'wallet_credit'::text, '2026-09-01 00:00:01+00'::timestamptz),
      ('evt_recon_credit_lost'::text, 'checkout.session.async_payment_succeeded'::text, true,
       'wallet_credit'::text, '2026-09-01 00:00:02+00'::timestamptz),
      ('evt_recon_subscription_lost'::text, 'customer.subscription.deleted'::text, false,
       'subscription_update'::text, '2026-09-01 00:00:04+00'::timestamptz)
  $$,
  'reconciliation lists only settling receipts without ledger or audit evidence'
);

select * from finish();

rollback;
