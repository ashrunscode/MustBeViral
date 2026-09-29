begin;

create or replace function public.get_global_spend_exposure()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_day_start timestamptz := date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC';
  v_global_cap bigint;
  v_global_exposure bigint;
  v_reservation_count bigint;
  v_unsettled_reservation_count bigint;
  v_status_counts jsonb;
begin
  select settings.global_daily_spend_cap_micros
  into strict v_global_cap
  from app_private.platform_billing_settings as settings
  where settings.singleton;

  select
    coalesce(sum(greatest(
      reservations.amount_micros - reservations.released_micros,
      reservations.captured_micros - reservations.refunded_micros
    )), 0)::bigint,
    count(*)::bigint,
    count(*) filter (
      where reservations.amount_micros
        - reservations.captured_micros
        - reservations.released_micros <> 0
    )::bigint
  into
    v_global_exposure,
    v_reservation_count,
    v_unsettled_reservation_count
  from public.cost_reservations as reservations
  where reservations.created_at >= v_day_start
    and reservations.created_at < v_day_start + interval '1 day';

  select coalesce(
    jsonb_object_agg(counts.status, to_jsonb(counts.reservation_count)),
    '{}'::jsonb
  )
  into v_status_counts
  from (
    select reservations.status, count(*)::bigint as reservation_count
    from public.cost_reservations as reservations
    where reservations.created_at >= v_day_start
      and reservations.created_at < v_day_start + interval '1 day'
    group by reservations.status
  ) as counts;

  return jsonb_build_object(
    'observed_at', statement_timestamp(),
    'utc_day_start', v_day_start,
    'global_daily_cap_micros', v_global_cap::text,
    'global_exposure_micros', v_global_exposure::text,
    'global_remaining_micros', (v_global_cap - v_global_exposure)::text,
    'reservation_count', v_reservation_count,
    'unsettled_reservation_count', v_unsettled_reservation_count,
    'status_counts', v_status_counts
  );
end;
$$;

comment on function public.get_global_spend_exposure() is
  'Service-role-only aggregate UTC-day spend exposure audit. Mirrors the transactional start_run global-cap formula without exposing tenant rows.';

revoke execute on function public.get_global_spend_exposure()
  from public, anon, authenticated, service_role;
grant execute on function public.get_global_spend_exposure() to service_role;

commit;
