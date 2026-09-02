-- P1a: kill switches, Stripe webhook dedup, workspace billing profile (test-mode ready)
begin;

create table app_private.platform_kill_switches (
  singleton boolean primary key default true check (singleton),
  signups_enabled boolean not null default false,
  generation_enabled boolean not null default true,
  provider_routes_enabled boolean not null default true,
  charging_enabled boolean not null default false,
  updated_at timestamptz not null default statement_timestamp()
);

insert into app_private.platform_kill_switches (singleton)
values (true)
on conflict (singleton) do nothing;

comment on table app_private.platform_kill_switches is
  'Operator kill switches for signup, generation, provider routes, and customer charging.';

create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type text not null,
  livemode boolean not null default false,
  payload_hash text not null,
  processed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint stripe_webhook_events_stripe_event_id_key unique (stripe_event_id)
);

create index stripe_webhook_events_created_at_idx
  on public.stripe_webhook_events (created_at desc, id desc);

comment on table public.stripe_webhook_events is
  'Durable Stripe webhook dedup ledger; no secret payload values are stored.';

create table public.workspace_billing_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  wallet_balance_micros bigint not null default 0 check (wallet_balance_micros >= 0),
  setup_fee_paid_at timestamptz,
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'trialing', 'active', 'past_due', 'canceled')),
  updated_at timestamptz not null default statement_timestamp()
);

comment on table public.workspace_billing_profiles is
  'P1a prepaid wallet and Stripe linkage in integer USD micros; historical receipts stay immutable.';

alter table public.stripe_webhook_events enable row level security;
alter table public.workspace_billing_profiles enable row level security;

create policy workspace_billing_profiles_select on public.workspace_billing_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships as membership
      where membership.workspace_id = workspace_billing_profiles.workspace_id
        and membership.user_id = auth.uid()
        and membership.role = 'owner'
    )
  );

revoke all on public.stripe_webhook_events from anon, authenticated;
revoke all on public.workspace_billing_profiles from anon;
grant select on public.workspace_billing_profiles to authenticated;

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
set search_path = public, app_private
as $$
declare
  v_inserted boolean := false;
  v_row_count bigint := 0;
begin
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

revoke all on function public.record_stripe_webhook_event(text, text, boolean, text, text) from public;
grant execute on function public.record_stripe_webhook_event(text, text, boolean, text, text) to service_role;

commit;
