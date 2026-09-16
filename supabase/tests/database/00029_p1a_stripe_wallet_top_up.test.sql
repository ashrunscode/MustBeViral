begin;

-- Only a paid wallet top-up Checkout Session funds the prepaid usage wallet (ADR-0007), and it
-- funds it once. apply_stripe_wallet_top_up is keyed on the Checkout Session, not on the Stripe
-- event, so checkout.session.completed, checkout.session.async_payment_succeeded and duplicate
-- Event objects for one session settle into a single credit that cannot move to another
-- workspace. These tests pin that contract.

select plan(46);

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

-- pgTAP runs in one session, so a second concurrent delivery cannot be started here. This
-- asserts the lock that serializes concurrent deliveries is held and transaction scoped.
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

-- 1-10: the function contract, and the retired event-keyed function.
select has_function(
  'public', 'apply_stripe_wallet_top_up',
  array['uuid', 'text', 'text', 'text', 'bigint', 'text', 'text', 'jsonb'],
  'apply_stripe_wallet_top_up takes the Checkout Session id'
);

select is(
  (select count(*)::integer from pg_proc
   where proname = 'apply_stripe_wallet_top_up'
     and pronamespace = 'public'::regnamespace),
  1,
  'apply_stripe_wallet_top_up has exactly one overload'
);

select ok(
  (select proc.prosecdef and proc.proconfig = array['search_path=pg_catalog']
   from pg_proc as proc
   where proc.oid = 'public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb)'::regprocedure),
  'apply_stripe_wallet_top_up is security definer with search_path pinned to pg_catalog'
);

select ok(
  has_function_privilege('service_role',
    'public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb)', 'execute'),
  'service_role can execute apply_stripe_wallet_top_up'
);

select ok(
  not has_function_privilege('anon',
    'public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated',
    'public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb)', 'execute'),
  'anon and authenticated cannot execute apply_stripe_wallet_top_up'
);

select ok(
  not exists (
    select 1
    from pg_proc as proc, aclexplode(proc.proacl) as acl
    where proc.oid = 'public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb)'::regprocedure
      and acl.grantee = 0
  ),
  'PUBLIC has no execute grant on apply_stripe_wallet_top_up'
);

select has_function(
  'public', 'apply_stripe_wallet_credit',
  array['uuid', 'text', 'text', 'bigint', 'text', 'text', 'jsonb'],
  'the event-keyed apply_stripe_wallet_credit keeps its signature until the contract migration'
);

select ok(
  (select proc.prosecdef and proc.proconfig = array['search_path=pg_catalog']
   from pg_proc as proc
   where proc.oid = 'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)'::regprocedure)
  and not has_function_privilege('anon',
    'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated',
    'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)', 'execute'),
  'the retired apply_stripe_wallet_credit stays security definer, pinned search_path, service_role only'
);

-- A rolled-back Core Worker still calls it. It must refuse, or it would credit a top-up again
-- under the event key and credit subscription payments again.
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_credit(
      '99931000-0000-4000-8000-00000000000a', 'evt_retired_credit', 'cus_retired', 64900000,
      'invoice.paid', 'req_retired_credit', '{}'::jsonb
    )
  $sql$),
  '0A000:apply_stripe_wallet_credit is retired; use apply_stripe_wallet_top_up',
  'the retired apply_stripe_wallet_credit refuses every call'
);

select is(
  (select count(*)::integer from public.ledger_transactions
   where causative_key = 'stripe:evt_retired_credit'),
  0,
  'the refused call writes no ledger rows'
);

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
  '99930000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'stripe-topup-owner@example.test',
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
    '99931000-0000-4000-8000-00000000000a',
    'Stripe top-up workspace A',
    'stripe-topup-workspace-a',
    '99930000-0000-4000-8000-000000000001'
  ),
  (
    '99931000-0000-4000-8000-00000000000b',
    'Stripe top-up workspace B',
    'stripe-topup-workspace-b',
    '99930000-0000-4000-8000-000000000001'
  );

-- 11-17: one Checkout Session credits once across its completed, async and duplicate events.
select is(
  (public.apply_stripe_wallet_top_up(
    '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_1',
    'evt_topup_completed', 'cus_topup_first', 50000000, 'checkout.session.completed',
    'req_topup_completed', '{}'::jsonb
  ) ->> 'replayed')::boolean,
  false,
  'the first event for a paid top-up credits the wallet'
);

