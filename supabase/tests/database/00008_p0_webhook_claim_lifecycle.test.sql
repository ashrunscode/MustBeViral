begin;

select plan(17);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.provider_webhook_events'::regclass
  ),
  'provider webhook lifecycle rows retain enabled and forced RLS'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'provider_webhook_events'
  ),
  0,
  'the webhook lifecycle table remains deny-all without policies'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_provider_webhook_event(text,text,text)',
    'execute'
  ),
  'the backend machine role can claim an event'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.mark_provider_webhook_event_processed(text,text)',
    'execute'
  ),
  'the backend machine role can mark an event processed'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.release_provider_webhook_event(text,text)',
    'execute'
  ),
  'the backend machine role can release an unprocessed claim'
);

set local role service_role;

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-lifecycle-001', 'request-claim-001')
    ->> 'claim',
  'claimed',
  'a fresh event is claimed'
);

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-lifecycle-001', 'request-claim-002')
    ->> 'claim',
  'in_progress',
  'a second worker sees a fresh claim in progress'
);

select is(
  (public.mark_provider_webhook_event_processed('fal', 'fal-event-lifecycle-001')
    ->> 'marked')::boolean,
  true,
  'a claimed event can be marked processed'
);

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-lifecycle-001', 'request-claim-003')
    ->> 'claim',
  'duplicate',
  'a processed event suppresses replay as an idempotent duplicate'
);

select is(
  (public.release_provider_webhook_event('fal', 'fal-event-lifecycle-001')
    ->> 'released')::boolean,
  false,
  'release refuses to delete a processed event'
);

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-lifecycle-002', 'request-release-001')
    ->> 'claim',
  'claimed',
  'a separate failed-ingest fixture is initially claimed'
);

select is(
  (public.release_provider_webhook_event('fal', 'fal-event-lifecycle-002')
    ->> 'released')::boolean,
  true,
  'an unprocessed claim can be released after failed ingest'
);

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-lifecycle-002', 'request-release-002')
    ->> 'claim',
  'claimed',
  'a released failed ingest can be claimed again on provider redelivery'
);

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-lifecycle-003', 'request-stale-001')
    ->> 'claim',
  'claimed',
  'a stale-recovery fixture is initially claimed'
);

reset role;

update public.provider_webhook_events
set claimed_at = statement_timestamp() - interval '6 minutes'
where provider = 'fal' and event_id = 'fal-event-lifecycle-003';

set local role service_role;

select is(
  public.claim_provider_webhook_event('fal', 'fal-event-lifecycle-003', 'request-stale-002')
    ->> 'claim',
  'claimed',
  'a claim older than five minutes is reclaimed'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.provider_webhook_events', 'select'),
  'authenticated callers still cannot select webhook lifecycle rows'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_provider_webhook_event(text,text,text)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.mark_provider_webhook_event_processed(text,text)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.release_provider_webhook_event(text,text)',
    'execute'
  ),
  'authenticated callers cannot execute any webhook lifecycle RPC'
);

select * from finish();

rollback;
