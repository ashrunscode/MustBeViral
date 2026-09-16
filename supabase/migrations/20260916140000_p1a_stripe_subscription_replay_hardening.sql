-- Harden apply_stripe_subscription_update (20260910000000) after its independent review.
--
-- Core settles a verified Stripe webhook before recording its receipt, so Stripe retries replay
-- this function routinely. Now:
-- - the per-event advisory lock is taken before any lookup, and a replay keeps the workspace the
--   event was first audited for and writes nothing, even when the payload carries no workspace id
--   and the stripe_customer_id mapping has since moved; previously that replay raised forever;
-- - a replay naming a different workspace raises STRIPE_EVENT_WORKSPACE_MISMATCH as P0001, the
--   repository's conflict class, instead of the validation class 22023;
-- - a lookup whose stripe_customer_id matches several billing profiles raises
--   STRIPE_CUSTOMER_AMBIGUOUS instead of taking an arbitrary row. stripe_customer_id stays
--   non-unique: no customer-creation flow exists yet to decide whether one Stripe customer may pay
--   for several workspaces;
-- - the inert current_user guard is removed. Inside a security-definer body current_user is the
--   owner, so it never rejected anyone; the execute grants below are the access control;
-- - a unique partial index makes the database enforce one audit record per Stripe event.
-- Signature, grants, search_path, lock key, audit action and response shape are unchanged.
--
-- The index work runs inside the migration transaction and is not concurrent. audit_events is
-- locked ACCESS EXCLUSIVE up front, so the preflight and both index statements see one state and
-- the migration never upgrades a lock while a caller waits on it; callers queue until commit.
-- Check the audit_events row count before applying this to an environment writing audit records.
begin;

lock table public.audit_events in access exclusive mode;

do $$
declare
  v_duplicates text;
begin
  select string_agg(duplicate.stripe_event_id, ', ' order by duplicate.stripe_event_id)
  into v_duplicates
  from (
    select audit.details ->> 'stripe_event_id' as stripe_event_id
    from public.audit_events as audit
    where audit.action = 'stripe.subscription_update'
    group by audit.details ->> 'stripe_event_id'
    having count(*) > 1
  ) as duplicate;

  if v_duplicates is not null then
    raise exception using
      errcode = '23505',
      message = 'duplicate stripe.subscription_update audit records for Stripe events: ' || v_duplicates;
  end if;
end;
$$;

create unique index audit_events_stripe_subscription_event_key
  on public.audit_events ((details ->> 'stripe_event_id'))
  where action = 'stripe.subscription_update';

drop index if exists public.audit_events_stripe_subscription_event_idx;

create or replace function public.apply_stripe_subscription_update(
  p_workspace_id uuid,
  p_stripe_event_id text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text,
  p_setup_fee_paid boolean,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid := p_workspace_id;
  v_audited_workspace_id uuid;
  v_customer_matches integer;
  v_replayed boolean := false;
  v_profile public.workspace_billing_profiles%rowtype;
begin
  if p_stripe_event_id is null or length(trim(p_stripe_event_id)) = 0 then
    raise exception using errcode = '22023', message = 'stripe_event_id is required';
  end if;
  if p_subscription_status is null
    or p_subscription_status not in ('none', 'trialing', 'active', 'past_due', 'canceled') then
    raise exception using errcode = '22023', message = 'subscription_status is invalid';
  end if;
  if p_request_id is null or length(trim(p_request_id)) = 0 then
    raise exception using errcode = '22023', message = 'request_id is required';
  end if;

  -- Held until commit. A concurrent delivery of the same event waits here, then reads the first
  -- delivery's committed audit record below and replays.
  perform pg_advisory_xact_lock(hashtextextended('stripe-sub:' || p_stripe_event_id, 0));

  select audit.workspace_id
  into v_audited_workspace_id
  from public.audit_events as audit
  where audit.action = 'stripe.subscription_update'
    and audit.details ->> 'stripe_event_id' = p_stripe_event_id;

  if v_audited_workspace_id is not null then
    if p_workspace_id is not null and p_workspace_id <> v_audited_workspace_id then
      raise exception using errcode = 'P0001', message = 'STRIPE_EVENT_WORKSPACE_MISMATCH';
    end if;
    v_workspace_id := v_audited_workspace_id;
    v_replayed := true;
  else
    if v_workspace_id is null and p_stripe_customer_id is not null and length(trim(p_stripe_customer_id)) > 0 then
      -- One statement, so the count and the chosen row come from the same snapshot.
      select count(*)::integer, (array_agg(profile.workspace_id))[1]
      into v_customer_matches, v_workspace_id
      from public.workspace_billing_profiles as profile
      where profile.stripe_customer_id = p_stripe_customer_id;

      if v_customer_matches > 1 then
        raise exception using errcode = 'P0001', message = 'STRIPE_CUSTOMER_AMBIGUOUS';
      end if;
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
      stripe_subscription_id,
      subscription_status,
      setup_fee_paid_at
    )
    values (
      v_workspace_id,
      nullif(trim(p_stripe_customer_id), ''),
      nullif(trim(p_stripe_subscription_id), ''),
      p_subscription_status,
      case when coalesce(p_setup_fee_paid, false) then statement_timestamp() else null end
    )
    on conflict (workspace_id) do update
    set
      stripe_customer_id = coalesce(
        excluded.stripe_customer_id,
        public.workspace_billing_profiles.stripe_customer_id
      ),
      stripe_subscription_id = coalesce(
        excluded.stripe_subscription_id,
        public.workspace_billing_profiles.stripe_subscription_id
      ),
      subscription_status = excluded.subscription_status,
      setup_fee_paid_at = case
        when coalesce(p_setup_fee_paid, false)
          and public.workspace_billing_profiles.setup_fee_paid_at is null
          then statement_timestamp()
        else public.workspace_billing_profiles.setup_fee_paid_at
      end,
      updated_at = statement_timestamp();

    insert into public.audit_events (
      workspace_id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      request_id,
      details
    )
    values (
      v_workspace_id,
      'system',
      null,
      'stripe.subscription_update',
      'workspace_billing_profile',
      v_workspace_id,
      p_request_id,
      jsonb_build_object(
        'stripe_event_id', p_stripe_event_id,
        'stripe_customer_id', p_stripe_customer_id,
        'stripe_subscription_id', p_stripe_subscription_id,
        'subscription_status', p_subscription_status,
        'setup_fee_paid', coalesce(p_setup_fee_paid, false),
        'replayed', false
      )
    );
  end if;

  select *
  into v_profile
  from public.workspace_billing_profiles as profile
  where profile.workspace_id = v_workspace_id;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'replayed', v_replayed,
    'subscription_status', v_profile.subscription_status,
    'setup_fee_paid', v_profile.setup_fee_paid_at is not null
  );
end;
$$;

comment on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text) is
  'Machine-only Stripe subscription profile update. Idempotent on the Stripe event id; a replay keeps the first audited workspace and writes nothing.';

revoke all on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)
  to service_role;

commit;
