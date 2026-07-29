begin;

-- Copy moves off the Moonshot direct route onto the OpenRouter gateway, where retention is
-- enforced programmatically per request (ZDR plus a provider allowlist) rather than resting on a
-- DPA negotiation. Model selected by blind trial against a real customer brand; evidence in
-- governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/decision.md.
--
-- This is additive on purpose. Unlike the Seedance repoint - which kept its route_key and moved
-- only provider_model_id - the provider itself changes here, so reusing
-- 'moonshot/kimi-k2.6/chat-completions' would leave a route key naming a provider that no longer
-- serves it. A new key plus a new catalog version keeps the record honest, and quotes already
-- issued against v1 keep resolving because they pin price_catalog_version_id.
--
-- The Moonshot route row and its v1 prices are deliberately left untouched: they are still
-- referenced by issued quotes. Retirement is enforced by composing no Moonshot driver and by
-- publishing no v2 price for that route, not by mutating history.

insert into public.provider_registrations (
  id, provider_key, display_name, transport_version, status, evidence_ref
)
values (
  '0a000000-0000-4000-8000-000000000004',
  'openrouter',
  'OpenRouter',
  '1.0.0',
  'enabled',
  'governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/decision.md'
);

-- route_key is provider-scoped but model-agnostic, so a later copy-model change repoints
-- provider_model_id on this row instead of minting another key.
insert into public.model_routes (
  id, provider_registration_id, route_key, provider_model_id, driver_version, capability,
  status, input_schema_version, output_schema_version
)
values (
  '0b000000-0000-4000-8000-000000000005',
  '0a000000-0000-4000-8000-000000000004',
  'openrouter/chat-completions/copy',
  'qwen/qwen3-30b-a3b-instruct-2507',
  '1.0.0',
  'text',
  -- Matches its sibling routes. Real spend is gated in code by the descriptor's enableGates,
  -- which stay closed for copy; this column governs resolvability, not authorization.
  'enabled',
  1,
  1
);

-- price_catalog_versions_one_active_idx permits exactly one active version, so v1 must retire in
-- the same transaction that activates v2. The check constraint requires retired_at alongside it.
update public.price_catalog_versions
set
  status = 'retired',
  retired_at = statement_timestamp()
where id = '0c000000-0000-4000-8000-000000000001'
  and status = 'active';

insert into public.price_catalog_versions (
  id, provider_registration_id, version, currency, source_hash, source_ref, status, effective_at
)
values (
  '0c000000-0000-4000-8000-000000000002',
  '0a000000-0000-4000-8000-000000000003',
  'p0-launch-2026-07-29-openrouter-copy',
  'USD',
  'bc79e4d75a2ac89fb59dd42149462b27f68f676c2f7d6e9b27b04c32a67d2ace',
  'governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/decision.md',
  'active',
  '2026-07-29T00:00:00+00'
);

-- Customer-facing prices are unchanged; only the copy route identity moved. The launch pack
-- therefore still quotes 4,550,000 micros, and the margin guardrail is unaffected.
insert into public.model_route_prices (
  price_catalog_version_id, model_route_id, unit, unit_price_micros
)
values
  (
    '0c000000-0000-4000-8000-000000000002',
    '0b000000-0000-4000-8000-000000000005',
    'request',
    150000
  ),
  (
    '0c000000-0000-4000-8000-000000000002',
    '0b000000-0000-4000-8000-000000000002',
    'image',
    500000
  ),
  (
    '0c000000-0000-4000-8000-000000000002',
    '0b000000-0000-4000-8000-000000000003',
    'image',
    200000
  ),
  (
    '0c000000-0000-4000-8000-000000000002',
    '0b000000-0000-4000-8000-000000000004',
    'video_second',
    100000
  );

commit;
