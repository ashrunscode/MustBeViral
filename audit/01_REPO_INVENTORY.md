# 01_REPO_INVENTORY.md

## Summary

The working directory `C:\Users\ernij\OneDrive\Documents\V2\dev\MustBeViral` contains **no source code, no git history, no package manifests, and no build outputs**. The only artifact is `mustbeviral_system_dna.zip` (extracted to `mustbeviral_system_dna_extracted/mustbeviral_system_dna/`) holding 20 specification files plus a Python skeleton generator (`setup.py`).

**This is not a partially-built repo to salvage. This is a spec-only greenfield.** Every audit section below evaluates the *specs themselves* for correctness, completeness, and Cloudflare-readiness — there is no implementation to grade.

The `RESEARCHED_PLATFORM_NOTES.md` references a separate, older repo (`ernijsansons/mustbeviral`) as the legacy product DNA source. **That repo is not present in this working tree** and was not inspected. References to "old code" elsewhere in the spec set assume access to that repo, which the audit cannot verify.

## File Tree

```
MustBeViral/
├── mustbeviral_system_dna.zip                     54 KB (raw archive)
└── mustbeviral_system_dna_extracted/mustbeviral_system_dna/
    ├── README.md                                   562 B
    ├── RESEARCHED_PLATFORM_NOTES.md              5.4 KB
    ├── PRODUCT_DNA.md                            5.0 KB
    ├── ARCHITECTURE.md                           3.6 KB
    ├── DATABASE_SCHEMA.sql                      15.3 KB  (33 tables, 25 indexes)
    ├── wrangler.jsonc                            3.6 KB
    ├── llms.txt                                  3.8 KB
    ├── AGENT_SPEC.md                             3.1 KB
    ├── WORKFLOWS_SPEC.md                         2.6 KB  (7 workflows)
    ├── API_CONTRACTS.md                          2.6 KB
    ├── UI_WIREFRAMES.md                          3.3 KB  (~14 routes)
    ├── COMPONENT_MAP.md                          2.0 KB
    ├── SECURITY_CHECKLIST.md                     1.9 KB
    ├── TEST_PLAN.md                              1.1 KB
    ├── DEPLOYMENT_RUNBOOK.md                     1.2 KB
    ├── COST_MODEL.md                             1.1 KB
    ├── CLOUDFLARE_TEMPLATES_AUDIT.md             1.3 KB
    ├── PROMPT_ROADMAP.md                        81.8 KB  (84 prompts)
    ├── setup.py                                  9.9 KB  (Python skeleton generator)
    └── MASTER_EXECUTION_PACKAGE.md             149.9 KB  (concatenation of all docs)
```

## Important Files

| File | Role |
|---|---|
| `PRODUCT_DNA.md` | Phase 1 product, personas, pricing, magic moments, UX rules |
| `ARCHITECTURE.md` | Cloudflare-native stack decision, request/onboarding/publish flows |
| `wrangler.jsonc` | Single source of binding truth (D1, R2, KV, Vectorize, AI, BROWSER, DOs, Workflows, Queues, env) |
| `DATABASE_SCHEMA.sql` | 33-table D1 schema (multi-brand, multi-workspace) |
| `AGENT_SPEC.md` | `MarketingAgent` callable methods, tools, guardrails, sub-agent roles |
| `WORKFLOWS_SPEC.md` | 7 Workflow specs (onboarding, calendar, image, scheduling, weekly, growth, DM) |
| `API_CONTRACTS.md` | REST route shapes (~20 endpoints) |
| `UI_WIREFRAMES.md` | Route-by-route UX (signup → admin) |
| `setup.py` | Skeleton generator — 60+ directories + 13 starter files |
| `PROMPT_ROADMAP.md` | 84 sequential build prompts (77 unique + 7 placeholder hardening passes) |

## Legacy/Broken Areas

None present in this working tree. The legacy repo (`ernijsansons/mustbeviral`) is referenced as the source of "broken old code to mine for ideas" but is **not in this directory**. Any audit of legacy code requires fetching that repo separately.

## Missing Areas

Everything an actual codebase needs is missing:

- `package.json` (only inside `setup.py` as a string template)
- `package-lock.json` / `pnpm-lock.yaml`
- `tsconfig.json` (not in `setup.py`)
- `vite.config.ts` (not in `setup.py`)
- `tailwind.config.js` / `postcss.config.js` (not in `setup.py`)
- `.gitignore`, `.env.example`
- `node_modules/`, `dist/`, `.wrangler/`
- `.github/workflows/` CI pipeline
- Any actual TypeScript source files
- Migrations (only a placeholder `0001_initial.sql` is generated saying "Replace with DATABASE_SCHEMA.sql content")
- React Router routes wiring
- Hono route modules
- MarketingAgent full implementation (only a 50-line stub is in `setup.py`)
- 7 workflow implementations (only single-step placeholders in `setup.py`)
- Auth (signup/login/session) — completely absent
- Stripe integration — completely absent
- Scheduler adapters — completely absent
- Tests of any kind
- README in the project root (only the System DNA package README exists)

