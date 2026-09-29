begin;

select plan(17);

-- record_stripe_webhook_event claims a Stripe event id in the dedup ledger. It must reject missing or
-- blank inputs with SQLSTATE 22023, like the Stripe settlement RPCs, instead of claiming an empty
-- event id (which would mark every later blank-id event a duplicate) or surfacing a raw not-null
-- violation. The valid path and the {claim} contract stay unchanged.
--
-- throws_ok undoes a failed call's insert either way, so the blank-string cases prove rejection,
-- not ordering. The null cases on NOT NULL columns prove the guards run before the insert: an insert
-- first would raise 23502 instead of 22023.

select throws_ok(
  $$select public.record_stripe_webhook_event(null, 'checkout.session.completed', false, repeat('a', 64), 'req-blank')$$,
  '22023',
  'stripe_event_id is required',
  'a null stripe_event_id is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('', 'checkout.session.completed', false, repeat('a', 64), 'req-blank')$$,
  '22023',
  'stripe_event_id is required',
  'an empty stripe_event_id is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('   ', 'checkout.session.completed', false, repeat('a', 64), 'req-blank')$$,
  '22023',
  'stripe_event_id is required',
  'a whitespace-only stripe_event_id is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_type_null', null, false, repeat('a', 64), 'req-blank')$$,
  '22023',
  'event_type is required',
  'a null event_type is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_type_empty', '', false, repeat('a', 64), 'req-blank')$$,
  '22023',
  'event_type is required',
  'an empty event_type is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_type_space', '   ', false, repeat('a', 64), 'req-blank')$$,
  '22023',
  'event_type is required',
  'a whitespace-only event_type is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_livemode_null', 'checkout.session.completed', null, repeat('a', 64), 'req-blank')$$,
  '22023',
  'livemode is required',
  'a null livemode is rejected with 22023, not a not-null violation'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_hash_null', 'checkout.session.completed', false, null, 'req-blank')$$,
  '22023',
  'payload_hash is required',
  'a null payload_hash is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_hash_empty', 'checkout.session.completed', false, '', 'req-blank')$$,
  '22023',
  'payload_hash is required',
  'an empty payload_hash is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_hash_space', 'checkout.session.completed', false, '   ', 'req-blank')$$,
  '22023',
  'payload_hash is required',
  'a whitespace-only payload_hash is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_request_null', 'checkout.session.completed', false, repeat('a', 64), null)$$,
  '22023',
  'request_id is required',
  'a null request_id is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_request_empty', 'checkout.session.completed', false, repeat('a', 64), '')$$,
  '22023',
  'request_id is required',
  'an empty request_id is rejected'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_blank_request_space', 'checkout.session.completed', false, repeat('a', 64), '   ')$$,
  '22023',
  'request_id is required',
  'a whitespace-only request_id is rejected'
);

select is(
  (
    select count(*)::integer
    from public.stripe_webhook_events
    where stripe_event_id like 'evt_blank_%'
      or length(trim(stripe_event_id)) = 0
  ),
  0,
  'no blank or null call left a claimed event id'
);

select is(
  public.record_stripe_webhook_event(
    'evt_input_validation_ok',
    'checkout.session.completed',
    true,
    repeat('c', 64),
    'req-input-validation-ok'
  ) ->> 'claim',
  'inserted',
  'a complete call still claims the event'
);

select throws_ok(
  $$select public.record_stripe_webhook_event('evt_input_validation_ok', 'checkout.session.completed', true, '', 'req-input-validation-replay')$$,
  '22023',
  'payload_hash is required',
  'a replay with a blank payload_hash is rejected, not reported as a duplicate'
);

select is(
  public.record_stripe_webhook_event(
    'evt_input_validation_ok',
    'checkout.session.completed',
    true,
    repeat('c', 64),
    'req-input-validation-replay'
  ) ->> 'claim',
  'duplicate',
  'a complete replay still reports a duplicate'
);

select * from finish();

rollback;
