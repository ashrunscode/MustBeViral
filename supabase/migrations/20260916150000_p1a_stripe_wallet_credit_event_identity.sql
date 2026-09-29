-- Make Stripe wallet credit idempotent on the Stripe event id across workspaces.
--
-- Core settles a verified Stripe webhook before recording its receipt in stripe_webhook_events,
-- so Stripe retries and redeliveries replay this function. Ledger idempotency is unique per
-- (workspace_id, causative_key), and a replay can resolve a different workspace, or none, when
-- the payload carries no workspace id, because the stripe_customer_id lookup is neither unique
-- nor immutable. Now:
-- - a per-event advisory lock serializes concurrent deliveries;
-- - a replay without a workspace id keeps the workspace the event first credited and does not
--   touch the billing profile, so it neither credits again nor rewrites the customer mapping;
-- - a replay naming a different workspace raises P0001 STRIPE_EVENT_WORKSPACE_MISMATCH;
-- - a first delivery without a workspace id whose customer maps to several billing profiles
--   raises P0001 STRIPE_CUSTOMER_AMBIGUOUS instead of crediting an arbitrary workspace;
-- - the current_user guard is removed: inside a security definer function current_user is the
--   owner, so it never fired. EXECUTE grants remain the access control.
-- These match the subscription replay hardening prepared alongside this change.
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
  v_credited_workspace_ids uuid[];
  v_customer_workspace_ids uuid[];
  v_causative_key text;
  v_ledger_result jsonb;
  v_replayed boolean;
  v_transaction_id uuid;
  v_wallet_balance_micros bigint;
begin
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

  -- Held until commit. A concurrent delivery of the same event waits here, then reads the first
  -- delivery's committed ledger rows below and replays or rejects instead of crediting twice.
  perform pg_advisory_xact_lock(hashtextextended('stripe-credit:' || p_stripe_event_id, 0));

  v_causative_key := 'stripe:' || p_stripe_event_id;

  select array_agg(distinct ledger.workspace_id)
  into v_credited_workspace_ids
  from public.ledger_transactions as ledger
  where ledger.causative_key = v_causative_key
    and ledger.entry_type = 'credit';

  if v_credited_workspace_ids is not null then
    -- More than one credited workspace can only predate this migration; never pick one.
    if cardinality(v_credited_workspace_ids) > 1
      or (p_workspace_id is not null and p_workspace_id <> v_credited_workspace_ids[1]) then
      raise exception using errcode = 'P0001', message = 'STRIPE_EVENT_WORKSPACE_MISMATCH';
    end if;
    -- A replay: record_ledger_movement below reports replayed and still rejects a changed amount.
    v_workspace_id := v_credited_workspace_ids[1];
  else
    if v_workspace_id is null and p_stripe_customer_id is not null and length(trim(p_stripe_customer_id)) > 0 then
      select array_agg(profile.workspace_id)
      into v_customer_workspace_ids
      from public.workspace_billing_profiles as profile
      where profile.stripe_customer_id = p_stripe_customer_id;

      if cardinality(v_customer_workspace_ids) > 1 then
        raise exception using errcode = 'P0001', message = 'STRIPE_CUSTOMER_AMBIGUOUS';
      end if;
      v_workspace_id := v_customer_workspace_ids[1];
    end if;

    if v_workspace_id is null then
      raise exception using errcode = 'P0002', message = 'WORKSPACE_NOT_FOUND';
    end if;

    if not exists (select 1 from public.workspaces where id = v_workspace_id) then
      raise exception using errcode = 'P0002', message = 'WORKSPACE_NOT_FOUND';
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
  end if;

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