## Immediate Red Flags

1. **`wrangler.jsonc` ships unresolved placeholders** (`__D1_DATABASE_ID__`, `__R2_BUCKET_NAME__`, `__KV_NAMESPACE_ID__`, `__VECTORIZE_INDEX_NAME__`). Running `wrangler deploy` against this config will fail until a real `cf-resources` provisioning script populates the IDs.
2. **`setup.py` writes to a hardcoded path `mustbeviral/`** relative to CWD with no idempotency guard against an existing project, no git init, no `npm install`. Running it twice silently overwrites work.
3. **`setup.py` only includes the schema as a placeholder comment** in `0001_initial.sql`. The actual `DATABASE_SCHEMA.sql` is not copied — the implementer must do this manually.
4. **`setup.py`'s generated `Env` type** (`src/server/index.ts`) lists only 5 bindings. Wrangler config declares ~12 bindings (KV `CACHE`, `BROWSER`, `LOADER`, `VECTORIZE`, queue producers `POST_PUBLISH_QUEUE` / `ANALYTICS_INGEST_QUEUE`, 7 workflow bindings, `ASSETS`). Implementer will face TypeScript errors immediately.
5. **`setup.py`'s generated server entrypoint references `c.env.ASSETS`** but `Env` doesn't declare `ASSETS`. Compile-time error on first build.
6. **Default text model `kimi-2.6`** is a Moonshot AI model. Workers AI does not host Kimi natively — it must be called via HTTPS through AI Gateway. The configuration string suggests a Workers AI binding, which will mislead implementers into trying `env.AI.run("kimi-2.6")` (will fail).
7. **Image model bindings `@cf/black-forest-labs/flux-2-klein-9b/4b/dev`** need verification against the current Workers AI catalog. As of late 2025/early 2026, Workers AI shipped FLUX.1 family identifiers (`@cf/black-forest-labs/flux-1-schnell`). FLUX.2 availability and exact identifier strings must be re-checked at implementation time. **Risk: spec models may be vapor.**
8. **`worker_loaders` binding** is configured but the spec never explains why MustBeViral needs dynamic Worker loading. This is a niche feature; for the MVP it should be removed.
9. **`new_sqlite_classes`** migration tag is correct for SQL-backed Durable Objects, but the spec's `MarketingAgent` extends `Agent<Env, State>` from the `agents` package. The `agents` package may already manage SQL backing internally; double-declaring `new_sqlite_classes` in DO migrations is fine but must be confirmed compatible with the SDK's storage model.
10. **`Vectorize` configured at `dimensions=1536`** (per `DEPLOYMENT_RUNBOOK.md`) implies OpenAI `text-embedding-3-small`. Workers AI native embeddings (`@cf/baai/bge-base-en-v1.5`) are 768-dim, `bge-large-en-v1.5` is 1024-dim. If implementers default to Workers AI for embeddings to keep cost down, the index must be recreated.
11. **`PROMPT_ROADMAP.md` prompts 78–84 are filler.** They are titled "Hardening pass 4" through "Hardening pass 10" with no goal, files, or acceptance criteria differentiating them from each other. Cannot be executed as-written.
12. **Every prompt in `PROMPT_ROADMAP.md` shares an identical "Files to inspect" / "Acceptance criteria" / "Failure checks" block.** The roadmap is templated rather than thought-through; many prompts (e.g., "Add baseline Tailwind") would benefit from a more specific brief but get the generic boilerplate.
13. **`SECURITY_CHECKLIST.md` is unchecked** (every item is `[ ]`). Treat as a TODO list, not a verification of compliance.
14. **Compatibility date `2026-05-07`** is today (per session date). It will work but should be locked at the actual deployment date going forward.
15. **No password hash / sessions table / OAuth provider table** in the D1 schema. Yet `DEPLOYMENT_RUNBOOK.md` references `SESSION_SECRET`. Auth scheme is undefined: custom email/password, OAuth-only, or magic link?
16. **No CSRF strategy.** SPA + Worker means cross-site cookie risk if cookies are used for sessions.
17. **No rate-limit data structure.** KV `CACHE` exists but no spec'd key schema for rate limits.

## Verdict

This repository is **0% implemented** but has **roughly 70%-quality specifications**. The audit therefore evaluates whether the specs can be executed safely and produces a roadmap to implement them, calling out spec defects that would otherwise become production bugs.
