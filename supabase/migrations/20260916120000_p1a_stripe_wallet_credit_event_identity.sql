-- Make Stripe wallet credit idempotent on the Stripe event id across workspaces.
--
-- Core settles a verified Stripe webhook before recording its receipt in stripe_webhook_events,
-- so Stripe retries and redeliveries replay this function. Ledger idempotency is unique per
-- (workspace_id, causative_key), and a replay can resolve a different workspace when the payload
-- carries no workspace id, because the stripe_customer_id lookup is neither unique nor immutable.
-- A per-event advisory lock now serializes concurrent deliveries, and a credit already recorded
-- for the event in another workspace raises STRIPE_EVENT_WORKSPACE_MISMATCH instead of crediting
-- again, matching apply_stripe_subscription_update (20260910000000).
-- Signature, grants, search_path and the response shape are unchanged.
begin;

-- Serves the cross-workspace replay lookup and operator reconciliation. Credit rows only; built
-- inside the migration transaction, so it is not concurrent.
create index if not exists ledger_transactions_credit_causative_key_idx
  on public.ledger_transactions (causative_key)
  where entry_type = 'credit';

create or replace function public.apply_stripe_wallet_credit(
  p_workspace_id uuid,
  p_stripe_event_id text,
  p_stripe_customer_id text,
  p_amount_micros bigint,
  p_event_type text,
  p_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid := p_workspace_id;
  v_causative_key text;
  v_ledger_result jsonb;
  v_replayed boolean;
  v_transaction_id uuid;
  v_wallet_balance_micros bigint;
begin
  if current_user <> 'postgres' and session_user <> 'service_role' and current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_stripe_event_id is null or length(trim(p_stripe_event_id)) = 0 then
    raise exception using errcode = '22023', message = 'stripe_event_id is required';
  end if;
  if p_amount_micros is null or p_amount_micros <= 0 then
    raise exception using errcode = '22023', message = 'amount_micros must be positive';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception using errcode = '22023', message = 'event_type is required';
  end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception using errcode = '22023', message = 'request_id is required';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'metadata must be an object';
  end if;

  -- Held until commit. A concurrent delivery of the same event waits here, then sees the first
  -- delivery's committed ledger rows and replays or rejects instead of crediting twice.
  perform pg_advisory_xact_lock(hashtextextended('stripe-credit:' || p_stripe_event_id, 0));

  if v_workspace_id is null and p_stripe_customer_id is not null and length(trim(p_stripe_customer_id)) > 0 then
    select profile.workspace_id
    into v_workspace_id
    from public.workspace_billing_profiles as profile
    where profile.stripe_customer_id = p_stripe_customer_id;
  end if;

  if v_workspace_id is null then
    raise exception using errcode = 'P0002', message = 'WORKSPACE_NOT_FOUND';
  end if;

  if not exists (select 1 from public.workspaces where id = v_workspace_id) then
    raise exception using errcode = 'P0002', message = 'WORKSPACE_NOT_FOUND';
  end if;

  v_causative_key := 'stripe:' || p_stripe_event_id;

  if exists (
    select 1
    from public.ledger_transactions as ledger
    where ledger.causative_key = v_causative_key
      and ledger.entry_type = 'credit'
      and ledger.workspace_id <> v_workspace_id
  ) then
    raise exception using errcode = '22023', message = 'STRIPE_EVENT_WORKSPACE_MISMATCH';
  end if;

  insert into public.workspace_billing_profiles (
    workspace_id,
    stripe_customer_id,
    wallet_balance_micros
  )
  values (
    v_workspace_id,
    nullif(trim(p_stripe_customer_id), ''),
    0
  )
  on conflict (workspace_id) do update
  set
    stripe_customer_id = coalesce(
      excluded.stripe_customer_id,
      public.workspace_billing_profiles.stripe_customer_id
    ),
    updated_at = statement_timestamp();

  v_ledger_result := public.record_ledger_movement(
    v_workspace_id,
    'credit',
    p_amount_micros,
    v_causative_key,
    null,
    null,
    p_request_id,
    p_metadata || jsonb_build_object(
      'source', 'stripe_webhook',
      'event_type', p_event_type,
      'stripe_event_id', p_stripe_event_id,
      'stripe_customer_id', p_stripe_customer_id
    )
  );

  v_replayed := coalesce((v_ledger_result ->> 'replayed')::boolean, false);
  v_transaction_id := (v_ledger_result ->> 'transaction_id')::uuid;

  if not v_replayed then
    update public.workspace_billing_profiles
    set
      wallet_balance_micros = wallet_balance_micros + p_amount_micros,
      updated_at = statement_timestamp()
    where workspace_id = v_workspace_id;
  end if;

  select profile.wallet_balance_micros
  into v_wallet_balance_micros
  from public.workspace_billing_profiles as profile
  where profile.workspace_id = v_workspace_id;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'transaction_id', v_transaction_id,
    'replayed', v_replayed,
    'wallet_balance_micros', v_wallet_balance_micros
  );
end;
$$;

comment on function public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb) is
  'Machine-only Stripe wallet credit. Idempotent on the Stripe event id across workspaces.';

revoke all on function public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb)
  to service_role;

commit;
