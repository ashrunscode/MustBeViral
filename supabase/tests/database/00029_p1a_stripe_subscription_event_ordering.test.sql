begin;

select plan(35);

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

-- Applies one Stripe subscription event to an explicit workspace. 1789560000 is the base second
-- every test offsets from.
create or replace function pg_temp.apply_event(
  p_workspace_id uuid,
  p_event_id text,
  p_event_type text,
  p_created_offset integer,
  p_subscription_id text,
  p_status text,
  p_setup_fee_paid boolean default false,
  p_customer_id text default null
)
returns jsonb
language sql
as $$
  select public.apply_stripe_subscription_update(
    p_workspace_id, p_event_id, p_customer_id, p_subscription_id, p_status, p_setup_fee_paid,
    'req_' || p_event_id, p_event_type, 1789560000 + p_created_offset
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
  '99940000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'stripe-subscription-ordering@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
select
  ('99941000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'Subscription Ordering ' || n,
  'stripe-sub-ordering-' || n,
  '99940000-0000-4000-8000-000000000001'
from generate_series(1, 11) as n;

insert into public.workspace_billing_profiles (
  workspace_id, stripe_customer_id, stripe_subscription_id, subscription_status
)
values
  ('99941000-0000-4000-8000-000000000001', null, null, 'none'),
  ('99941000-0000-4000-8000-000000000002', 'cus_order_paid', null, 'none'),
  ('99941000-0000-4000-8000-000000000008', null, 'sub_order_legacy', 'active');

-- 1-3: expand step. The ordered overload sits beside the transitional seven-argument function with
-- the same security contract.
select ok(
  to_regprocedure('public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)') is not null
    and to_regprocedure('public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint)') is not null
    and (
      select count(*)
      from pg_proc as proc
      where proc.pronamespace = 'public'::regnamespace
        and proc.proname = 'apply_stripe_subscription_update'
    ) = 2,
  'the ordered overload is added and the seven-argument function remains until the contract step'
);

select ok(
  exists (
    select 1
    from pg_proc as proc
    where proc.oid = 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint)'::regprocedure
      and proc.prosecdef
      and proc.proconfig = array['search_path=pg_catalog, public']
  ),
  'the ordered signature is security definer with a pinned search_path'
);

select ok(
  has_function_privilege('service_role', 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint)', 'execute')
    and not has_function_privilege('anon', 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint)', 'execute')
    and not has_function_privilege('authenticated', 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint)', 'execute'),
  'only service_role may execute the ordered signature'
);

-- 4-7: the recorded event is all or nothing, always names a subscription and a known type.
select results_eq(
  $sql$
    select column_name::text collate "default", data_type::text collate "default",
      is_nullable::text collate "default"
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workspace_billing_profiles'
      and column_name like 'stripe\_subscription\_event\_%'
    order by column_name
  $sql$,
  $sql$
    values
      ('stripe_subscription_event_created_at', 'timestamp with time zone', 'YES'),
      ('stripe_subscription_event_id', 'text', 'YES'),
      ('stripe_subscription_event_type', 'text', 'YES')
  $sql$,
  'the billing profile records the last applied subscription event'
);

select is(
  pg_temp.error_of($sql$
    update public.workspace_billing_profiles
    set stripe_subscription_id = 'sub_order_partial', stripe_subscription_event_id = 'evt_order_partial'
    where workspace_id = '99941000-0000-4000-8000-000000000001'
  $sql$),
  '23514:new row for relation "workspace_billing_profiles" violates check constraint "workspace_billing_profiles_subscription_event_check"',
  'a partially recorded event is rejected'
);

select is(
  pg_temp.error_of($sql$
    update public.workspace_billing_profiles
    set stripe_subscription_event_id = 'evt_order_no_subscription',
      stripe_subscription_event_type = 'customer.subscription.updated',
      stripe_subscription_event_created_at = statement_timestamp()
    where workspace_id = '99941000-0000-4000-8000-000000000001'
  $sql$),
  '23514:new row for relation "workspace_billing_profiles" violates check constraint "workspace_billing_profiles_subscription_event_check"',
  'a recorded event without its subscription is rejected'
);

select is(
  pg_temp.error_of($sql$
    update public.workspace_billing_profiles
    set stripe_subscription_id = 'sub_order_unknown_type',
      stripe_subscription_event_id = 'evt_order_unknown_type',
      stripe_subscription_event_type = 'invoice.paid',
      stripe_subscription_event_created_at = statement_timestamp()
    where workspace_id = '99941000-0000-4000-8000-000000000001'
  $sql$),
  '23514:new row for relation "workspace_billing_profiles" violates check constraint "workspace_billing_profiles_subscription_event_type_check"',
  'a recorded event of another type is rejected'
);

-- 8-11: the ordering inputs are required and validated before any lock or write.
select is(
  array[
    pg_temp.error_of($sql$
      select pg_temp.apply_event('99941000-0000-4000-8000-000000000001', 'evt_order_type_null',
        null, 0, 'sub_order_validation', 'active')
    $sql$),
    pg_temp.error_of($sql$
      select pg_temp.apply_event('99941000-0000-4000-8000-000000000001', 'evt_order_type_invoice',
        'invoice.paid', 0, 'sub_order_validation', 'active')
    $sql$)
  ],
  array[
    '22023:stripe_event_type is invalid',
    '22023:stripe_event_type is invalid'
  ],
  'a missing or non-subscription event type is invalid'
);

select is(
  array[
    pg_temp.error_of($sql$
      select public.apply_stripe_subscription_update('99941000-0000-4000-8000-000000000001',
        'evt_order_created_null', null, 'sub_order_validation', 'active', false,
        'req_order_created_null', 'customer.subscription.updated', null)
    $sql$),
    pg_temp.error_of($sql$
      select public.apply_stripe_subscription_update('99941000-0000-4000-8000-000000000001',
        'evt_order_created_zero', null, 'sub_order_validation', 'active', false,
        'req_order_created_zero', 'customer.subscription.updated', 0)
    $sql$),
    pg_temp.error_of($sql$
      select public.apply_stripe_subscription_update('99941000-0000-4000-8000-000000000001',
        'evt_order_created_negative', null, 'sub_order_validation', 'active', false,
        'req_order_created_negative', 'customer.subscription.updated', -1)
    $sql$),
    pg_temp.error_of($sql$
      select public.apply_stripe_subscription_update('99941000-0000-4000-8000-000000000001',
        'evt_order_created_far', null, 'sub_order_validation', 'active', false,
        'req_order_created_far', 'customer.subscription.updated', 253402300800)
    $sql$)
  ],
  array[
    '22023:stripe_event_created is invalid',
    '22023:stripe_event_created is invalid',
    '22023:stripe_event_created is invalid',
    '22023:stripe_event_created is invalid'
  ],
  'a missing, non-positive or out-of-range event created time is invalid'
);

select is(
  array[
    pg_temp.error_of($sql$
      select pg_temp.apply_event('99941000-0000-4000-8000-000000000001', 'evt_order_sub_null',
        'customer.subscription.updated', 0, null, 'active')
    $sql$),
    pg_temp.error_of($sql$
      select pg_temp.apply_event('99941000-0000-4000-8000-000000000001', 'evt_order_sub_blank',
        'customer.subscription.updated', 0, '  ', 'active')
    $sql$)
  ],
  array[
    '22023:stripe_subscription_id is required',
    '22023:stripe_subscription_id is required'
  ],
  'a subscription event without a subscription id is invalid'
);

select ok(
  not exists (
    select 1 from public.audit_events
    where action = 'stripe.subscription_update'
      and details ->> 'stripe_event_id' like 'evt\_order\_%'
  )
  and exists (
    select 1 from public.workspace_billing_profiles
    where workspace_id = '99941000-0000-4000-8000-000000000001'
      and subscription_status = 'none'
      and stripe_subscription_id is null
      and stripe_subscription_event_id is null
  ),
  'rejected events write no audit record and no profile state'
);

-- 12-15: the reported race. .created (incomplete, stored as past_due) and .updated (active) share a
-- second, both first failed, and Stripe retried .updated first. Core calls as service_role and
-- resolves the workspace through the customer mapping.
set local role service_role;
select set_config(
  'test.order_paid_updated',
  public.apply_stripe_subscription_update(
    null, 'evt_order_paid_updated', 'cus_order_paid', 'sub_order_paid', 'active', false,
    'req_order_paid_updated', 'customer.subscription.updated', 1789560000
  )::text,
  true
);
select set_config(
  'test.order_paid_created',
  public.apply_stripe_subscription_update(
    null, 'evt_order_paid_created', 'cus_order_paid', 'sub_order_paid', 'past_due', false,
    'req_order_paid_created', 'customer.subscription.created', 1789560000
  )::text,
  true
);
reset role;

select is(
  current_setting('test.order_paid_created')::jsonb,
  jsonb_build_object(
    'workspace_id', '99941000-0000-4000-8000-000000000002',
    'replayed', false,
    'stale', true,
    'subscription_status', 'active',
    'setup_fee_paid', false
  ),
  'a .created landing after .updated in the same second is stale and reports the newer status'
);

select ok(
  (current_setting('test.order_paid_updated')::jsonb ->> 'stale')::boolean = false
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000002'
        and subscription_status = 'active'
        and stripe_subscription_id = 'sub_order_paid'
        and stripe_subscription_event_id = 'evt_order_paid_updated'
        and stripe_subscription_event_type = 'customer.subscription.updated'
        and stripe_subscription_event_created_at = to_timestamp(1789560000)
    ),
  'the paid workspace stays active and still records the .updated event'
);

