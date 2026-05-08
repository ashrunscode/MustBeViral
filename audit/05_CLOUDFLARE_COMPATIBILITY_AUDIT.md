# 05_CLOUDFLARE_COMPATIBILITY_AUDIT.md

## Binding-by-Binding Audit

| Binding/System | Configured? | Used in Code? | Correct? | Problem | Fix |
|---|---:|---:|---:|---|---|
| `ASSETS` (static asset binding) | ✅ | n/a | ✅ syntax | `setup.py` references `c.env.ASSETS` but `Env` type does not declare `ASSETS: Fetcher` | Add `ASSETS: Fetcher` to `Env`; wrap with proper `assets.fetch()` call per Wrangler docs |
| `DB` (D1) | ✅ placeholder | n/a | ⚠️ | `database_id: "__D1_DATABASE_ID__"` will fail deploy | Provisioning script: `wrangler d1 create mustbeviral` → write the ID back into `wrangler.jsonc` |
| `MEDIA_BUCKET` (R2) | ✅ placeholder | n/a | ⚠️ | `bucket_name: "__R2_BUCKET_NAME__"` | `wrangler r2 bucket create mustbeviral-media` → patch config |
| `CACHE` (KV) | ✅ placeholder | n/a | ⚠️ | `id: "__KV_NAMESPACE_ID__"` | `wrangler kv namespace create CACHE` → patch config |
| `VECTORIZE` | ✅ placeholder | n/a | ⚠️ | `index_name: "__VECTORIZE_INDEX_NAME__"`; dimension mismatch risk (1536 vs Workers AI 768/1024) | Defer Vectorize to Phase 2; or commit to OpenAI 1536-dim embeddings via AI Gateway; create index with explicit metric |
| `AI` (Workers AI) | ✅ | n/a | ✅ | Default text model `kimi-2.6` is not on Workers AI catalog; image models `flux-2-*` unverified | Move Kimi to AI Gateway HTTP route; verify FLUX.2 ids at impl time; fall back to FLUX.1 schnell if needed |
| `BROWSER` (Browser Run) | ✅ | n/a | ✅ | Beta product; quota and pricing constraints; SSRF risk | Implement SSRF guard before any usage; cap concurrent renders per workspace |
| `LOADER` (Worker Loaders) | ✅ | n/a | 🔴 | No use case in spec; experimental feature | Remove from `wrangler.jsonc` |
| `MARKETING_AGENT` (DO) | ✅ | partial stub | ✅ | Class name matches `setup.py` stub | n/a |
| `MUSTBEVIRAL_MCP` (DO) | ✅ | partial stub | ✅ | Stub uses `McpAgent` correctly | Decide auth + mounting (Worker fetches `/mcp` then routes to DO via `id.fromName`) |
| Migration `v1` (`new_sqlite_classes`) | ✅ | n/a | ✅ | Correct migration entry for SQL-backed DOs introduced fresh | n/a |
| `BRAND_ONBOARDING_WORKFLOW` (Workflows) | ✅ | stub | ✅ | Class is exported from `setup.py` entry; stub | Implement 23 spec'd steps |
| `CONTENT_CALENDAR_WORKFLOW` | ✅ | stub | ✅ | stub | Implement spec |
| `IMAGE_GENERATION_WORKFLOW` | ✅ | stub | ✅ | stub | Implement spec |
| `APPROVAL_SCHEDULING_WORKFLOW` | ✅ | stub | ✅ | stub | Implement spec |
| `WEEKLY_REPORT_WORKFLOW` | ✅ | stub | ✅ | stub | Implement spec |
| `GROWTH_OPPORTUNITY_WORKFLOW` | ✅ | stub | ✅ | stub | Implement spec |
| `DM_AUTOMATION_SETUP_WORKFLOW` | ✅ | stub | ✅ | stub | Implement spec |
| `POST_PUBLISH_QUEUE` (Queues producer + consumer) | ✅ | n/a | ✅ | No code yet | Implement queue handler exporting `queue` from Worker |
| `ANALYTICS_INGEST_QUEUE` | ✅ | n/a | ⚠️ premature for MVP | Drop until analytics volume demands it | Either remove or document as Phase 2 |
| `vars.APP_ENV` / `PUBLIC_APP_URL` / scheduler / model defaults | ✅ | n/a | ✅ | n/a | n/a |
| `env.staging` / `env.production` overrides | ✅ | n/a | ✅ | `env.production.vars.DEFAULT_SCHEDULER_PROVIDER = vista_social` flips to Vista Social in prod; risky if Vista API uncertain | Default production to `manual` until Vista adapter is vetted |
| `observability.enabled = true` | ✅ | n/a | ✅ | Logpush not configured; structured logging conventions undefined | Define a `log()` helper with stable JSON shape |
| `compatibility_date: 2026-05-07` | ✅ | n/a | ✅ | Set to today | Lock at deploy time and never decrease |
| `compatibility_flags: ["nodejs_compat"]` | ✅ | n/a | ✅ | Necessary for Stripe SDK and a few crypto libs | Audit any Node-only imports in code review |

## Cloudflare Runtime Blockers

These will break a real deploy unless fixed:

