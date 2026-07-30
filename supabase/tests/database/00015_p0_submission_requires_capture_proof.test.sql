begin;

select plan(7);

-- record_provider_submission could mark an attempt succeeded with no artifact and no ledger capture,
-- violating the invariant advance_fal_provider_attempt enforces for itself. A succeeded attempt with
-- no capture row makes the outcomes aggregation emit a null capture_micros, which broke every later
-- fal webhook in the same run into a 503 redelivery loop on top of captured money.

select throws_ok(
  $$select public.record_provider_submission(
      '00000000-0000-4000-8000-0000000000e1'::uuid,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      'fal/flux-2-pro/masters',
      'billing-key-fixture',
      'provider-request-fixture',
      'succeeded'
    )$$,
  '22023',
  'VALIDATION_FAILED',
  'a submission can no longer claim succeeded; success requires artifact and capture proof'
);

-- A stale deploy sending any other status must also fail loudly rather than be coerced.
select throws_ok(
  $$select public.record_provider_submission(
      '00000000-0000-4000-8000-0000000000e1'::uuid,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      'fal/flux-2-pro/masters',
      'billing-key-fixture',
      'provider-request-fixture',
      'running'
    )$$,
  '22023',
  'VALIDATION_FAILED',
  'only queued is an accepted submission status'
);

-- The reconciliation-mode column is what stops the fix above from creating a new fund trap: a
-- synchronous provider has no status() to poll, so its job entering the reconciler would be marked
-- unknown, flipping the run to reconciliation_required, which has no exit transitions.
select has_column(
  'public', 'provider_registrations', 'reconciliation_mode',
  'provider_registrations records whether a provider is polled or synchronous'
);

select col_not_null(
  'public', 'provider_registrations', 'reconciliation_mode',
  'reconciliation_mode is never null, so the reconciler filter cannot silently miss a provider'
);

select is(
  (select reconciliation_mode from public.provider_registrations where provider_key = 'openrouter'),
  'synchronous',
  'the OpenRouter copy provider is synchronous and must not be polled'
);

select is(
  (select reconciliation_mode from public.provider_registrations where provider_key = 'fal'),
  'poll',
  'fal remains asynchronous and must still be polled for terminal status'
);

select throws_ok(
  $$update public.provider_registrations
      set reconciliation_mode = 'whenever'
    where provider_key = 'fal'$$,
  '23514',
  null,
  'reconciliation_mode is constrained to poll or synchronous'
);

select * from finish();

rollback;