select results_eq(
  $sql$
    select details ->> 'stripe_event_id', details ->> 'subscription_status',
      (details ->> 'stale')::boolean, (details ->> 'stripe_event_created')::bigint,
      details ->> 'stripe_event_type'
    from public.audit_events
    where action = 'stripe.subscription_update'
      and details ->> 'stripe_event_id' in ('evt_order_paid_updated', 'evt_order_paid_created')
    order by details ->> 'stripe_event_id'
  $sql$,
  $sql$
    values
      ('evt_order_paid_created', 'past_due', true, 1789560000::bigint, 'customer.subscription.created'),
      ('evt_order_paid_updated', 'active', false, 1789560000::bigint, 'customer.subscription.updated')
  $sql$,
  'both deliveries are audited, and the stale one keeps its own status as evidence'
);

select set_config('test.order_paid_created_replay', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000002', 'evt_order_paid_created',
  'customer.subscription.created', 0, 'sub_order_paid', 'past_due')::text, true);

-- The count runs in its own statement so it sees any row the replay wrote.
select is(
  current_setting('test.order_paid_created_replay')::jsonb - 'workspace_id'
    || jsonb_build_object('audit_records', (
      select count(*) from public.audit_events
      where action = 'stripe.subscription_update'
        and details ->> 'stripe_event_id' = 'evt_order_paid_created'
    )),
  jsonb_build_object(
    'replayed', true,
    'stale', true,
    'subscription_status', 'active',
    'setup_fee_paid', false,
    'audit_records', 1
  ),
  'a replay of the stale event reports replayed and stale and writes nothing'
);

