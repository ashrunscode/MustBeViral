begin;

select plan(3);

select has_function(
  'public',
  'record_provider_job_error_code',
  array['text', 'text'],
  'record_provider_job_error_code exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_provider_job_error_code(text, text)'::regprocedure,
    'execute'
  ),
  'service_role can execute record_provider_job_error_code'
);

select throws_ok(
  $$select public.record_provider_job_error_code('job', 'https://example.test/error')$$,
  '22023',
  'VALIDATION_FAILED',
  'rejects a URL-shaped error code'
);

select * from finish();

rollback;