select is(
  (public.apply_stripe_wallet_top_up(
    '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_1',
    'evt_topup_async', 'cus_topup_other', 50000000, 'checkout.session.async_payment_succeeded',
    'req_topup_async', '{}'::jsonb
  ) ->> 'replayed')::boolean,
  true,
  'async_payment_succeeded for the same session replays instead of crediting again'
);

select is(
  (public.apply_stripe_wallet_top_up(
    '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_1',
    'evt_topup_duplicate_object', 'cus_topup_first', 50000000, 'checkout.session.completed',
    'req_topup_duplicate_object', '{}'::jsonb
  ) ->> 'replayed')::boolean,
  true,
  'a separate Event object for the same session replays'
);

select is(
  (select count(*)::integer || ':' || count(distinct transaction_id)::integer
   from public.ledger_transactions
   where causative_key = 'stripe:checkout_session:cs_test_topup_1'),
  '2:1',
  'the session owns one balanced ledger transaction'
);

select is(
  (select wallet_balance_micros from public.workspace_billing_profiles
   where workspace_id = '99931000-0000-4000-8000-00000000000a'),
  50000000::bigint,
  'the wallet holds a single credit for the session'
);

select is(
  (select (metadata ->> 'stripe_checkout_session_id') || ':' || (metadata ->> 'stripe_event_id')
     || ':' || (metadata ->> 'event_type')
   from public.ledger_transactions
   where causative_key = 'stripe:checkout_session:cs_test_topup_1'
     and account_code = 'wallet_available'),
  'cs_test_topup_1:evt_topup_completed:checkout.session.completed',
  'the credit records its Checkout Session and the event that settled it'
);

select is(
  (select stripe_customer_id from public.workspace_billing_profiles
   where workspace_id = '99931000-0000-4000-8000-00000000000a'),
  'cus_topup_first',
  'the first credit links the Stripe customer and a replay does not rewrite it'
);

-- 18-21: a credited session cannot move to another workspace or change its amount.
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000b', 'cs_test_topup_1',
      'evt_topup_other_workspace', 'cus_topup_first', 50000000, 'checkout.session.completed',
      'req_topup_other_workspace', '{}'::jsonb
    )
  $sql$),
  'P0001:STRIPE_EVENT_WORKSPACE_MISMATCH',
  'a credited top-up cannot be replayed into another workspace'
);

select is(
  (select count(*)::integer from public.ledger_transactions
   where workspace_id = '99931000-0000-4000-8000-00000000000b'),
  0,
  'the rejected replay writes no ledger rows in the other workspace'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_1',
      'evt_topup_changed_amount', 'cus_topup_first', 50000001, 'checkout.session.completed',
      'req_topup_changed_amount', '{}'::jsonb
    )
  $sql$),
  'P0001:IDEMPOTENCY_CONFLICT',
  'a replay with a changed amount is rejected'
);

-- Credits for one session in two workspaces cannot be written by this function; a replay must
-- not pick one if such rows ever exist.
select public.record_ledger_movement(
  '99931000-0000-4000-8000-00000000000a', 'credit', 1000000,
  'stripe:checkout_session:cs_test_topup_split', null, null, 'req_topup_split_a', '{}'::jsonb
);
select public.record_ledger_movement(
  '99931000-0000-4000-8000-00000000000b', 'credit', 1000000,
  'stripe:checkout_session:cs_test_topup_split', null, null, 'req_topup_split_b', '{}'::jsonb
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_split',
      'evt_topup_split', null, 1000000, 'checkout.session.completed',
      'req_topup_split', '{}'::jsonb
    )
  $sql$),
  'P0001:STRIPE_EVENT_WORKSPACE_MISMATCH',
  'naming one of the credited workspaces does not make a split credit replayable'
);

-- 22-27: customers may be shared across workspaces, so a top-up credits only the workspace it
-- names, fills a missing customer id, never re-points an existing one, and a second session is a
-- separate credit.
insert into public.workspace_billing_profiles (workspace_id, stripe_customer_id)
values ('99931000-0000-4000-8000-00000000000b', null);

