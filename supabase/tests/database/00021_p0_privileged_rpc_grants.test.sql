begin;

select plan(25);

-- Discovered live: DROP FUNCTION (required to add OUT columns, which create-or-replace cannot do)
-- clears every grant on the object. The default-privileges bootstrap
-- (20260719010000_p0_authoritative_schema.sql, line 9) revokes execute on every FUTURE function from
-- public, anon, authenticated AND service_role - so a drop-then-recreate that only re-issues the
-- revoke, and forgets the grant, produces a function that compiles, applies cleanly, passes a
-- pg_get_functiondef fingerprint check, and then fails closed the moment the privileged Worker
-- composition actually calls it. Three functions shipped this way in one session
-- (get_outbox_dispatch_attempts, get_provider_artifact_context, advance_copy_provider_attempt) and
-- silently broke every dispatch cron tick until a live $0.0004 money-path proof caught it holding a
-- real reservation. This suite is the guard against a fourth.
--
-- The list below is the full service_role-privileged RPC surface as of this suite's authoring,
-- enumerated by grepping every literal and dynamic #rpc(...) call site in
-- apps/core/src/composition/*.ts. A new privileged RPC that is not added here passes silently; that
-- is a real gap, not this suite's job to close - it guards what it knows about.

select ok(
  has_function_privilege('service_role',
    'public.claim_outbox_events(integer, text, integer)'::regprocedure, 'execute'),
  'service_role can execute claim_outbox_events'
);
select ok(
  has_function_privilege('service_role',
    'public.fail_outbox_event(uuid, integer, integer)'::regprocedure, 'execute'),
  'service_role can execute fail_outbox_event'
);
select ok(
  has_function_privilege('service_role',
    'public.finalize_cancel_requested_runs(integer)'::regprocedure, 'execute'),
  'service_role can execute finalize_cancel_requested_runs'
);
select ok(
  has_function_privilege('service_role',
    'public.find_provider_submission_by_billing_key(text)'::regprocedure, 'execute'),
  'service_role can execute find_provider_submission_by_billing_key'
);
select ok(
  has_function_privilege('service_role',
    'public.get_export_context(uuid, uuid[])'::regprocedure, 'execute'),
  'service_role can execute get_export_context'
);
select ok(
  has_function_privilege('service_role',
    'public.get_global_spend_exposure()'::regprocedure, 'execute'),
  'service_role can execute get_global_spend_exposure'
);
select ok(
  has_function_privilege('service_role',
    'public.get_run_execution_audit(uuid[])'::regprocedure, 'execute'),
  'service_role can execute get_run_execution_audit'
);
select ok(
  has_function_privilege('service_role',
    'public.get_outbox_dispatch_attempts(uuid, text)'::regprocedure, 'execute'),
  'service_role can execute get_outbox_dispatch_attempts - the exact grant this suite exists for'
);
select ok(
  has_function_privilege('service_role',
    'public.get_provider_artifact_context(text, text)'::regprocedure, 'execute'),
  'service_role can execute get_provider_artifact_context'
);
select ok(
  has_function_privilege('service_role',
    'public.list_provider_jobs_for_reconciliation(integer)'::regprocedure, 'execute'),
  'service_role can execute list_provider_jobs_for_reconciliation'
);
select ok(
  has_function_privilege('service_role',
    'public.publish_outbox_event(uuid)'::regprocedure, 'execute'),
  'service_role can execute publish_outbox_event'
);
select ok(
  has_function_privilege('service_role',
    'public.reap_dead_dispatch(integer)'::regprocedure, 'execute'),
  'service_role can execute reap_dead_dispatch'
);
select ok(
  has_function_privilege('service_role',
    'public.arm_stranded_dispatch(integer)'::regprocedure, 'execute'),
  'service_role can execute arm_stranded_dispatch'
);
select ok(
  has_function_privilege('service_role',
    'public.record_ledger_movement(uuid, text, bigint, text, uuid, uuid, text, jsonb)'::regprocedure,
    'execute'),
  'service_role can execute record_ledger_movement'
);
select ok(
  has_function_privilege('service_role',
    'public.record_provider_ambiguity(uuid, uuid, text, text)'::regprocedure, 'execute'),
  'service_role can execute record_provider_ambiguity'
);
select ok(
  has_function_privilege('service_role',
    'public.record_provider_job_reconciliation(uuid, text, jsonb)'::regprocedure, 'execute'),
  'service_role can execute record_provider_job_reconciliation'
);
select ok(
  has_function_privilege('service_role',
    'public.record_provider_submission(uuid, uuid, text, text, text, text)'::regprocedure, 'execute'),
  'service_role can execute record_provider_submission'
);
select ok(
  has_function_privilege('service_role',
    'public.register_artifact(uuid, uuid, text, text, text, text, text, bigint, uuid[], text)'
      ::regprocedure, 'execute'),
  'service_role can execute register_artifact'
);
select ok(
  has_function_privilege('service_role',
    'public.advance_fal_provider_attempt(text, text, text, uuid, bigint)'::regprocedure, 'execute'),
  'service_role can execute advance_fal_provider_attempt'
);
select ok(
  has_function_privilege('service_role',
    'public.advance_copy_provider_attempt(text, text, text, uuid, bigint)'::regprocedure, 'execute'),
  'service_role can execute advance_copy_provider_attempt - the sibling that shipped without it'
);
select ok(
  has_function_privilege('service_role',
    'public.reap_stranded_synchronous_jobs(integer)'::regprocedure, 'execute'),
  'service_role can execute reap_stranded_synchronous_jobs'
);
select ok(
  has_function_privilege('service_role',
    'public.record_provider_job_error_code(text, text)'::regprocedure, 'execute'),
  'service_role can execute record_provider_job_error_code'
);
select ok(
  has_function_privilege('service_role',
    'public.finalize_input_artifact(uuid, text)'::regprocedure, 'execute'),
  'service_role can execute finalize_input_artifact'
);
select ok(
  has_function_privilege('service_role',
    'public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)'::regprocedure,
    'execute'),
  'service_role can execute apply_stripe_wallet_credit'
);
select ok(
  has_function_privilege('service_role',
    'public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)'::regprocedure,
    'execute'),
  'service_role can execute apply_stripe_subscription_update'
);

select * from finish();

rollback;
