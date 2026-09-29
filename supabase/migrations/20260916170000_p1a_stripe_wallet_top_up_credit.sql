-- Credit the Stripe wallet only from top-ups, once per Checkout Session (expand step).
--
-- ADR-0007: only a paid wallet top-up Checkout Session funds the prepaid usage wallet. The setup
-- fee and subscription invoices never do. apply_stripe_wallet_credit keys a credit on the Stripe
-- event id ('stripe:' || event id), so one payment reported by two events credits twice: a
-- subscription-mode Checkout Session emits checkout.session.completed and, for its first invoice,
-- invoice.paid (issue #20).
--
-- apply_stripe_wallet_top_up replaces it for Core:
-- - it keys the ledger credit, the replay check and the per-delivery advisory lock on
--   p_stripe_checkout_session_id, so checkout.session.completed,
--   checkout.session.async_payment_succeeded and duplicate Event objects for one session settle
--   into one credit;
-- - it accepts only those two event types; invoice.paid and anything else raise 22023;
-- - it requires an explicit workspace id. Stripe customers may be shared across workspaces, so
--   it has no customer lookup, and it fills a billing profile's stripe_customer_id only when the
--   profile has none: a top-up paid by a shared customer never re-points an existing mapping;
-- - it checks the Checkout Session id by character set and length only. Stripe may change id
--   prefixes and lengths; 216 characters is what fits the ledger's 240-character causative key;
-- - it keeps the replay rules of apply_stripe_wallet_credit: a session already credited in
--   another workspace, or in more than one, raises P0001 STRIPE_EVENT_WORKSPACE_MISMATCH; a replay
--   leaves the billing profile untouched; a changed amount raises IDEMPOTENCY_CONFLICT from
--   record_ledger_movement;
-- - its search_path is pg_catalog; every relation and function it uses is schema qualified.
--
-- apply_stripe_wallet_credit keeps its signature and grants, so the schema stays compatible with
-- the previous Core Worker, but it now refuses every call. Left callable, a rolled-back Worker
-- would credit a top-up again under its event key after apply_stripe_wallet_top_up credited it
-- under the session, and would credit subscription payments again. A refused delivery writes no
-- receipt and Stripe retries it, so rolling Core back delays wallet credits instead of
-- duplicating them. A later migration drops the function (expand/backfill/contract). No backfill:
-- credits already written under the event key stay as they are, and their metadata records the
-- Stripe event id.
begin;

create function public.apply_stripe_wallet_top_up(
  p_workspace_id uuid,
  p_stripe_checkout_session_id text,
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
set search_path = pg_catalog
as $$
declare
  v_causative_key text;
  v_credited_workspace_ids uuid[];
  v_ledger_result jsonb;
  v_replayed boolean;
  v_transaction_id uuid;
  v_wallet_balance_micros bigint;
begin
  if p_workspace_id is null then
    raise exception using errcode = '22023', message = 'workspace_id is required';
  end if;
  if p_stripe_checkout_session_id is null
    or p_stripe_checkout_session_id !~ '^[A-Za-z0-9_]{1,216}$' then
    raise exception using errcode = '22023', message = 'stripe_checkout_session_id is invalid';
  end if;
  if p_stripe_event_id is null or length(trim(p_stripe_event_id)) = 0 then
    raise exception using errcode = '22023', message = 'stripe_event_id is required';
  end if;
  if p_amount_micros is null or p_amount_micros <= 0 then
    raise exception using errcode = '22023', message = 'amount_micros must be positive';
  end if;
  if p_event_type is null
    or p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    raise exception using errcode = '22023', message = 'event_type does not fund the wallet';
  end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception using errcode = '22023', message = 'request_id is required';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'metadata must be an object';
  end if;

  -- Held until commit. Concurrent deliveries for one session, from any of its events, wait here,
  -- then read the first delivery's committed ledger rows below and replay or reject.
  perform pg_advisory_xact_lock(
    hashtextextended('stripe-credit:checkout_session:' || p_stripe_checkout_session_id, 0)
  );

  v_causative_key := 'stripe:checkout_session:' || p_stripe_checkout_session_id;

  select array_agg(distinct ledger.workspace_id)
  into v_credited_workspace_ids
  from public.ledger_transactions as ledger
  where ledger.causative_key = v_causative_key
    and ledger.entry_type = 'credit';

  if v_credited_workspace_ids is not null then
    -- A replay. record_ledger_movement below reports replayed and still rejects a changed amount.
    if cardinality(v_credited_workspace_ids) > 1
      or v_credited_workspace_ids[1] <> p_workspace_id then
      raise exception using errcode = 'P0001', message = 'STRIPE_EVENT_WORKSPACE_MISMATCH';
    end if;
  else
    if not exists (select 1 from public.workspaces where id = p_workspace_id) then
      raise exception using errcode = 'P0002', message = 'WORKSPACE_NOT_FOUND';
    end if;

    -- A customer may belong to several workspaces. Copy its id only onto a profile that has none,
    -- so a top-up never re-points a workspace's existing customer mapping.
    insert into public.workspace_billing_profiles (
      workspace_id,
      stripe_customer_id,
      wallet_balance_micros
    )
    values (
      p_workspace_id,
      nullif(trim(p_stripe_customer_id), ''),
      0
    )
    on conflict (workspace_id) do update
    set
      stripe_customer_id = coalesce(
        public.workspace_billing_profiles.stripe_customer_id,
        excluded.stripe_customer_id
      ),
      updated_at = statement_timestamp();
  end if;

  v_ledger_result := public.record_ledger_movement(
    p_workspace_id,
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
      'stripe_checkout_session_id', p_stripe_checkout_session_id,
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
    where workspace_id = p_workspace_id;
  end if;

  select profile.wallet_balance_micros
  into v_wallet_balance_micros
  from public.workspace_billing_profiles as profile
  where profile.workspace_id = p_workspace_id;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'transaction_id', v_transaction_id,
    'replayed', v_replayed,
    'wallet_balance_micros', v_wallet_balance_micros
  );
end;
$$;

comment on function public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb) is
  'Machine-only Stripe wallet top-up credit (ADR-0007). Idempotent on the Checkout Session across workspaces.';

-- Same signature, owner, grants and security definer; the body only refuses. The arguments are
-- deliberately unused.
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
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '0A000',
    message = 'apply_stripe_wallet_credit is retired; use apply_stripe_wallet_top_up';
end;
$$;

comment on function public.apply_stripe_wallet_credit(uuid, text, text, bigint, text, text, jsonb) is
  'Retired by apply_stripe_wallet_top_up (ADR-0007). Refuses every call so a rolled-back Worker cannot credit; a later migration drops it.';

revoke all on function public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_wallet_top_up(uuid, text, text, text, bigint, text, text, jsonb)
  to service_role;

commit;
