begin;

-- `fal-ai/flux-kontext/pro` is not a fal application. fal's queue accepts any submit body with
-- HTTP 200 IN_QUEUE and validates only at execution, so the wrong id looked healthy at submit and
-- surfaced as a terminal `COMPLETED` with no `images` array roughly 26ms later. Reading the result
-- exposes the real cause:
--
--   POST https://queue.fal.run/fal-ai/flux-kontext/pro  -> 200 IN_QUEUE
--        result -> HTTP 404 {"detail":"Path /pro not found"}
--   POST https://queue.fal.run/fal-ai/flux-pro/kontext  -> 200 IN_QUEUE
--        result -> HTTP 422 {"detail":[{"loc":["body","prompt"],...},{"loc":["body","image_url"],...}]}
--
-- The 422 naming the documented required fields proves `fal-ai/flux-pro/kontext` resolves; the 404
-- proves the other does not. Probed 2026-07-30 against the live queue with empty bodies, so this
-- costs nothing: validation fails before any generation.
--
-- Left unfixed, all 9 launch-pack adaptation nodes would have failed - after real money was spent on
-- the 3 masters they depend on.
--
-- Mirrors 20260728030000_p0_seedance_pro_fast_repoint: keep the historical route_key so seeded
-- create_quote plans and issued customer quotes keep resolving, and move only the provider model
-- identity. The published price is unchanged ($0.04 flat per image), so the launch pack still quotes
-- 4,550,000 micros and no new price catalog version is required.
update public.model_routes
set
  provider_model_id = 'fal-ai/flux-pro/kontext',
  updated_at = statement_timestamp()
where id = '0b000000-0000-4000-8000-000000000003'
  and route_key = 'fal/flux-kontext-pro/adaptations'
  and provider_model_id = 'fal-ai/flux-kontext/pro';

commit;
