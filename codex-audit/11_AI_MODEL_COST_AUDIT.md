# 11 — AI Model / Cost Audit

## Model router (`src/server/services/model-router.ts`)

```ts
async generateText(request: ModelRequest): Promise<ModelResponse> {
  const provider = this.env.USE_MOCK_AI === "true" ? "mock" : "workers_ai";
  const model = this.selectModel(request.category);
  const text = provider === "mock"
    ? `Mock ${request.category} output for: ${request.prompt.slice(0, 120)}`
    : `Configured ${provider} call placeholder for ${model}.`;
  const usageEventId = await this.logUsage(request, provider, model);
  …
}
```

**Both branches return string literals.** The router never calls `env.AI.run(...)`, the Anthropic API, the OpenAI API, the Kimi (Moonshot) API, or any AI Gateway endpoint. The "real AI" branch is hardcoded to return a placeholder string when `USE_MOCK_AI=false`.

## Provider matrix

| Provider | Spec | Code | Status |
|---|---|---|---|
| Mock | Default for dev/staging | ✅ Returns `"Mock <category> output for: ..."` | Real |
| Workers AI | Phase 1 default for production | ❌ Returns placeholder string; never calls `env.AI.run` | **Missing** |
| Kimi (Moonshot) | Premium text via AI Gateway | ❌ Not in code | Missing |
| OpenAI | Fallback / specific tasks | ❌ Not in code | Missing |
| Anthropic (Claude) | Fallback / compliance review | ❌ Not in code | Missing |
| Flux (Workers AI image) | Default image gen | ❌ Not called; only `model` name returned | Missing |

## Model categories

`ModelCategory` type:

```ts
"cheap_text" | "premium_text" | "compliance_review" |
"image_fast" | "image_default" | "image_premium"
```

`selectModel(category)` returns:

| Category | Returned model |
|---|---|
| `image_fast` | `env.FAST_IMAGE_MODEL` (`@cf/black-forest-labs/flux-2-klein-4b`) |
| `image_premium` | `env.PREMIUM_IMAGE_MODEL` (`@cf/black-forest-labs/flux-2-dev`) |
| `image_default` | `env.DEFAULT_IMAGE_MODEL` (`@cf/black-forest-labs/flux-2-klein-9b`) |
| `cheap_text`, `premium_text`, `compliance_review` | `env.DEFAULT_TEXT_MODEL` (`kimi-2.6`) |

**Audit caveat:** `flux-2-klein-9b`, `flux-2-klein-4b`, `flux-2-dev` are not standard Cloudflare Workers AI model IDs. Cloudflare's Flux line on Workers AI uses identifiers like `@cf/black-forest-labs/flux-1-schnell`. The `flux-2-*` identifiers in env vars are unverified; Cloudflare may not have launched them. The `audit/MASTER_AUDIT_REPORT.md` (per Explore agent) flagged this as Finding #6 and Codex marked it "PARTIALLY REMEDIED". This audit cannot verify the model IDs without calling Workers AI.

`kimi-2.6` is **not** a Workers AI model — it is a Moonshot/Kimi cloud model. It would be reachable through Cloudflare AI Gateway with `AI_GATEWAY_TOKEN` and `KIMI_API_KEY` secrets, but the router does not implement that path.

## Cost tracking

`logUsage` writes to `usage_events`:

```ts
INSERT INTO usage_events (
  id, workspace_id, brand_id, event_type, provider, model,
  quantity, cost_estimate_cents, metadata_json
) VALUES (?, ?, ?, ?, ?, ?, 1, /* mock=0, otherwise=2 */, ?)
```

* `quantity` always 1 (no token counting).
* `cost_estimate_cents` is hardcoded `0` for mock, `2` for any non-mock — bears no relationship to real cost.
* `metadata_json` includes `{ promptChars: number }`.

**This is a logging stub, not a cost-tracking system.** No way to enforce per-plan limits without real cost numbers.

## Per-plan limits

`final-strategy/11_FINAL_AI_MODEL_COST_STRATEGY.md` references per-plan limits (starter/growth/agency/managed). The code:

* Reads `subscriptions.plan` only on `GET /api/billing/:workspaceId`.
* Does not read it inside `ModelRouter.generateText` or any AI route.
* Does not enforce any cap (token, request count, monthly cost).

**Per-plan limit enforcement is not implemented.**

## Prompt-injection guardrail integration

`sanitizeUntrustedText` is called on website-scan content (`services/website-scan.ts:47`). It is **not** called inside `ModelRouter.generateText` before forwarding the prompt to a provider.

In practice this is fine today because the router doesn't call any provider — but when real AI is wired, the router MUST sanitise any input that might originate from `evidence_json`, `findings_json`, or other untrusted scan content.

## AI Gateway

Spec calls for routing all model calls through Cloudflare AI Gateway. The `Env` interface declares `AI_GATEWAY_TOKEN` as a secret. No code uses it. AI Gateway is unwired.

## Image generation reality

`generateMockImage` (`services/brand-operations.ts:428-457`):

```ts
const model = await input.router.generateText({
  workspaceId: input.brand.workspace_id,
  brandId: input.brand.id,
  category: "image_default",
  prompt: input.prompt,
});
const creativeId = createId("creative");
await dbRun(db, `INSERT INTO generated_creatives (..., r2_key, ...) VALUES (..., ?, ...)`,
  [..., `mock/${input.brand.id}/${creativeId}.png`, ...]);
```

* Calls `generateText` (text-only router) with category `image_default`.
* Stores a static `r2_key` like `mock/<brandId>/<creativeId>.png`.
* **Never calls `env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, num_steps, … })`.**
* **Never uploads anything to `env.MEDIA_BUCKET`.**

Customers who hit `POST /:brandId/images/generate` get a metadata row only. Frontend would resolve the `r2_key` to a 404.

## Required fixes

| ID | Severity | Fix |
|---|---|---|
| AI-1 | Critical | Implement real `provider === "workers_ai"` branch: `await env.AI.run(this.env.DEFAULT_TEXT_MODEL, { messages: [...] })`. Properly wrap the response. Return tokens/cost |
| AI-2 | High | Verify Workers AI Flux model IDs (`flux-2-*` may not exist; use `flux-1-schnell`, `dreamshaper-8-lcm`, etc.). Update env defaults |
| AI-3 | High | Implement Kimi/OpenAI/Anthropic providers with AI Gateway routing (`AI_GATEWAY_TOKEN`) |
| AI-4 | High | Implement real image generation: call `env.AI.run("@cf/black-forest-labs/flux-1-schnell", {prompt})`, get binary, `await env.MEDIA_BUCKET.put(key, body)`, store key + dimensions |
| AI-5 | High | Sanitize prompts inside `ModelRouter.generateText` when input is sourced from `findings_json`/`evidence_json`/scan content |
| AI-6 | High | Compute real `cost_estimate_cents` from token counts and provider rates |
| AI-7 | Medium | Read `subscriptions.plan` and enforce per-plan AI request caps via `usage_events` aggregate |
| AI-8 | Medium | Add timeout / retry / circuit-breaker around provider calls (Workers `setTimeout` budget is 30s default) |
| AI-9 | Medium | Add tests for router fallthroughs (mock → mock; configured but failing → error envelope) |
| AI-10 | Low | Consider caching deterministic prompts via KV |

## Verdict

| Dimension | Status |
|---|---|
| Mock provider | ✅ Real |
| Workers AI provider | ❌ Stub returning string literal |
| External providers (Kimi/OpenAI/Anthropic) | ❌ Missing |
| Image generation | ❌ No actual model call, no R2 upload |
| Cost tracking | ❌ Hardcoded `2` cents for non-mock |
| Per-plan limits | ❌ Not enforced |
| AI Gateway integration | ❌ Token declared, never used |
| Prompt-injection guard in router | ❌ Not wired |

The AI subsystem **does not exist in production**. `USE_MOCK_AI=false` in production env vars is misleading because the router still returns mock strings. The ModelRouter is essentially a logging shell.