-- 16: lifecycle order does not depend on timestamps. A .updated whose second is earlier than the
-- recorded .created of the same subscription still applies.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000003', 'evt_order_clock_created',
  'customer.subscription.created', 100, 'sub_order_clock', 'trialing');
select pg_temp.apply_event('99941000-0000-4000-8000-000000000003', 'evt_order_clock_updated',
  'customer.subscription.updated', 90, 'sub_order_clock', 'active');

select ok(
  exists (
    select 1 from public.workspace_billing_profiles
    where workspace_id = '99941000-0000-4000-8000-000000000003'
      and subscription_status = 'active'
      and stripe_subscription_event_id = 'evt_order_clock_updated'
  ),
  'a later lifecycle stage of the same subscription applies even with an earlier created second'
);

-- 17-18: a deleted subscription stays canceled whatever .updated of that subscription arrives later.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000004', 'evt_order_cancel_active',
  'customer.subscription.updated', 0, 'sub_order_cancel', 'active');
select pg_temp.apply_event('99941000-0000-4000-8000-000000000004', 'evt_order_cancel_deleted',
  'customer.subscription.deleted', 60, 'sub_order_cancel', 'canceled');

select is(
  array[
    pg_temp.apply_event('99941000-0000-4000-8000-000000000004', 'evt_order_cancel_late_earlier',
      'customer.subscription.updated', 30, 'sub_order_cancel', 'active') ->> 'stale',
    pg_temp.apply_event('99941000-0000-4000-8000-000000000004', 'evt_order_cancel_late_same',
      'customer.subscription.updated', 60, 'sub_order_cancel', 'active') ->> 'stale',
    pg_temp.apply_event('99941000-0000-4000-8000-000000000004', 'evt_order_cancel_late_later',
      'customer.subscription.updated', 600, 'sub_order_cancel', 'active') ->> 'stale'
  ],
  array['true', 'true', 'true'],
  'a .updated for a deleted subscription is stale whether its second is earlier, equal or later'
);

