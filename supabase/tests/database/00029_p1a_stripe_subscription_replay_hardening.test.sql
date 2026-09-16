begin;

select plan(19);

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
  '99930000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'stripe-subscription-hardening@example.test',
  '',
  statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  statement_timestamp(),
  statement_timestamp()
);

insert into public.workspaces (id, name, slug, created_by)
values
  ('99931000-0000-4000-8000-00000000000a', 'Subscription Drift A', 'stripe-sub-drift-a',
   '99930000-0000-4000-8000-000000000001'),
  ('99931000-0000-4000-8000-00000000000b', 'Subscription Drift B', 'stripe-sub-drift-b',
   '99930000-0000-4000-8000-000000000001'),
  ('99931000-0000-4000-8000-00000000000c', 'Subscription Shared C', 'stripe-sub-shared-c',
   '99930000-0000-4000-8000-000000000001'),
  ('99931000-0000-4000-8000-00000000000d', 'Subscription Shared D', 'stripe-sub-shared-d',
   '99930000-0000-4000-8000-000000000001');

insert into public.workspace_billing_profiles (workspace_id, stripe_customer_id, subscription_status)
values
  ('99931000-0000-4000-8000-00000000000a', 'cus_sub_drift', 'none'),
  ('99931000-0000-4000-8000-00000000000b', null, 'none'),
  ('99931000-0000-4000-8000-00000000000c', 'cus_sub_shared', 'none'),
  ('99931000-0000-4000-8000-00000000000d', 'cus_sub_shared', 'none');

-- 1-4: access rests on grants. A security-definer body sees its owner as current_user, so an
-- in-function current_user guard cannot tell callers apart; prove the grants instead.
select ok(
  exists (
    select 1
    from pg_proc as proc
    where proc.oid = 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)'::regprocedure
      and proc.prosecdef
      and proc.proconfig = array['search_path=pg_catalog, public']
  ),
  'apply_stripe_subscription_update stays security definer with a pinned search_path'
);

select ok(
  has_function_privilege('service_role', 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)', 'execute')
    and not has_function_privilege('anon', 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)', 'execute'),
  'only service_role may execute apply_stripe_subscription_update'
);

set local role anon;
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_subscription_update(
      '99931000-0000-4000-8000-00000000000a',
      'evt_sub_hardening_anon', null, null, 'active', false, 'req_sub_hardening_anon'
    )
  $sql$),
  '42501:permission denied for function apply_stripe_subscription_update',
  'anon cannot apply a Stripe subscription update'
);
reset role;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '99930000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_subscription_update(
      '99931000-0000-4000-8000-00000000000a',
      'evt_sub_hardening_authenticated', null, null, 'active', false,
      'req_sub_hardening_authenticated'
    )
  $sql$),
  '42501:permission denied for function apply_stripe_subscription_update',
  'an authenticated workspace owner cannot apply a Stripe subscription update'
);
reset role;

-- 5-6: the Core Worker calls as service_role and may omit the workspace id.
set local role service_role;
select set_config(
  'test.sub_first',
  (
    select (result ->> 'workspace_id') || ':' || (result ->> 'replayed')
    from public.apply_stripe_subscription_update(
      null, 'evt_sub_hardening_1', 'cus_sub_drift', 'sub_hardening', 'active', false,
      'req_sub_hardening_1'
    ) as result
  ),
  true
);
reset role;

select is(
  current_setting('test.sub_first'),
  '99931000-0000-4000-8000-00000000000a:false',
  'a service_role update without a workspace id resolves through the Stripe customer mapping'
);

select is(
  (select subscription_status from public.workspace_billing_profiles
   where workspace_id = '99931000-0000-4000-8000-00000000000a'),
  'active',
  'the first delivery applies the subscription status'
);

-- 7-8: a replay applies nothing, even when it carries a different status.
set local role service_role;
select set_config(
  'test.sub_replay_status',
  (
    select (result ->> 'workspace_id') || ':' || (result ->> 'replayed')
    from public.apply_stripe_subscription_update(
      null, 'evt_sub_hardening_1', 'cus_sub_drift', 'sub_hardening', 'canceled', true,
      'req_sub_hardening_2'
    ) as result
  ),
  true
);
reset role;

select is(
  current_setting('test.sub_replay_status'),
  '99931000-0000-4000-8000-00000000000a:true',
  'a replay carrying a different status reports replayed'
);

select ok(
  exists (
    select 1 from public.workspace_billing_profiles
    where workspace_id = '99931000-0000-4000-8000-00000000000a'
      and subscription_status = 'active'
      and setup_fee_paid_at is null
  ),
  'a replay does not rewrite the subscription status or setup fee'
);

-- 9-11: the customer mapping is not immutable. A replay without a workspace id must keep the
-- workspace it first audited instead of raising, or Stripe would retry the event forever.
update public.workspace_billing_profiles
set stripe_customer_id = 'cus_sub_moved'
where workspace_id = '99931000-0000-4000-8000-00000000000a';

update public.workspace_billing_profiles
set stripe_customer_id = 'cus_sub_drift'
where workspace_id = '99931000-0000-4000-8000-00000000000b';

