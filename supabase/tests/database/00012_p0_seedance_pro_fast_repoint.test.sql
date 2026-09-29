begin;

select plan(2);

select is(
  (
    select provider_model_id
    from public.model_routes
    where route_key = 'fal/seedance-1.0-lite/motion'
  ),
  'fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
  'seedance motion route is repointed to Pro Fast before any video spend'
);

select isnt(
  (
    select provider_model_id
    from public.model_routes
    where route_key = 'fal/seedance-1.0-lite/motion'
  ),
  'fal-ai/bytedance/seedance/v1/lite/image-to-video',
  'seedance motion route no longer points at the deprecated Lite endpoint'
);

select * from finish();

rollback;