select ok(
  exists (
    select 1 from public.workspace_billing_profiles
    where workspace_id = '99941000-0000-4000-8000-000000000004'
      and subscription_status = 'canceled'
      and stripe_subscription_event_id = 'evt_order_cancel_deleted'
  ),
  'the canceled subscription is not reactivated'
);

-- 19-20: two .updated events of one subscription are ordered by created second. A shared second
-- cannot be ordered from the payload and applies in arrival order. From here on each call runs in
-- its own statement, so the assertion after it reads the profile the call left behind.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000005', 'evt_order_updates_newer',
  'customer.subscription.updated', 120, 'sub_order_updates', 'past_due');
select set_config('test.order_updates_older', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000005', 'evt_order_updates_older',
  'customer.subscription.updated', 60, 'sub_order_updates', 'active')::text, true);

select ok(
  (current_setting('test.order_updates_older')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000005'
        and subscription_status = 'past_due'
        and stripe_subscription_event_id = 'evt_order_updates_newer'
    ),
  'a .updated with an earlier created second is stale'
);

select set_config('test.order_updates_tie', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000005', 'evt_order_updates_tie',
  'customer.subscription.updated', 120, 'sub_order_updates', 'active')::text, true);

select ok(
  not (current_setting('test.order_updates_tie')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000005'
        and subscription_status = 'active'
        and stripe_subscription_event_id = 'evt_order_updates_tie'
    ),
  'a .updated sharing the recorded second applies in arrival order'
);

-- 21-23: across subscriptions of one workspace only the created second orders events.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000006', 'evt_order_switch_new',
  'customer.subscription.created', 200, 'sub_order_new', 'active');
select set_config('test.order_switch_old', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000006', 'evt_order_switch_old_deleted',
  'customer.subscription.deleted', 100, 'sub_order_old', 'canceled')::text, true);

select ok(
  (current_setting('test.order_switch_old')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000006'
        and subscription_status = 'active'
        and stripe_subscription_id = 'sub_order_new'
        and stripe_subscription_event_id = 'evt_order_switch_new'
    ),
  'an older deletion of a previous subscription does not cancel the newer one'
);

select set_config('test.order_switch_other', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000006', 'evt_order_switch_other',
  'customer.subscription.updated', 300, 'sub_order_other', 'past_due')::text, true);

select ok(
  not (current_setting('test.order_switch_other')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000006'
        and subscription_status = 'past_due'
        and stripe_subscription_id = 'sub_order_other'
        and stripe_subscription_event_id = 'evt_order_switch_other'
    ),
  'a newer event of another subscription applies and becomes the recorded subscription'
);