1. **Placeholder IDs in `wrangler.jsonc`** (D1, R2, KV, Vectorize). Cannot deploy until populated. Build a `scripts/cf-bootstrap.ts` that calls Wrangler and patches the config.
2. **`worker_loaders` may require beta opt-in** on the account — even with the binding declared, it can fail to deploy if not enabled. Drop the binding for MVP.
3. **Workers AI model identifiers** — `kimi-2.6` is not a Workers AI model; `flux-2-*` may not exist. Bind through an HTTP-based model router with capability discovery.
4. **Stripe SDK in Workers** requires `Stripe.createFetchHttpClient()` when constructing the client; otherwise constructor calls Node `http`.
5. **Argon2/bcrypt native modules** — won't run. Use WebCrypto-based PBKDF2 or `@noble/hashes/argon2`.

## Wrangler Fixes

```jsonc
// wrangler.jsonc — recommended diff (logical, not literal)

// REMOVE:
"worker_loaders": [{ "binding": "LOADER" }],

// REMOVE for MVP:
"vectorize": [{ "binding": "VECTORIZE", ... }],
"queues.producers" entry for ANALYTICS_INGEST_QUEUE,
"queues.consumers" entry for mustbeviral-analytics-ingest,

// MOVE secrets out of vars; keep vars for non-secret flags only.

// ADD env-specific image/text model overrides if model availability differs per env.

// ADD Logpush + analytics_engine_datasets if you want first-class metrics later.

// ADD bindings type generation:
//    "tsconfig" not part of wrangler — but generate types via:
//    `wrangler types --env-interface Env src/server/env.d.ts`
```

## Binding Fixes

In code (`src/server/env.ts` to be created):

```ts
import type { D1Database, R2Bucket, KVNamespace, Fetcher, DurableObjectNamespace } from "@cloudflare/workers-types";
import type { Workflow } from "cloudflare:workers";

export interface Env {
  // assets
  ASSETS: Fetcher;

  // storage
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  CACHE: KVNamespace;

  // ai
  AI: Ai;
  BROWSER: Fetcher; // Browser Rendering binding type
  // VECTORIZE: VectorizeIndex; // re-add only when Phase 2

  // durable objects
  MARKETING_AGENT: DurableObjectNamespace;
  MUSTBEVIRAL_MCP: DurableObjectNamespace;

  // workflows
  BRAND_ONBOARDING_WORKFLOW: Workflow;
  CONTENT_CALENDAR_WORKFLOW: Workflow;
  IMAGE_GENERATION_WORKFLOW: Workflow;
  APPROVAL_SCHEDULING_WORKFLOW: Workflow;
  WEEKLY_REPORT_WORKFLOW: Workflow;
  GROWTH_OPPORTUNITY_WORKFLOW: Workflow;
  DM_AUTOMATION_SETUP_WORKFLOW: Workflow;

  // queues
  POST_PUBLISH_QUEUE: Queue<PostPublishMessage>;

  // vars
  APP_ENV: "development" | "staging" | "production";
  PUBLIC_APP_URL: string;
  DEFAULT_SCHEDULER_PROVIDER: "manual" | "vista_social" | "buffer";
  DEFAULT_TEXT_MODEL: string;
  DEFAULT_IMAGE_MODEL: string;
  PREMIUM_IMAGE_MODEL: string;
  FAST_IMAGE_MODEL: string;

  // secrets (declared not assigned)
  SESSION_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  AI_GATEWAY_TOKEN: string;
  KIMI_API_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  VISTA_SOCIAL_API_KEY?: string;
  BUFFER_API_KEY?: string;
}
```

## Local Dev Fixes

- `wrangler dev` will not deploy DOs / Workflows / Queues exactly like prod, but Miniflare 3 supports them. Confirm `wrangler --version >= 3.78` for full Workflow support.
- For Browser Run, local development falls back to a stub. Build a `BrowserRunFake` service for local that returns canned HTML.
- For Workers AI in local, use `wrangler dev --remote` or stub the model adapter behind a feature flag (`USE_FAKE_AI=1`).
- For Queues consumers in local, Miniflare emulates them — no extra config.

## Deployment Fixes

1. Build a `scripts/cf-bootstrap.ts` that runs `wrangler d1 create`, `wrangler r2 bucket create`, `wrangler kv namespace create`, captures the JSON output, and updates `wrangler.jsonc` placeholders. Idempotent: skips creation if resource exists.
2. Build `scripts/cf-secrets.ts` that prompts for all secrets in `DEPLOYMENT_RUNBOOK.md` and runs `wrangler secret put` for each. Optionally accepts a `.env.local` file (gitignored) for non-interactive runs.
3. Decide between `wrangler.jsonc` and `wrangler.toml`. Cloudflare's react-router-hono-fullstack-template currently ships with `.jsonc`; keep that.
4. Keep production `DEFAULT_SCHEDULER_PROVIDER=manual` until Vista adapter is verified end-to-end.
5. Configure Logpush to a Cloudflare R2 bucket or external endpoint when entering staging.
6. After first deploy, run a `cf-smoke.ts` script that pings `/api/health`, hits the SPA root, creates a workspace via API, and tears it down — fail the deploy if smoke fails.
