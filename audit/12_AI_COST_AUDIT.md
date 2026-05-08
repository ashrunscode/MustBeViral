# 12_AI_COST_AUDIT.md

## Model Router Status

Spec calls for a model router and AI Gateway routing (`RESEARCHED_PLATFORM_NOTES.md`, `ARCHITECTURE.md`, `COST_MODEL.md`). No implementation exists.

`wrangler.jsonc` sets variables (`DEFAULT_TEXT_MODEL=kimi-2.6`, `DEFAULT_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-9b`, `PREMIUM_IMAGE_MODEL=@cf/black-forest-labs/flux-2-dev`, `FAST_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-4b`).

**Two correctness problems:**

1. **Kimi (Moonshot AI) is not a Workers AI native model.** It must be called via HTTPS to Moonshot's API or routed through AI Gateway. Implementers seeing `env.AI` next to `DEFAULT_TEXT_MODEL=kimi-2.6` will assume `env.AI.run("kimi-2.6", ...)` is a thing. It is not.
2. **FLUX.2 model identifiers may not exist on Workers AI** at deploy time. Workers AI shipped FLUX.1 (`@cf/black-forest-labs/flux-1-schnell`). FLUX.2 availability and exact IDs must be re-verified at implementation time. Hardcoding these now risks runtime errors.

**Recommended router design:**

```ts
// src/server/services/model-router.ts
type Provider = "workers-ai" | "ai-gateway-openai" | "ai-gateway-anthropic" | "ai-gateway-moonshot";

interface TextRequest { prompt: string; system?: string; max_tokens?: number; tier: "fast"|"default"|"premium"; }
interface TextResponse { content: string; tokens_in: number; tokens_out: number; provider: Provider; model: string; }

async function generateText(env: Env, req: TextRequest): Promise<TextResponse> {
  const route = pickRoute(req.tier, env.APP_ENV);
  const result = await callProvider(env, route, req);
  await recordUsage(env, { kind: "text", ...result });
  return result;
}
```

- `pickRoute` reads env vars and capability discovery; never hardcodes provider directly in business logic.
- Capability discovery: probe `env.AI.models.list()` (or fetch the catalog endpoint) at startup; if FLUX.2 absent, fall back to FLUX.1.
- Always route through AI Gateway when an external provider is involved (gives free retries, caching, observability, cost telemetry).

## Prompt Management Status

No prompts exist. Spec hints at brand-voice extraction, scoring, calendar generation, weekly report, growth opportunities, DM rule drafting — none are written.

**Recommendation:**
- Store prompts as plain text under `src/server/prompts/`, keyed by `{ name, version }`.
- Each prompt is a Zod-typed object: `{ name, version, system, user_template, output_schema }`.
- Snapshot test prompts: assert hash hasn't changed unintentionally.
- Version bump when prompts change; downstream caches keyed by `(prompt_hash, input_hash, model)`.

## Cost Tracking Status

`DATABASE_SCHEMA.sql` has a solid `usage_events` table with provider/model/quantity/cost_estimate. Insertion locations are not specified.

**Required:**
- A single `recordUsage(env, { workspace_id, brand_id, kind, provider, model, quantity, cost_estimate, metadata })` helper.
- Called inside the model router, NOT at call sites — so every model call is uniformly tracked.
- `cost_estimate` derived from a static table of per-1k-token / per-image rates, refreshed monthly.
- Expose `/api/admin/usage` and `/app/admin/usage` reads aggregating month-to-date by workspace/brand/provider.

## Provider Risk

| Provider | Risk | Mitigation |
|---|---|---|
| Workers AI (FLUX.2) | Identifier may not exist | Capability probe + FLUX.1 fallback |
| Workers AI (text models) | Limited catalog | Use AI Gateway for premium text |
| Moonshot Kimi | Non-CF; rate limits, downtime | Route through AI Gateway; circuit-breaker on errors; fallback to OpenAI/Anthropic |
| OpenAI | Pricing changes; rate limits | AI Gateway caching for repeated prompts |
| Anthropic | Pricing changes | AI Gateway caching |
| Cloudflare Images | Quota | Monitor usage; pre-generate variants only after approval |

## Unbounded Generation Risks

Spec implicit risks:

1. **Repeated calendar regeneration** — each call costs ~$0.20+. UI must throttle and confirm before regenerating.
2. **Image regenerations** — each FLUX call costs cents to dollars. Hard cap per brand per day.
3. **Weekly report retries** — if the workflow loops on transient errors, runaway cost. `step.do` retries within Workflows are bounded; ensure config sets retry caps.
4. **DM auto-replies** — if a user accidentally sets a DM rule with a broad trigger, response volume can balloon. Cap replies per rule per day.
5. **Onboarding scan loops** — competitor scans could iterate indefinitely if competitor URLs include comma-separated lists. Cap at 5 competitors; truncate input.

## Required Model Architecture

```
src/server/services/
├── model-router.ts           pickRoute, callProvider, recordUsage wrapper
├── providers/
│   ├── workers-ai.ts         text + image, with capability probe
│   ├── ai-gateway.ts         generic AI Gateway HTTPS client
│   ├── moonshot.ts           thin Kimi caller (via AI Gateway)
│   ├── openai.ts             via AI Gateway
│   └── anthropic.ts          via AI Gateway
├── cost/
│   ├── rates.ts              per-1k-token / per-image rates
│   ├── recorder.ts           recordUsage(env, payload)
│   └── guard.ts              costGuard middleware (read MTD, compare to plan cap)
└── compliance/
    ├── forbidden.ts          phrase list
    ├── reviewer.ts           review(post) → { allow, reasons }
    └── risk-classifier.ts    classify(text) → "low|medium|high"
```

## Cost Guardrails

Implement these as code, not docs:

| Guardrail | Where |
|---|---|
| Per-plan posts/month limit | check inside `generateContentCalendar` and `regeneratePost` |
| Per-plan images/month limit | check inside ImageGenerationWorkflow entry |
| Per-brand monthly cost ceiling (configurable) | costGuard middleware on AI routes |
| Per-IP rate limit (signup, onboarding) | rateLimit middleware |
| Per-workspace daily cost ceiling (admin alarm) | nightly job emails admin if exceeded |
| Per-brand DM reply daily cap | DMAutomationAgent enforcement |
| Manual override for managed plan | `subscriptions.plan === 'managed'` lifts caps; still records `cost_alarm` rows for visibility |

## Cache Strategy

To control cost, cache aggressively:

- **Brand profile generations** keyed by `(brand_id, scan_findings_hash, prompt_version, model)` — TTL = forever, bust on scan re-run.
- **Calendar generations** keyed by same shape — TTL = until brand profile changes.
- **Image generations** never cached (user wants variety).
- **Weekly reports** never cached (data changes).
- **Compliance reviews** keyed by content hash — TTL 7d.
- **AI Gateway response cache** enabled on idempotent prompts; bypass on creative tasks.

Use KV for caches; respect a global cache version key to allow blanket flush.
