# 04_ARCHITECTURE_AUDIT.md

## Current Architecture

There is no implementation. The intended architecture is documented in `ARCHITECTURE.md`, `wrangler.jsonc`, `llms.txt`, `setup.py`. Reading those:

```
Client (React + React Router + Tailwind + ShadCN-style + TanStack Query + Zod)
   │  HTTPS / WebSocket
   ▼
Cloudflare Worker (Hono app)
   ├─ Hono routes  (/api/*, /mcp, *)
   ├─ Auth middleware → D1 users/sessions
   ├─ RBAC middleware → workspace_members
   ├─ Brand-scoped routes → forward to per-brand MarketingAgent (DO)
   ├─ Static asset binding → ./dist/client
   │
   ├─ Durable Objects
   │     ├─ MarketingAgent (one per brand, sqlite-backed)
   │     └─ MustBeViralMCP (read-only MCP)
   │
   ├─ Workflows (7 entrypoints)
   ├─ D1 (DB)
   ├─ R2 (MEDIA_BUCKET)
   ├─ KV (CACHE)
   ├─ Vectorize (VECTORIZE)
   ├─ Workers AI (AI)
   ├─ Browser Run (BROWSER)
   ├─ Worker Loaders (LOADER)               ← unjustified
   └─ Queues (POST_PUBLISH_QUEUE, ANALYTICS_INGEST_QUEUE)
```

## Desired Architecture

For the product (multi-brand AI marketing autopilot, Phase 1), the desired architecture should be:

- **Workers-only runtime.** No Docker, no Express, no Redis, no Postgres, no Nginx, no microservices.
- **Single Worker entrypoint** rendering both API (`/api/*`, `/mcp`) and SPA assets (catch-all → `ASSETS.fetch`).
- **Per-brand DO** for state and real-time orchestration.
- **Workflows for anything > 30s** — onboarding scans, content gen, image gen batches, weekly reports, scheduling fanouts.
- **D1 for relational data** — auth, billing, content, analytics rollups.
- **R2 for media originals**, Cloudflare Images for variants/CDN.
- **KV for ephemeral state** — sessions, rate limits, idempotency keys, cached scrape results.
- **Vectorize only if needed** — defer until brand-doc retrieval becomes a real product need.
- **AI Gateway** in front of every external model call.

## Runtime Compatibility

The chosen stack is Workers-compatible. The known compatibility risks:

| Concern | Verdict |
|---|---|
| Hono on Workers | ✅ Native. |
| React Router on Workers SSR | ✅ Native via `react-router-hono-fullstack-template`. |
| Drizzle ORM (D1) | ✅ Native; `drizzle-orm/d1` adapter works in Workers. |
| Stripe Node SDK in Workers | ⚠️ Use `stripe` v12+ with `httpClient: Stripe.createFetchHttpClient()` — this is essential. The default Node http client will not run in Workers. |
| `pdf-lib` for weekly report PDFs | ✅ Pure-JS, works in Workers. |
| `@modelcontextprotocol/sdk` MCP server | ✅ Designed for runtime-agnostic use; check current version's worker compat. |
| Argon2/bcrypt for password hashing | ⚠️ Argon2 native bindings won't run in Workers. Use `argon2id` via WebCrypto-compatible WASM build (`@noble/hashes/argon2`) or default to PBKDF2-SHA512 via WebCrypto. |
| Image manipulation libs (sharp, canvas) | ❌ Not Workers-compatible. Use Cloudflare Images for transforms instead. |
| Node-only globals (`Buffer`, `process.env`, `fs`) | ❌ Avoid. `compatibility_flags: ["nodejs_compat"]` exposes some shims; treat them as escape hatches, not the default. |

`compatibility_flags: ["nodejs_compat"]` is enabled — this is fine for selective use but should not become a license to import Node-only packages.

## Cloudflare Compatibility

`wrangler.jsonc` is structurally valid JSONC for Wrangler v3+. Bindings declared:

| Binding | Type | Status |
|---|---|---|
| `ASSETS` | static assets | ✅ |
| `DB` | D1 | ⚠️ database_id is placeholder |
| `MEDIA_BUCKET` | R2 | ⚠️ bucket_name is placeholder |
| `CACHE` | KV | ⚠️ id is placeholder |
| `VECTORIZE` | Vectorize | ⚠️ index_name is placeholder |
| `AI` | Workers AI | ✅ |
| `BROWSER` | Browser Run | ✅ |
| `LOADER` | Worker Loader | 🔴 unjustified — drop for MVP |
| `MARKETING_AGENT` / `MUSTBEVIRAL_MCP` | Durable Objects | ✅ (`new_sqlite_classes` migration tagged correctly) |
| 7 workflow bindings | Workflows | ✅ |
| 2 queue producers + consumers | Queues | ✅ |

