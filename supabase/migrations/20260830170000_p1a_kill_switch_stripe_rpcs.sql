-- P1a: privileged RPCs for kill-switch reads and Stripe webhook dedup
begin;

create or replace function public.get_platform_kill_switches()
returns jsonb
language sql
security definer
set search_path = pg_catalog, app_private
stable
as $$
  select jsonb_build_object(
    'signups_enabled', switches.signups_enabled,
    'generation_enabled', switches.generation_enabled,
    'provider_routes_enabled', switches.provider_routes_enabled,
    'charging_enabled', switches.charging_enabled,
    'updated_at', switches.updated_at
  )
  from app_private.platform_kill_switches as switches
  where switches.singleton;
$$;

comment on function public.get_platform_kill_switches() is
  'Read-only platform kill switches for authenticated Studio surfaces. No secret values.';

revoke execute on function public.get_platform_kill_switches()
  from public, anon, service_role;
grant execute on function public.get_platform_kill_switches() to authenticated, service_role;

create or replace function public.record_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_inserted boolean := false;
begin
  if p_stripe_event_id is null or length(trim(p_stripe_event_id)) = 0 then
    raise exception 'stripe_event_id is required' using errcode = '22023';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception 'event_type is required' using errcode = '22023';
  end if;
  if p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception 'payload_hash is required' using errcode = '22023';
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
    coalesce(p_livemode, false),
    p_payload_hash,
    statement_timestamp()
  )
  on conflict (stripe_event_id) do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object('inserted', v_inserted > 0);
end;
$$;

comment on function public.record_stripe_webhook_event(text, text, boolean, text) is
  'Durable Stripe webhook dedup insert. Service-role only; no payload secrets stored.';

revoke execute on function public.record_stripe_webhook_event(text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.record_stripe_webhook_event(text, text, boolean, text)
  to service_role;

commit;
