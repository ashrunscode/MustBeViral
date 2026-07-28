begin;

alter table public.provider_webhook_events
  add column status text not null default 'processed'
    constraint provider_webhook_events_status_check
    check (status in ('claimed', 'processed')),
  add column processed_at timestamptz;

-- Rows created by the prior one-shot claim function represent events whose handling was already
-- acknowledged. Preserve that replay suppression and its original evidence timestamp.
update public.provider_webhook_events
set processed_at = claimed_at
where status = 'processed' and processed_at is null;

-- New claims remain recoverable until business processing explicitly marks them processed.
alter table public.provider_webhook_events
  alter column status set default 'claimed';

create or replace function public.claim_provider_webhook_event(
  p_provider text,
  p_event_id text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_inserted boolean;
  v_status text;
  v_claimed_at timestamptz;
begin
  if p_provider is null
    or p_provider <> 'fal'
    or p_event_id is null
    or char_length(p_event_id) not between 1 and 500
    or p_request_id is null
    or char_length(p_request_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  insert into public.provider_webhook_events (
    provider,
    event_id,
    request_id,
    status
  ) values (
    p_provider,
    p_event_id,
    p_request_id,
    'claimed'
  )
  on conflict (provider, event_id) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) then
    return jsonb_build_object('claim', 'claimed');
  end if;

  -- The insert conflict waits for an in-flight creator. This row lock then serializes every
  -- subsequent claimant so only one worker can reclaim a stale event.
  select event.status, event.claimed_at
  into v_status, v_claimed_at
  from public.provider_webhook_events as event
  where event.provider = p_provider and event.event_id = p_event_id
  for update;

  if v_status = 'processed' then
    return jsonb_build_object('claim', 'duplicate');
  end if;

  if v_status = 'claimed'
    and v_claimed_at < statement_timestamp() - interval '5 minutes' then
    update public.provider_webhook_events
    set
      claimed_at = statement_timestamp(),
      request_id = p_request_id,
      processed_at = null
    where provider = p_provider and event_id = p_event_id;
    return jsonb_build_object('claim', 'claimed');
  end if;

  return jsonb_build_object('claim', 'in_progress');
end;
$$;

create or replace function public.mark_provider_webhook_event_processed(
  p_provider text,
  p_event_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_marked boolean;
begin
  if p_provider is null
    or p_provider <> 'fal'
    or p_event_id is null
    or char_length(p_event_id) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  update public.provider_webhook_events
  set
    status = 'processed',
    processed_at = statement_timestamp()
  where provider = p_provider
    and event_id = p_event_id
    and status = 'claimed'
  returning true into v_marked;

  return jsonb_build_object('marked', coalesce(v_marked, false));
end;
$$;

create or replace function public.release_provider_webhook_event(
  p_provider text,
  p_event_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_released boolean;
begin
  if p_provider is null
    or p_provider <> 'fal'
    or p_event_id is null
    or char_length(p_event_id) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_FAILED';
  end if;

  delete from public.provider_webhook_events
  where provider = p_provider
    and event_id = p_event_id
    and status = 'claimed'
  returning true into v_released;

  return jsonb_build_object('released', coalesce(v_released, false));
end;
$$;

revoke all on table public.provider_webhook_events
from public, anon, authenticated, service_role;

revoke all on function public.claim_provider_webhook_event(text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.mark_provider_webhook_event_processed(text, text)
from public, anon, authenticated, service_role;
revoke all on function public.release_provider_webhook_event(text, text)
from public, anon, authenticated, service_role;

grant execute on function public.claim_provider_webhook_event(text, text, text)
to service_role;
grant execute on function public.mark_provider_webhook_event_processed(text, text)
to service_role;
grant execute on function public.release_provider_webhook_event(text, text)
to service_role;

comment on function public.claim_provider_webhook_event(text, text, text) is
  'Machine-only serialized webhook claim with processed replay suppression and five-minute stale recovery.';
comment on function public.mark_provider_webhook_event_processed(text, text) is
  'Machine-only transition from a recoverable webhook claim to durable processed replay suppression.';
comment on function public.release_provider_webhook_event(text, text) is
  'Machine-only release of an unprocessed webhook claim so provider redelivery can retry safely.';

commit;