select is(
  (public.apply_stripe_wallet_top_up(
    '99931000-0000-4000-8000-00000000000b', 'cs_test_topup_shared_customer',
    'evt_topup_shared_customer', 'cus_topup_first', 7000000, 'checkout.session.completed',
    'req_topup_shared_customer', '{}'::jsonb
  ) ->> 'workspace_id'),
  '99931000-0000-4000-8000-00000000000b',
  'a top-up from a shared customer credits the workspace it names'
);

select is(
  (select stripe_customer_id from public.workspace_billing_profiles
   where workspace_id = '99931000-0000-4000-8000-00000000000b'),
  'cus_topup_first',
  'a top-up fills a missing customer id, even when another workspace shares the customer'
);

select is(
  (public.apply_stripe_wallet_top_up(
    '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_2',
    'evt_topup_second', 'cus_topup_second', 25000000, 'checkout.session.completed',
    'req_topup_second', '{}'::jsonb
  ) ->> 'wallet_balance_micros')::bigint,
  75000000::bigint,
  'a second top-up session credits separately'
);

select is(
  (select stripe_customer_id from public.workspace_billing_profiles
   where workspace_id = '99931000-0000-4000-8000-00000000000a'),
  'cus_topup_first',
  'a top-up paid by another customer does not re-point the workspace customer id'
);

select is(
  (select string_agg(workspace_id::text || '=' || wallet_balance_micros, ',' order by workspace_id)
   from public.workspace_billing_profiles
   where workspace_id in (
     '99931000-0000-4000-8000-00000000000a',
     '99931000-0000-4000-8000-00000000000b'
   )),
  '99931000-0000-4000-8000-00000000000a=75000000,99931000-0000-4000-8000-00000000000b=7000000',
  'each workspace sharing the customer holds only its own top-ups'
);

select is(
  (select sum(case direction when 'credit' then amount_micros else -amount_micros end)::bigint
   from public.ledger_transactions
   where workspace_id = '99931000-0000-4000-8000-00000000000b'
     and account_code = 'wallet_available'
     and causative_key <> 'stripe:checkout_session:cs_test_topup_split'),
  7000000::bigint,
  'the wallet_available ledger matches the profile balance'
);

-- 28: concurrent deliveries for one session serialize on a transaction-scoped lock.
select public.apply_stripe_wallet_top_up(
  '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_lock',
  'evt_topup_lock', null, 1000000, 'checkout.session.async_payment_succeeded',
  'req_topup_lock', '{}'::jsonb
);

select ok(
  pg_temp.holds_xact_advisory_lock('stripe-credit:checkout_session:cs_test_topup_lock'),
  'a top-up credit holds a transaction-scoped per-session lock'
);

-- 29: Stripe may change id prefixes and lengths, so an id is checked by character set and a
-- length that fits the 240-character ledger causative key.
select public.apply_stripe_wallet_top_up(
  '99931000-0000-4000-8000-00000000000a', repeat('x', 216),
  'evt_topup_long_id', null, 1000000, 'checkout.session.completed',
  'req_topup_long_id', '{}'::jsonb
);

select is(
  (select length(causative_key)::text || ':' || count(*)::text
   from public.ledger_transactions
   where causative_key = 'stripe:checkout_session:' || repeat('x', 216)
   group by causative_key),
  '240:2',
  'a 216-character session id with another prefix credits under a 240-character key'
);

