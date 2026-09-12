begin;
create or replace function public.platform_billing_query(p_operation text, p_input jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare
  ws uuid; profile public.workspace_billing_profiles%rowtype; charging boolean;
  ledger_available bigint; usage_total bigint; wallet_text text; has_profile boolean;
begin
  if auth.uid() is null then raise exception using errcode='28000', message='UNAUTHENTICATED'; end if;
  if p_operation is distinct from 'get_workspace_billing' then
    raise exception using errcode='22023', message='VALIDATION_FAILED';
  end if;
  perform app_private.platform_setup_validate(p_input, array['workspace_id']);
  ws:=(p_input->>'workspace_id')::uuid;
  if not app_private.is_workspace_owner(ws) then
    raise exception using errcode='P0002', message='NOT_FOUND';
  end if;
  charging:=coalesce((public.get_platform_kill_switches()->>'charging_enabled')::boolean,false);
  select * into profile from public.workspace_billing_profiles where workspace_id=ws;
  has_profile:=found;
  select coalesce(sum(case when direction='credit' then amount_micros else -amount_micros end),0)
    into ledger_available
    from public.ledger_transactions
    where workspace_id=ws and account_code='wallet_available';
  select coalesce(sum(case when direction='credit' then amount_micros else -amount_micros end),0)
    into usage_total
    from public.ledger_transactions
    where workspace_id=ws and account_code='usage_expense';
  if ledger_available < 0 or usage_total < 0 then
    raise exception using errcode='P0001', message='INTERNAL_ERROR';
  end if;
  wallet_text:=case when has_profile then profile.wallet_balance_micros::text else null end;
  return jsonb_build_object(
    'workspace_id', ws,
    'profile_present', has_profile,
    'charging_enabled', charging,
    'subscription_status', case when has_profile then profile.subscription_status else null end,
    'wallet_balance_micros', to_jsonb(wallet_text),
    'ledger_wallet_available_micros', ledger_available::text,
    'usage_expense_micros', usage_total::text,
    'balances_match', case when has_profile then to_jsonb(profile.wallet_balance_micros = ledger_available) else 'null'::jsonb end
  );
end;
$$;
revoke all on function public.platform_billing_query(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.platform_billing_query(text,jsonb) to authenticated;
commit;
