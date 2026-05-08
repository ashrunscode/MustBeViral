# Final AI Model Cost Strategy

## Model Router

All model calls go through `src/server/services/model-router.ts`.

Categories:
- cheap text
- premium text
- compliance review
- image fast
- image default
- image premium
- embeddings later

## Provider Decisions

- Kimi is external only and must not be called through `env.AI.run`.
- Workers AI is Cloudflare-native for supported models.
- OpenAI and Anthropic are premium/fallback providers through AI Gateway where possible.
- FLUX IDs remain configurable and capability-probed before real use.
- Mock provider is mandatory for local dev and tests.

## Cost Controls

- `usage_events` receives every model/image call.
- Per-plan limits gate posts, images, scheduler providers, DM automation, and autonomy.
- Cost estimates are centralized in a rates table and refreshed periodically.