select set_config('test.order_switch_tie', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000006', 'evt_order_switch_tie',
  'customer.subscription.created', 300, 'sub_order_tie', 'trialing')::text, true);

select ok(
  not (current_setting('test.order_switch_tie')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000006'
        and subscription_status = 'trialing'
        and stripe_subscription_id = 'sub_order_tie'
        and stripe_subscription_event_id = 'evt_order_switch_tie'
    ),
  'an event of another subscription sharing the recorded second applies in arrival order'
);

-- 24-25: a workspace without a profile gets one from its first event, and a stale event still
-- latches the setup fee and fills a missing customer id, which do not depend on order.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000007', 'evt_order_latch_updated',
  'customer.subscription.updated', 50, 'sub_order_latch', 'active');

select ok(
  exists (
    select 1 from public.workspace_billing_profiles
    where workspace_id = '99941000-0000-4000-8000-000000000007'
      and subscription_status = 'active'
      and stripe_customer_id is null
      and setup_fee_paid_at is null
      and stripe_subscription_id = 'sub_order_latch'
      and stripe_subscription_event_id = 'evt_order_latch_updated'
  ),
  'the first event of a workspace without a billing profile creates it with the event recorded'
);

select set_config('test.order_latch_created', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000007', 'evt_order_latch_created',
  'customer.subscription.created', 50, 'sub_order_latch', 'trialing', true, 'cus_order_latch')::text,
  true);

select ok(
  (current_setting('test.order_latch_created')::jsonb ->> 'stale')::boolean
    and (current_setting('test.order_latch_created')::jsonb ->> 'setup_fee_paid')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000007'
        and subscription_status = 'active'
        and stripe_customer_id = 'cus_order_latch'
        and setup_fee_paid_at is not null
        and stripe_subscription_event_id = 'evt_order_latch_updated'
    ),
  'a stale event latches the setup fee and fills the customer id without changing the status'
);

-- 26: a profile written before this migration has no recorded event, so its next event applies.
select set_config('test.order_legacy', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000008', 'evt_order_legacy',
  'customer.subscription.created', -1000, 'sub_order_legacy', 'past_due')::text, true);

select ok(
  not (current_setting('test.order_legacy')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000008'
        and subscription_status = 'past_due'
        and stripe_subscription_event_id = 'evt_order_legacy'
        and stripe_subscription_event_created_at = to_timestamp(1789560000 - 1000)
    ),
  'a profile without a recorded event applies its next event and records it'
);

-- 27-30: until the contract step, a rolled-back Worker still calls the seven-argument function. It
-- writes unordered, as before this migration, and clears the recorded event, so the next ordered event
-- is never compared against a record the profile no longer matches. Both overloads share replay
-- detection.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000009', 'evt_order_ordered_first',
  'customer.subscription.updated', 0, 'sub_order_transitional', 'active');
select public.apply_stripe_subscription_update(
  '99941000-0000-4000-8000-000000000009', 'evt_order_transitional', null,
  'sub_order_transitional', 'past_due', false, 'req_order_transitional'
);

select ok(
  exists (
    select 1 from public.workspace_billing_profiles
    where workspace_id = '99941000-0000-4000-8000-000000000009'
      and subscription_status = 'past_due'
      and stripe_subscription_event_id is null
      and stripe_subscription_event_type is null
      and stripe_subscription_event_created_at is null
  ),
  'the transitional seven-argument function still applies unordered and clears the recorded event'
);

select set_config('test.order_transitional_replay', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000009', 'evt_order_transitional',
  'customer.subscription.updated', 60, 'sub_order_transitional', 'active')::text, true);

select ok(
  (current_setting('test.order_transitional_replay')::jsonb ->> 'replayed')::boolean
    and not (current_setting('test.order_transitional_replay')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000009'
        and subscription_status = 'past_due'
        and stripe_subscription_event_id is null
    )
    and (
      select count(*) from public.audit_events
      where action = 'stripe.subscription_update'
        and details ->> 'stripe_event_id' = 'evt_order_transitional'
    ) = 1,
  'an event first applied by the seven-argument function replays through the ordered overload'
);

