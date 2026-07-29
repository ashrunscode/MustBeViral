begin;

select plan(5);

-- create_quote hardcodes role -> route_key in SQL because the caller's plan is only an
-- idempotency input; the RPC is the sole authority on what a run costs. That makes these strings
-- money-critical: when catalog v2 retired the Moonshot copy route, the stale route key inside this
-- function took every quote down with QUOTE_STALE until it was repointed.

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_quote'
      and p.prosrc like '%openrouter/chat-completions/copy%'
  ),
  1,
  'create_quote resolves copy_set through the OpenRouter copy route'
);

select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_quote'
      and p.prosrc like '%moonshot/kimi-k2.6/chat-completions%'
  ),
  0,
  'create_quote no longer references the retired Moonshot copy route'
);

-- The active catalog must price every route the resolver asks for, or quoting fails closed.
select is(
  (
    select count(*)::int
    from public.price_catalog_versions v
    join public.model_route_prices p on p.price_catalog_version_id = v.id
    join public.model_routes r on r.id = p.model_route_id
    where v.status = 'active'
      and r.route_key = 'openrouter/chat-completions/copy'
      and r.status = 'enabled'
      and p.unit = 'request'
  ),
  1,
  'the active catalog prices the OpenRouter copy route per request'
);

select is(
  (
    select p.unit_price_micros
    from public.price_catalog_versions v
    join public.model_route_prices p on p.price_catalog_version_id = v.id
    join public.model_routes r on r.id = p.model_route_id
    where v.status = 'active'
      and r.route_key = 'openrouter/chat-completions/copy'
      and p.unit = 'request'
  ),
  150000::bigint,
  'the customer-facing copy price is unchanged by the provider move'
);

select is(
  (
    select r.provider_model_id
    from public.model_routes r
    where r.route_key = 'openrouter/chat-completions/copy'
  ),
  'qwen/qwen3-30b-a3b-instruct-2507',
  'the copy route points at the model selected by the WashBodega trial'
);

select * from finish();

rollback;
