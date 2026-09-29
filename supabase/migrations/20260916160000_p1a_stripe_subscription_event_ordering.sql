-- Stop an older Stripe subscription event from overwriting newer billing profile state.
--
-- apply_stripe_subscription_update (20260916140000) applied every first delivery as written, so the
-- event that arrived last won. Stripe does not deliver events in order, and Core settles before it
-- records the webhook receipt, so a settlement that failed (for example WORKSPACE_NOT_FOUND before
-- checkout created the customer mapping) is applied late when Stripe retries it. A late
-- customer.subscription.created (incomplete, stored as past_due) could then overwrite a newer
-- customer.subscription.updated (active) and block a paid workspace, and a late .updated could
-- reactivate a canceled subscription.
--
-- The billing profile now records the Stripe event that last set its subscription state: its id,
-- type and event `created` time. A first delivery is stale, and leaves subscription_status and that
-- record unchanged, when:
-- - it is for the recorded subscription and comes from an earlier lifecycle stage
--   (customer.subscription.created, then .updated, then .deleted). No timestamp is involved:
--   .created is always a subscription's first event and .deleted its last;
-- - it is for the recorded subscription at the same stage, or for a different subscription, and
--   its `created` second is strictly earlier than the recorded one.
-- Anything else applies, so ties apply in arrival order. Stripe records `created` in whole seconds
-- and advises against using it to order events. It is therefore only a fallback: two .updated events
-- for one subscription in the same second, or two subscriptions of one workspace in the same second,
-- still apply in arrival order. The second case can bring back a deleted subscription once another
-- subscription has been recorded in that second. Only refetching the subscription from the Stripe
-- API resolves those, and Core has no Stripe API credential. A profile holds one subscription, so a
-- workspace with overlapping subscriptions follows whichever event is judged newest, even when that
-- cancels one subscription while another is still active; that was already true in arrival order.
--
-- A stale delivery still writes its audit record (details.stale = true) as evidence, and replays like
-- any other event. It still latches setup_fee_paid_at and fills a missing Stripe customer id, which
-- do not depend on order. So for one subscription whose events never share both stage and second,
-- delivered only through the ordered overload, every delivery order ends with the same status,
-- recorded event, customer id and setup-fee flag (setup_fee_paid_at keeps the time of whichever
-- delivery latched it).
-- The ordered overload locks the profile row before it compares, so concurrent deliveries for one
-- workspace are compared and written one at a time.
--
-- Rollout is expand/contract (docs/operations/DEPLOY_ROLLBACK_AND_INCIDENTS.md):
-- - expand, this migration: a nine-argument overload adds the required p_stripe_event_type and
--   p_stripe_event_created (the event's `created`, Unix seconds), requires p_stripe_subscription_id,
--   and returns `stale` as well. PostgREST routes a call to the overload whose argument names it
--   sends, so the Core Worker that sends the new names gets ordering, and the currently deployed or a
--   rolled-back Worker keeps calling the seven-argument function with the same signature and response;
-- - the seven-argument function stays as a transitional, unordered writer. It applies as before and
--   now also clears the recorded event whenever it writes. Otherwise the record would describe a
--   status or subscription it no longer matches, and the ordered overload would skip genuinely newer
--   events against it, indefinitely when the rolled-back Worker had switched the subscription. With
--   the record cleared, the next ordered event applies unconditionally, so ordering is as weak as it
--   was before this migration while the seven-argument function is still called, and no weaker;
-- - contract, a later migration: drop the seven-argument signature once the Worker sending the new
--   arguments is deployed and rollback past it is no longer planned.
-- Both overloads share the lock key, the audit action and the details ->> 'stripe_event_id'
-- expression, so an event first applied by one is a replay for the other. Error codes are unchanged.
-- Profiles written before this migration have no recorded event; their next ordered subscription
-- event applies and records one.
begin;

-- workspace_billing_profiles is read on every quote and run start. Fail fast rather than queue
-- those reads behind a long transaction; the migration can be retried.
set local lock_timeout = '5s';

alter table public.workspace_billing_profiles
  add column stripe_subscription_event_id text,
  add column stripe_subscription_event_type text,
  add column stripe_subscription_event_created_at timestamptz,
  add constraint workspace_billing_profiles_subscription_event_type_check
    check (
      stripe_subscription_event_type in (
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted'
      )
    ),
  add constraint workspace_billing_profiles_subscription_event_check
    check (
      (
        stripe_subscription_event_id is null
        and stripe_subscription_event_type is null
        and stripe_subscription_event_created_at is null
      )
      or (
        stripe_subscription_event_id is not null
        and stripe_subscription_event_type is not null
        and stripe_subscription_event_created_at is not null
        and stripe_subscription_id is not null
      )
    );

comment on column public.workspace_billing_profiles.stripe_subscription_event_id is
  'Stripe event that last set subscription_status through the ordered overload; its subscription is stripe_subscription_id. Null when no ordered event has, or an unordered write came after it.';
comment on column public.workspace_billing_profiles.stripe_subscription_event_type is
  'Type of the Stripe event that last set subscription_status.';
comment on column public.workspace_billing_profiles.stripe_subscription_event_created_at is
  'Stripe `created` time, whole seconds, of the event that last set subscription_status.';

create function public.apply_stripe_subscription_update(
  p_workspace_id uuid,
  p_stripe_event_id text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text,
  p_setup_fee_paid boolean,
  p_request_id text,
  p_stripe_event_type text,
  p_stripe_event_created bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workspace_id uuid := p_workspace_id;
  v_customer_id text := nullif(trim(p_stripe_customer_id), '');
  v_subscription_id text := nullif(trim(p_stripe_subscription_id), '');
  v_event_stage integer;
  v_event_created_at timestamptz;
  v_recorded_stage integer;
  v_audited_workspace_id uuid;
  v_audited_stale boolean;
  v_customer_matches integer;
  v_replayed boolean := false;
  v_stale boolean := false;
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
  if v_subscription_id is null then
    raise exception using errcode = '22023', message = 'stripe_subscription_id is required';
  end if;

  v_event_stage := case p_stripe_event_type
    when 'customer.subscription.created' then 1
    when 'customer.subscription.updated' then 2
    when 'customer.subscription.deleted' then 3
  end;
  if v_event_stage is null then
    raise exception using errcode = '22023', message = 'stripe_event_type is invalid';
  end if;
  -- 253402300799 is 9999-12-31 23:59:59 UTC, the last second to_timestamp accepts here.
  if p_stripe_event_created is null
    or p_stripe_event_created <= 0
    or p_stripe_event_created > 253402300799 then
    raise exception using errcode = '22023', message = 'stripe_event_created is invalid';
  end if;
  v_event_created_at := to_timestamp(p_stripe_event_created);

  -- Held until commit. A concurrent delivery of the same event waits here, then reads the first
  -- delivery's committed audit record below and replays.
  perform pg_advisory_xact_lock(hashtextextended('stripe-sub:' || p_stripe_event_id, 0));

  select audit.workspace_id, coalesce((audit.details ->> 'stale')::boolean, false)
  into v_audited_workspace_id, v_audited_stale
  from public.audit_events as audit
  where audit.action = 'stripe.subscription_update'
    and audit.details ->> 'stripe_event_id' = p_stripe_event_id;

  if v_audited_workspace_id is not null then
    if p_workspace_id is not null and p_workspace_id <> v_audited_workspace_id then
      raise exception using errcode = 'P0001', message = 'STRIPE_EVENT_WORKSPACE_MISMATCH';
    end if;
    v_workspace_id := v_audited_workspace_id;
    v_replayed := true;
    v_stale := v_audited_stale;
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

    -- The first subscription event of a workspace without a profile creates it. A concurrent
    -- insert for the same workspace makes this wait for that transaction, then do nothing.
    insert into public.workspace_billing_profiles (
      workspace_id,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_status,
      setup_fee_paid_at,
      stripe_subscription_event_id,
      stripe_subscription_event_type,
      stripe_subscription_event_created_at
    )
    values (
      v_workspace_id,
      v_customer_id,
      v_subscription_id,
      p_subscription_status,
      case when coalesce(p_setup_fee_paid, false) then statement_timestamp() else null end,
      p_stripe_event_id,
      p_stripe_event_type,
      v_event_created_at
    )
    on conflict (workspace_id) do nothing;

    if not found then
      -- Held until commit, so a concurrent delivery for this workspace cannot change the recorded
      -- event between the comparison below and the update that follows it.
      select *
      into v_profile
      from public.workspace_billing_profiles as profile
      where profile.workspace_id = v_workspace_id
      for update;

      v_recorded_stage := case v_profile.stripe_subscription_event_type
        when 'customer.subscription.created' then 1
        when 'customer.subscription.updated' then 2
        when 'customer.subscription.deleted' then 3
      end;

      v_stale := v_profile.stripe_subscription_event_id is not null
        and case
          when v_profile.stripe_subscription_id = v_subscription_id then
            v_event_stage < v_recorded_stage
            or (
              v_event_stage = v_recorded_stage
              and v_event_created_at < v_profile.stripe_subscription_event_created_at
            )
          else
            v_event_created_at < v_profile.stripe_subscription_event_created_at
        end;

      if v_stale then
        update public.workspace_billing_profiles as profile
        set
          stripe_customer_id = coalesce(profile.stripe_customer_id, v_customer_id),
          setup_fee_paid_at = case
            when coalesce(p_setup_fee_paid, false) and profile.setup_fee_paid_at is null
              then statement_timestamp()
            else profile.setup_fee_paid_at
          end,
          updated_at = statement_timestamp()
        where profile.workspace_id = v_workspace_id
          and (
            (profile.stripe_customer_id is null and v_customer_id is not null)
            or (coalesce(p_setup_fee_paid, false) and profile.setup_fee_paid_at is null)
          );
      else
        update public.workspace_billing_profiles as profile
        set
          stripe_customer_id = coalesce(v_customer_id, profile.stripe_customer_id),
          stripe_subscription_id = v_subscription_id,
          subscription_status = p_subscription_status,
          setup_fee_paid_at = case
            when coalesce(p_setup_fee_paid, false) and profile.setup_fee_paid_at is null
              then statement_timestamp()
            else profile.setup_fee_paid_at
          end,
          stripe_subscription_event_id = p_stripe_event_id,
          stripe_subscription_event_type = p_stripe_event_type,
          stripe_subscription_event_created_at = v_event_created_at,
          updated_at = statement_timestamp()
        where profile.workspace_id = v_workspace_id;
      end if;
    end if;

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
        'stripe_event_type', p_stripe_event_type,
        'stripe_event_created', p_stripe_event_created,
        'stripe_customer_id', p_stripe_customer_id,
        'stripe_subscription_id', p_stripe_subscription_id,
        'subscription_status', p_subscription_status,
        'setup_fee_paid', coalesce(p_setup_fee_paid, false),
        'replayed', false,
        'stale', v_stale
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
    'stale', v_stale,
    'subscription_status', v_profile.subscription_status,
    'setup_fee_paid', v_profile.setup_fee_paid_at is not null
  );
end;
$$;

comment on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint) is
  'Machine-only Stripe subscription profile update. Idempotent on the Stripe event id; a replay keeps the first audited workspace and writes nothing. An event older than the one that last set the subscription state is audited as stale and does not change it.';

revoke all on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_update(uuid, text, text, text, text, boolean, text, text, bigint)
  to service_role;

-- The transitional seven-argument function, unchanged from 20260916140000 except that its write also
-- clears the recorded event (see the rollout notes above). Signature, grants and response are unchanged.
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
      stripe_subscription_event_id = null,
      stripe_subscription_event_type = null,
      stripe_subscription_event_created_at = null,
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
  'Transitional unordered Stripe subscription profile update for Workers that do not send the event type and created time. Idempotent on the Stripe event id; a replay keeps the first audited workspace and writes nothing. A write clears the recorded subscription event. Dropped once the Worker calling the nine-argument overload is deployed.';

commit;