-- A rolled-back Worker switches the workspace to a new subscription after the ordered overload
-- recorded the old subscription's deletion. The new subscription's next ordered event must apply,
-- not be judged an earlier stage of the deleted one.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000010', 'evt_order_rollback_a_updated',
  'customer.subscription.updated', 1000, 'sub_order_rollback_a', 'active');
select pg_temp.apply_event('99941000-0000-4000-8000-000000000010', 'evt_order_rollback_a_deleted',
  'customer.subscription.deleted', 2000, 'sub_order_rollback_a', 'canceled');
select public.apply_stripe_subscription_update(
  '99941000-0000-4000-8000-000000000010', 'evt_order_rollback_b_created', null,
  'sub_order_rollback_b', 'past_due', false, 'req_order_rollback_b_created'
);
select set_config('test.order_rollback_switch', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000010', 'evt_order_rollback_b_updated',
  'customer.subscription.updated', 3000, 'sub_order_rollback_b', 'active')::text, true);

select ok(
  not (current_setting('test.order_rollback_switch')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000010'
        and subscription_status = 'active'
        and stripe_subscription_id = 'sub_order_rollback_b'
        and stripe_subscription_event_id = 'evt_order_rollback_b_updated'
    ),
  'after a rolled-back Worker switches subscriptions, the new subscription''s next event applies'
);

-- A rolled-back Worker applies a late .created over a recorded .updated. The next ordered .updated
-- applies even with an earlier second, which is what arrival order did before this migration.
select pg_temp.apply_event('99941000-0000-4000-8000-000000000011', 'evt_order_rollback_c_updated',
  'customer.subscription.updated', 200, 'sub_order_rollback_c', 'active');
select public.apply_stripe_subscription_update(
  '99941000-0000-4000-8000-000000000011', 'evt_order_rollback_c_created', null,
  'sub_order_rollback_c', 'past_due', false, 'req_order_rollback_c_created'
);
select set_config('test.order_rollback_same', pg_temp.apply_event(
  '99941000-0000-4000-8000-000000000011', 'evt_order_rollback_c_updated_older',
  'customer.subscription.updated', 100, 'sub_order_rollback_c', 'active')::text, true);

select ok(
  not (current_setting('test.order_rollback_same')::jsonb ->> 'stale')::boolean
    and exists (
      select 1 from public.workspace_billing_profiles
      where workspace_id = '99941000-0000-4000-8000-000000000011'
        and subscription_status = 'active'
        and stripe_subscription_event_id = 'evt_order_rollback_c_updated_older'
    ),
  'after a rolled-back Worker writes over a recorded event, the next ordered event applies'
);

-- 31-35: whatever order Stripe delivers one subscription's events in, every workspace converges
-- on the in-order state. Set 1 applies all 24 orders of four events; set 2 adds a deletion in the
-- same second as the last .updated, so only the lifecycle stage orders the newest pair, and applies
-- all 120 orders of five.
create temp table order_events (
  event_set integer not null,
  position integer not null,
  event_type text not null,
  created_offset integer not null,
  status text not null,
  setup_fee_paid boolean not null,
  customer boolean not null,
  primary key (event_set, position)
) on commit drop;

insert into order_events values
  (1, 1, 'customer.subscription.created', 0, 'trialing', true, false),
  (1, 2, 'customer.subscription.updated', 0, 'active', false, false),
  (1, 3, 'customer.subscription.updated', 60, 'past_due', false, true),
  (1, 4, 'customer.subscription.updated', 120, 'active', false, false),
  (2, 1, 'customer.subscription.created', 0, 'trialing', true, false),
  (2, 2, 'customer.subscription.updated', 0, 'active', false, false),
  (2, 3, 'customer.subscription.updated', 60, 'past_due', false, true),
  (2, 4, 'customer.subscription.updated', 120, 'active', false, false),
  (2, 5, 'customer.subscription.deleted', 120, 'canceled', false, false);