set local role service_role;
select set_config(
  'test.sub_replay_drift',
  (
    select (result ->> 'workspace_id') || ':' || (result ->> 'replayed')
    from public.apply_stripe_subscription_update(
      null, 'evt_sub_hardening_1', 'cus_sub_drift', 'sub_hardening', 'active', false,
      'req_sub_hardening_3'
    ) as result
  ),
  true
);
reset role;

select is(
  current_setting('test.sub_replay_drift'),
  '99931000-0000-4000-8000-00000000000a:true',
  'a lookup replay keeps the audited workspace after the customer mapping moves'
);

select is(
  (select subscription_status from public.workspace_billing_profiles
   where workspace_id = '99931000-0000-4000-8000-00000000000b'),
  'none',
  'the workspace that now owns the customer mapping is not updated by the replay'
);

select is(
  (select stripe_customer_id from public.workspace_billing_profiles
   where workspace_id = '99931000-0000-4000-8000-00000000000a'),
  'cus_sub_moved',
  'a replay does not rewrite the audited workspace customer mapping'
);

-- 12-13: an explicit different workspace is a conflict, reported apart from validation errors.
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_subscription_update(
      '99931000-0000-4000-8000-00000000000b',
      'evt_sub_hardening_1', 'cus_sub_drift', 'sub_hardening', 'active', false,
      'req_sub_hardening_4'
    )
  $sql$),
  'P0001:STRIPE_EVENT_WORKSPACE_MISMATCH',
  'a replay naming another workspace raises a conflict, not a validation error'
);

select is(
  (select count(*)::integer from public.audit_events
   where action = 'stripe.subscription_update'
     and details ->> 'stripe_event_id' = 'evt_sub_hardening_1'),
  1,
  'a Stripe subscription event owns exactly one audit record across all workspaces'
);

-- 14: a lookup matching several billing profiles is refused rather than picking one.
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_subscription_update(
      null, 'evt_sub_hardening_ambiguous', 'cus_sub_shared', 'sub_shared', 'active', true,
      'req_sub_hardening_ambiguous'
    )
  $sql$),
  'P0001:STRIPE_CUSTOMER_AMBIGUOUS',
  'a customer mapped to several workspaces is refused instead of resolved arbitrarily'
);

-- 15: the common metadata path, a replay naming the audited workspace, applies nothing.
set local role service_role;
select set_config(
  'test.sub_replay_explicit',
  (
    select (result ->> 'workspace_id') || ':' || (result ->> 'replayed') || ':'
      || (result ->> 'subscription_status')
    from public.apply_stripe_subscription_update(
      '99931000-0000-4000-8000-00000000000a',
      'evt_sub_hardening_1', 'cus_sub_moved', 'sub_hardening', 'past_due', true,
      'req_sub_hardening_5'
    ) as result
  ),
  true
);
reset role;

select is(
  current_setting('test.sub_replay_explicit'),
  '99931000-0000-4000-8000-00000000000a:true:active',
  'a replay naming the audited workspace reports replayed without applying its status'
);

-- 16-17: the database, not only the advisory lock, enforces one audit record per event.
select ok(
  pg_get_indexdef(to_regclass('public.audit_events_stripe_subscription_event_key'))
    = 'CREATE UNIQUE INDEX audit_events_stripe_subscription_event_key ON public.audit_events USING btree (((details ->> ''stripe_event_id''::text))) WHERE (action = ''stripe.subscription_update''::text)'
  and to_regclass('public.audit_events_stripe_subscription_event_idx') is null,
  'a unique partial index on the lookup expression replaces the non-unique event index'
);

select is(
  pg_temp.error_of($sql$
    insert into public.audit_events (
      workspace_id, actor_type, action, entity_type, entity_id, request_id, details
    ) values (
      '99931000-0000-4000-8000-00000000000b', 'system', 'stripe.subscription_update',
      'workspace_billing_profile', '99931000-0000-4000-8000-00000000000b',
      'req_sub_hardening_duplicate', '{"stripe_event_id":"evt_sub_hardening_1"}'::jsonb
    )
  $sql$),
  '23505:duplicate key value violates unique constraint "audit_events_stripe_subscription_event_key"',
  'a second audit record for the same Stripe event is rejected by the database'
);

-- 18: unchanged behaviour for an unknown customer.
select is(
  pg_temp.error_of($sql$
    select public.apply_stripe_subscription_update(
      null, 'evt_sub_hardening_unknown', 'cus_sub_unknown', null, 'active', false,
      'req_sub_hardening_unknown'
    )
  $sql$),
  'P0002:WORKSPACE_NOT_FOUND',
  'an unknown customer without a workspace id still reports WORKSPACE_NOT_FOUND'
);

-- 19: a first delivery that names its workspace never consults the customer mapping.
set local role service_role;
select set_config(
  'test.sub_explicit_first',
  (
    select (result ->> 'workspace_id') || ':' || (result ->> 'replayed') || ':'
      || (result ->> 'subscription_status')
    from public.apply_stripe_subscription_update(
      '99931000-0000-4000-8000-00000000000c',
      'evt_sub_hardening_explicit', 'cus_sub_shared', 'sub_shared_c', 'trialing', false,
      'req_sub_hardening_explicit'
    ) as result
  ),
  true
);
reset role;

select is(
  current_setting('test.sub_explicit_first'),
  '99931000-0000-4000-8000-00000000000c:false:trialing',
  'a first delivery naming its workspace applies even when its customer is shared'
);

select * from finish();

rollback;
