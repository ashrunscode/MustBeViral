-- Repair Stripe text event identity without changing the UUID audit entity contract.
-- Existing function signature, privilege grants and application clients remain compatible.
begin;

create index if not exists audit_events_stripe_subscription_event_idx
  on public.audit_events ((details ->> 'stripe_event_id'))
  where action = 'stripe.subscription_update';

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
  v_replayed boolean := false;
  v_profile public.workspace_billing_profiles%rowtype;
begin
  if current_user <> 'postgres' and session_user <> 'service_role' and current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
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

  perform pg_advisory_xact_lock(hashtextextended('stripe-sub:' || p_stripe_event_id, 0));

  if exists (
    select 1
    from public.audit_events as audit
    where audit.action = 'stripe.subscription_update'
      and audit.details ->> 'stripe_event_id' = p_stripe_event_id
  ) then
    if not exists (
      select 1 from public.audit_events as audit
      where audit.action = 'stripe.subscription_update'
        and audit.details ->> 'stripe_event_id' = p_stripe_event_id
        and audit.workspace_id = v_workspace_id
    ) then
      raise exception using errcode = '22023', message = 'STRIPE_EVENT_WORKSPACE_MISMATCH';
    end if;
    v_replayed := true;
  else
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
  'Machine-only Stripe subscription profile update. Idempotent on stripe event id.';

revoke all on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text)
  to service_role;

commit;