create temp table order_runs (
  event_set integer not null,
  run integer not null,
  delivery integer[] not null,
  workspace_id uuid not null,
  primary key (event_set, run)
) on commit drop;

insert into order_runs (event_set, run, delivery, workspace_id)
select event_set, row_number() over (partition by event_set order by delivery), delivery,
  gen_random_uuid()
from (
  with recursive orders (event_set, size, delivery) as (
    select event_set, count(*)::integer, array[]::integer[]
    from order_events
    group by event_set
    union all
    select orders.event_set, orders.size, orders.delivery || event.position
    from orders
    join order_events as event
      on event.event_set = orders.event_set
      and not event.position = any(orders.delivery)
    where cardinality(orders.delivery) < orders.size
  )
  select event_set, delivery from orders where cardinality(delivery) = size
) as complete_orders;

insert into public.workspaces (id, name, slug, created_by)
select workspace_id, 'Subscription Order ' || event_set || '-' || run,
  'stripe-sub-order-' || event_set || '-' || run, '99940000-0000-4000-8000-000000000001'
from order_runs;

do $$
declare
  v_run record;
  v_position integer;
  v_event record;
begin
  for v_run in select * from order_runs order by event_set, run loop
    foreach v_position in array v_run.delivery loop
      select * into v_event from order_events
      where event_set = v_run.event_set and position = v_position;

      perform pg_temp.apply_event(
        v_run.workspace_id,
        format('evt_perm_s%s_r%s_e%s', v_run.event_set, v_run.run, v_position),
        v_event.event_type,
        v_event.created_offset,
        format('sub_perm_s%s_r%s', v_run.event_set, v_run.run),
        v_event.status,
        v_event.setup_fee_paid,
        case when v_event.customer then format('cus_perm_s%s_r%s', v_run.event_set, v_run.run) end
      );
    end loop;
  end loop;
end;
$$;

select is(
  (select count(*)::integer from order_runs group by event_set having event_set = 1)
    || '/' || (select count(*)::integer from order_runs group by event_set having event_set = 2),
  '24/120',
  'every delivery order of both event sets was applied'
);

select results_eq(
  $sql$
    select distinct profile.subscription_status, profile.setup_fee_paid_at is not null,
      right(profile.stripe_subscription_event_id, 3),
      profile.stripe_customer_id = format('cus_perm_s%s_r%s', run.event_set, run.run)
    from order_runs as run
    join public.workspace_billing_profiles as profile on profile.workspace_id = run.workspace_id
    where run.event_set = 1
  $sql$,
  $sql$ values ('active', true, '_e4', true) $sql$,
  'all 24 delivery orders of four events end active, set up and on the newest .updated'
);

select results_eq(
  $sql$
    select distinct profile.subscription_status, profile.setup_fee_paid_at is not null,
      right(profile.stripe_subscription_event_id, 3),
      profile.stripe_customer_id = format('cus_perm_s%s_r%s', run.event_set, run.run)
    from order_runs as run
    join public.workspace_billing_profiles as profile on profile.workspace_id = run.workspace_id
    where run.event_set = 2
  $sql$,
  $sql$ values ('canceled', true, '_e5', true) $sql$,
  'all 120 delivery orders of five events end canceled on the deletion'
);

select is(
  (
    select count(*)::integer
    from public.audit_events
    where action = 'stripe.subscription_update'
      and details ->> 'stripe_event_id' like 'evt\_perm\_%'
  ),
  24 * 4 + 120 * 5,
  'every delivery of every order writes exactly one audit record, stale or not'
);

select ok(
  (
    select count(*) filter (where (details ->> 'stale')::boolean) > 0
      and count(*) filter (where not (details ->> 'stale')::boolean) > 0
    from public.audit_events
    where action = 'stripe.subscription_update'
      and details ->> 'stripe_event_id' like 'evt\_perm\_%'
  ),
  'the delivery orders exercise both applied and stale events'
);

select * from finish();

rollback;
