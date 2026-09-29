begin;

create table public.provider_webhook_events (
  provider text not null,
  event_id text not null,
  request_id text not null,
  claimed_at timestamptz not null default statement_timestamp(),
  primary key (provider, event_id),
  constraint provider_webhook_events_provider_check
    check (provider in ('fal')),
  constraint provider_webhook_events_event_id_check
    check (char_length(event_id) between 1 and 500),
  constraint provider_webhook_events_request_id_check
    check (char_length(request_id) between 1 and 200)
);

alter table public.provider_webhook_events enable row level security;
alter table public.provider_webhook_events force row level security;

-- Machine-owned replay ledger: it carries no workspace_id, so no tenant-scoped read policy can
-- exist for it, and an unrestricted `using (true)` policy would let any authenticated caller
-- enumerate cross-tenant provider event identifiers and platform activity timing. No product
-- surface reads this table with a caller JWT, so it stays deny-all under force RLS and is written
-- exclusively by the security-definer claim function below.
revoke all on table public.provider_webhook_events
from public, anon, authenticated, service_role;

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
  v_claim text;
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
    request_id
  ) values (
    p_provider,
    p_event_id,
    p_request_id
  )
  on conflict (provider, event_id) do nothing
  returning 'claimed' into v_claim;

  return jsonb_build_object('claim', coalesce(v_claim, 'duplicate'));
end;
$$;

revoke all on function public.claim_provider_webhook_event(text, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.claim_provider_webhook_event(text, text, text)
to service_role;

comment on table public.provider_webhook_events is
  'Durable provider webhook replay claims. Payloads and provider credentials are never stored.';
comment on function public.claim_provider_webhook_event(text, text, text) is
  'Machine-only atomic webhook event claim called after Worker-side provider signature verification.';

commit;
