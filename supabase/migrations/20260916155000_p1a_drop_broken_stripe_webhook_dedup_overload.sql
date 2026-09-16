-- P1a: drop the broken four-argument Stripe webhook dedup overload
--
-- 20260830170000_p1a_kill_switch_stripe_rpcs.sql meant to replace the five-argument
-- record_stripe_webhook_event from 20260830163000_p1a_billing_kill_switches_stripe.sql, but
-- CREATE OR REPLACE with a different argument list created a second overload. That overload assigns
-- ROW_COUNT to a boolean and returns `v_inserted > 0`, so every call raised SQLSTATE 42883
-- (operator does not exist: boolean > integer) after PostgREST had resolved it by named arguments.
-- The five-argument overload is the only working dedup entry point; callers reach it by sending
-- p_request_id.
begin;

-- The exact signature cannot match the five-argument overload, whose body, grants and
-- {claim} contract stay unchanged.
drop function if exists public.record_stripe_webhook_event(text, text, boolean, text);

-- Pure hardening with identical behavior: the body schema-qualifies its only relation and otherwise
-- uses pg_catalog functions, types and operators, so pinning search_path to pg_catalog (the
-- convention for SECURITY DEFINER RPCs here) removes public and app_private from name resolution.
-- ALTER FUNCTION keeps the function's OID, body, owner and grants.
alter function public.record_stripe_webhook_event(text, text, boolean, text, text)
  set search_path = pg_catalog;

commit;