**Migration tag `v1` with `new_sqlite_classes`** is correct for SQLite-backed DOs introduced from scratch. The Cloudflare Agents SDK creates SQL-backed DOs when the agent uses persistent state — confirm at impl time that `new_sqlite_classes` is the right migration entry for `Agent`-derived classes (it is, as of late 2025 SDK guidance).

## Complexity Problems

The spec set is mostly well-scoped, but there are creeping items:

1. **`worker_loaders` binding** — niche feature for dynamic Worker loading. Nothing in the product flow needs it. **Drop.**
2. **Vectorize** — included up-front for "optional semantic memory". Until the product has a clear retrieval need, this is over-engineered. **Defer to Phase 2 unless brand-doc RAG ships in Phase 1.**
3. **Two Queues from day one** — `POST_PUBLISH_QUEUE` is justified (scheduler retries / fanout). `ANALYTICS_INGEST_QUEUE` is premature: analytics ingestion can start as a periodic Workflow rather than a queue until volume warrants. **Keep `POST_PUBLISH_QUEUE`, drop `ANALYTICS_INGEST_QUEUE` for MVP.**
4. **MCP server in MVP** — useful as a developer tool but not a customer-facing feature. Build last; don't let it block customer features. **Defer to Phase 1.5.**
5. **84 prompts in PROMPT_ROADMAP** with 7 of them being filler — reduce to a tighter, fully-specified set (this audit's `CLAUDE_CODE_FIX_ROADMAP.md` will replace it).

## Correct Architecture Recommendation

Final recommendation, lean and Workers-native:

```
src/
├── client/               React Router SPA (Vite-built → /dist/client)
│   ├── routes/           React Router routes mirroring UI_WIREFRAMES.md
│   ├── components/       ShadCN-style UI
│   ├── hooks/            useBrand, useApprovalQueue, useAgentSocket
│   ├── lib/              api client, formatters
│   └── stores/           Zustand or TanStack Query state
│
├── server/
│   ├── index.ts          Hono entrypoint, exports DO + Workflow classes
│   ├── env.ts            Env type (single source of truth)
│   ├── middleware/       auth, rbac, audit, costGuard, rateLimit
│   ├── routes/           auth, workspaces, brands, agents, posts, ...
│   ├── agents/           MarketingAgent + helpers
│   ├── mcp/              MustBeViralMCP (read-only)
│   ├── workflows/        7 workflows, one file each
│   ├── services/         model-router, scheduler/{manual,vista,buffer},
│   │                     browser-scan, image-gen, billing/stripe,
│   │                     usage/cost-tracker, compliance, audit
│   ├── prompts/          versioned prompt templates (text files + tests)
│   ├── db/
│   │   ├── schema.ts     Drizzle schema (D1 dialect)
│   │   ├── migrations/   .sql files
│   │   └── client.ts     drizzle(d1) factory
│   └── shared/           Zod schemas shared with client
│
├── tests/
│   ├── unit/
│   ├── integration/      vitest + miniflare
│   └── e2e/              playwright
│
├── docs/                 PRODUCT_DNA, ARCHITECTURE, llms.txt, runbooks
├── wrangler.jsonc
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

Drop from MVP scope:
- `worker_loaders` binding
- `ANALYTICS_INGEST_QUEUE`
- Vectorize (until brand-doc RAG ships)
- Influencer marketplace UI (keep tables for future)

Keep:
- All 7 Workflows (each represents a real long-running job)
- Both DOs (`MarketingAgent`, `MustBeViralMCP`) — drop MCP last if scope pressure forces it

## Keep / Refactor / Rebuild Decision

There is nothing to keep or refactor — there is no code. The decision is implicit:

**VERDICT: clean rebuild from `cloudflare/templates/react-router-hono-fullstack-template`, applying the spec set as design intent and using `cloudflare/agents-starter` as the agent reference.**

Treat `setup.py` as discarded. Treat `PROMPT_ROADMAP.md` as a draft, replaced by this audit's `CLAUDE_CODE_FIX_ROADMAP.md`.
