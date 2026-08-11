begin;

select plan(7);

select has_function(
  'public',
  'get_run_execution_audit',
  array['uuid[]'],
  'the bounded golden-20 execution audit RPC exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.get_run_execution_audit(uuid[])'::regprocedure,
    'execute'
  ),
  'service_role can execute the audit RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_run_execution_audit(uuid[])'::regprocedure,
    'execute'
  ),
  'authenticated users cannot execute the privileged audit RPC'
);

select throws_ok(
  $$select public.get_run_execution_audit(null::uuid[])$$,
  '22023',
  'VALIDATION_FAILED',
  'a null run set fails closed'
);

select throws_ok(
  $$select public.get_run_execution_audit(array[]::uuid[])$$,
  '22023',
  'VALIDATION_FAILED',
  'an empty run set fails closed'
);

select throws_ok(
  $$select public.get_run_execution_audit(array[
      '26000000-0000-4000-8000-000000000001'::uuid,
      '26000000-0000-4000-8000-000000000001'::uuid
    ])$$,
  '22023',
  'VALIDATION_FAILED',
  'duplicate run identifiers fail closed'
);

select throws_ok(
  $$select public.get_run_execution_audit(array[
      '26000000-0000-4000-8000-000000000002'::uuid
    ])$$,
  'P0002',
  'NOT_FOUND',
  'an unknown run fails closed'
);

select * from finish();

rollback;
