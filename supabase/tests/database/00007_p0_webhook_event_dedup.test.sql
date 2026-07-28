begin;

select plan(10);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.provider_webhook_events'::regclass
  ),
  'provider webhook claims have enabled and forced RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.provider_webhook_events', 'select'),
  'authenticated callers cannot read the machine-owned replay ledger'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'provider_webhook_events'
  ),
  0,
  'the replay ledger exposes no caller-reachable policy'
);

select ok(
  not has_table_privilege('authenticated', 'public.provider_webhook_events', 'insert'),
  'authenticated callers cannot insert webhook claims directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_provider_webhook_event(text,text,text)',
    'execute'
  ),
  'the backend machine role can execute the narrow claim RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_provider_webhook_event(text,text,text)',
    'execute'
  ),
  'anonymous callers cannot pre-claim provider events'
);

set local role service_role;

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-durable-001', 'request-claim-001')
    ->> 'claim',
  'claimed',
  'the first verified provider event claim succeeds'
);

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-durable-001', 'request-claim-002')
    ->> 'claim',
  'in_progress',
  'a second fresh claim for the same provider event is detected durably'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.provider_webhook_events
    where provider = 'fal' and event_id = 'fal-event-durable-001'
  ),
  1,
  'concurrent claims create exactly one durable row'
);

select is(
  (
    select request_id
    from public.provider_webhook_events
    where provider = 'fal' and event_id = 'fal-event-durable-001'
  ),
  'request-claim-001',
  'an in-progress claim cannot overwrite the original claim evidence'
);

select * from finish();

rollback;