-- 30-46: inputs that cannot be a paid top-up credit are rejected before any write.
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_invoice',
      'evt_topup_invoice', 'cus_topup_first', 64900000, 'invoice.paid',
      'req_topup_invoice', '{}'::jsonb
    )
  $sql$),
  '22023:event_type does not fund the wallet',
  'invoice.paid never funds the wallet'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_intent',
      'evt_topup_intent', 'cus_topup_first', 1000000, 'payment_intent.succeeded',
      'req_topup_intent', '{}'::jsonb
    )
  $sql$),
  '22023:event_type does not fund the wallet',
  'other payment events never fund the wallet'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_null_event_type',
      'evt_topup_null_event_type', null, 1000000, null,
      'req_topup_null_event_type', '{}'::jsonb
    )
  $sql$),
  '22023:event_type does not fund the wallet',
  'a null event type is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      null, 'cs_test_topup_no_workspace',
      'evt_topup_no_workspace', 'cus_topup_first', 1000000, 'checkout.session.completed',
      'req_topup_no_workspace', '{}'::jsonb
    )
  $sql$),
  '22023:workspace_id is required',
  'a top-up must name its workspace, even when its customer maps to one'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-0000000000ff', 'cs_test_topup_unknown_workspace',
      'evt_topup_unknown_workspace', null, 1000000, 'checkout.session.completed',
      'req_topup_unknown_workspace', '{}'::jsonb
    )
  $sql$),
  'P0002:WORKSPACE_NOT_FOUND',
  'a top-up naming a workspace that does not exist is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test topup',
      'evt_topup_bad_session', null, 1000000, 'checkout.session.completed',
      'req_topup_bad_session', '{}'::jsonb
    )
  $sql$),
  '22023:stripe_checkout_session_id is invalid',
  'a Checkout Session id with a space is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs-test-topup',
      'evt_topup_hyphen_session', null, 1000000, 'checkout.session.completed',
      'req_topup_hyphen_session', '{}'::jsonb
    )
  $sql$),
  '22023:stripe_checkout_session_id is invalid',
  'a Checkout Session id with hyphens is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup;drop',
      'evt_topup_punctuated_session', null, 1000000, 'checkout.session.completed',
      'req_topup_punctuated_session', '{}'::jsonb
    )
  $sql$),
  '22023:stripe_checkout_session_id is invalid',
  'a Checkout Session id with punctuation is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', '',
      'evt_topup_blank_session', null, 1000000, 'checkout.session.completed',
      'req_topup_blank_session', '{}'::jsonb
    )
  $sql$),
  '22023:stripe_checkout_session_id is invalid',
  'a blank Checkout Session id is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', null,
      'evt_topup_null_session', null, 1000000, 'checkout.session.completed',
      'req_topup_null_session', '{}'::jsonb
    )
  $sql$),
  '22023:stripe_checkout_session_id is invalid',
  'a null Checkout Session id is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', repeat('a', 217),
      'evt_topup_long_session', null, 1000000, 'checkout.session.completed',
      'req_topup_long_session', '{}'::jsonb
    )
  $sql$),
  '22023:stripe_checkout_session_id is invalid',
  'a Checkout Session id longer than the ledger key allows is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_zero',
      'evt_topup_zero', null, 0, 'checkout.session.completed',
      'req_topup_zero', '{}'::jsonb
    )
  $sql$),
  '22023:amount_micros must be positive',
  'a non-positive amount is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_null_amount',
      'evt_topup_null_amount', null, null, 'checkout.session.completed',
      'req_topup_null_amount', '{}'::jsonb
    )
  $sql$),
  '22023:amount_micros must be positive',
  'a null amount is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_blank_event',
      '  ', null, 1000000, 'checkout.session.completed',
      'req_topup_blank_event', '{}'::jsonb
    )
  $sql$),
  '22023:stripe_event_id is required',
  'a blank Stripe event id is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_blank_request',
      'evt_topup_blank_request', null, 1000000, 'checkout.session.completed',
      '', '{}'::jsonb
    )
  $sql$),
  '22023:request_id is required',
  'a blank request id is rejected'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_wallet_top_up(
      '99931000-0000-4000-8000-00000000000a', 'cs_test_topup_array_metadata',
      'evt_topup_array_metadata', null, 1000000, 'checkout.session.completed',
      'req_topup_array_metadata', '[]'::jsonb
    )
  $sql$),
  '22023:metadata must be an object',
  'non-object metadata is rejected'
);

select is(
  (select count(*)::integer from public.ledger_transactions
   where causative_key not in (
     'stripe:checkout_session:cs_test_topup_1',
     'stripe:checkout_session:cs_test_topup_2',
     'stripe:checkout_session:cs_test_topup_shared_customer',
     'stripe:checkout_session:cs_test_topup_lock',
     'stripe:checkout_session:cs_test_topup_split',
     'stripe:checkout_session:' || repeat('x', 216)
   )
     and workspace_id in (
       '99931000-0000-4000-8000-00000000000a',
       '99931000-0000-4000-8000-00000000000b'
     )),
  0,
  'rejected inputs wrote no ledger rows'
);

select * from finish();

rollback;
