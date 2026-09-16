-- P1a: reject missing or blank Stripe webhook dedup inputs
--
-- record_stripe_webhook_event(text, text, boolean, text, text) claimed whatever it was given: an
-- empty or whitespace-only event id, event type or payload hash was recorded, so one blank event id
-- would mark every later blank-id event a duplicate. p_request_id was never read, so a null or blank
-- request id was accepted too. Null event id, event type, livemode or payload hash surfaced as raw
-- not-null violations (SQLSTATE 23502). The dropped four-argument overload carried these guards, but
-- its valid path never worked, so no working caller had them. This forward migration adds them to
-- the only overload, before the claim, with the same SQLSTATE 22023 and "<name> is required"
-- messages as the Stripe settlement RPCs.
--
-- CREATE OR REPLACE keeps the function's OID, owner and grants. The signature, SECURITY DEFINER,
-- pinned search_path, insert and {claim} contract are unchanged; only the guards are new.
begin;

create or replace function public.record_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payload_hash text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_inserted boolean := false;
  v_row_count bigint := 0;
begin
  if p_stripe_event_id is null or length(trim(p_stripe_event_id)) = 0 then
    raise exception using errcode = '22023', message = 'stripe_event_id is required';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception using errcode = '22023', message = 'event_type is required';
  end if;
  if p_livemode is null then
    raise exception using errcode = '22023', message = 'livemode is required';
  end if;
  if p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception using errcode = '22023', message = 'payload_hash is required';
  end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception using errcode = '22023', message = 'request_id is required';
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id,
    event_type,
    livemode,
    payload_hash,
    processed_at
  )
  values (
    p_stripe_event_id,
    p_event_type,
    p_livemode,
    p_payload_hash,
    statement_timestamp()
  )
  on conflict (stripe_event_id) do nothing;

  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count > 0;
  return jsonb_build_object('claim', case when v_inserted then 'inserted' else 'duplicate' end);
end;
$$;

commit;
