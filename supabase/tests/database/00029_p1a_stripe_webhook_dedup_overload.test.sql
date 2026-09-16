begin;

select plan(10);

-- 20260830170000_p1a_kill_switch_stripe_rpcs.sql meant to replace record_stripe_webhook_event, but
-- CREATE OR REPLACE with a different argument list adds an overload instead. That four-argument
-- overload compared a boolean with an integer and failed with SQLSTATE 42883 on every call, after
-- PostgREST had already resolved it by named arguments. The five-argument overload with the
-- {claim} contract is the only working one; its behavior is covered by
-- 00029_p1a_stripe_wallet_credit.test.sql.

select hasnt_function(
  'public',
  'record_stripe_webhook_event',
  array['text', 'text', 'boolean', 'text'],
  'the broken four-argument record_stripe_webhook_event overload is dropped'
);

select has_function(
  'public',
  'record_stripe_webhook_event',
  array['text', 'text', 'boolean', 'text', 'text'],
  'the five-argument record_stripe_webhook_event overload remains'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'record_stripe_webhook_event'
  ),
  1,
  'record_stripe_webhook_event has exactly one overload'
);

select ok(
  (
    select procedure.prosecdef
      and pg_catalog.pg_get_function_result(procedure.oid) = 'jsonb'
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.record_stripe_webhook_event(text, text, boolean, text, text)'::regprocedure
  ),
  'the remaining overload is still a SECURITY DEFINER function returning jsonb'
);

select is(
  (
    select procedure.proconfig
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.record_stripe_webhook_event(text, text, boolean, text, text)'::regprocedure
  ),
  array['search_path=pg_catalog'],
  'the remaining overload pins search_path to pg_catalog'
);

select ok(
  has_function_privilege('service_role',
    'public.record_stripe_webhook_event(text, text, boolean, text, text)'::regprocedure,
    'execute'),
  'service_role keeps execute on the remaining overload'
);

select ok(
  not has_function_privilege('public',
    'public.record_stripe_webhook_event(text, text, boolean, text, text)'::regprocedure,
    'execute')
  and not has_function_privilege('anon',
    'public.record_stripe_webhook_event(text, text, boolean, text, text)'::regprocedure,
    'execute')
  and not has_function_privilege('authenticated',
    'public.record_stripe_webhook_event(text, text, boolean, text, text)'::regprocedure,
    'execute'),
  'public, anon and authenticated still cannot execute the remaining overload'
);

-- PostgREST calls RPCs with named arguments. A four-argument call now fails at name resolution
-- instead of resolving to a function that raised "operator does not exist" at runtime.
select throws_matching(
  $$
    select public.record_stripe_webhook_event(
      p_stripe_event_id => 'evt_overload_four_args',
      p_event_type => 'checkout.session.completed',
      p_livemode => false,
      p_payload_hash => repeat('b', 64)
    )
  $$,
  '^function public\.record_stripe_webhook_event\(.*\) does not exist$',
  'a four named-argument call no longer resolves to any overload'
);

select is(
  public.record_stripe_webhook_event(
    p_stripe_event_id => 'evt_overload_named_args',
    p_event_type => 'checkout.session.completed',
    p_livemode => false,
    p_payload_hash => repeat('b', 64),
    p_request_id => 'req-overload-named-args'
  ) ->> 'claim',
  'inserted',
  'a five named-argument call still returns the claim contract'
);

select is(
  (
    select count(*)::integer
    from public.stripe_webhook_events
    where stripe_event_id in ('evt_overload_four_args', 'evt_overload_named_args')
  ),
  1,
  'the five named-argument call recorded one event and the unresolved call recorded none'
);

select * from finish();

rollback;
