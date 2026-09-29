begin;

-- Seedance 1.0 Lite is deprecated on fal and must not receive real video spend.
-- Keep the historical route_key so seeded create_quote plans and customer quotes
-- continue to resolve; only the provider model identity is repointed to the
-- current Seedance 1.0 Pro Fast image-to-video endpoint.
update public.model_routes
set
  provider_model_id = 'fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
  updated_at = statement_timestamp()
where id = '0b000000-0000-4000-8000-000000000004'
  and route_key = 'fal/seedance-1.0-lite/motion'
  and provider_model_id = 'fal-ai/bytedance/seedance/v1/lite/image-to-video';

commit;
