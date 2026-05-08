# Build Log

## Milestone 0: Inventory And Reconciliation

Files changed:
- `final-strategy/*`

Commands run:
- `pwd`
- `Get-ChildItem -Force`
- `Get-ChildItem -Recurse -File -Force | Select-Object -First 500 -ExpandProperty FullName | Sort-Object`
- `git status --short`
- Read audit and System DNA source files.

Result:
- Pass. Root is spec-only, not a git repository, with `audit/`, `mustbeviral_system_dna_extracted/`, and `mustbeviral_system_dna.zip`.

Remaining issues:
- Clean scaffold still required.
- No package scripts exist yet.
- No git repo exists yet.

## Milestone 1: Phase 0 Clean Scaffold

Files changed:
- `docs/decisions/0001-auth.md`
- `docs/system-dna/*`
- `README.md`
- `llms.txt`
- `package.json`
- Cloudflare template scaffold files at repo root

Commands run:
- `node --version`
- `npm --version`
- `npx wrangler --version`
- `npm create cloudflare@latest -- mustbeviral-app --template=cloudflare/templates/react-router-hono-fullstack-template --no-deploy --git`
- Same scaffold command rerun with bundled Node 24 after Node 20 engine failure

Result:
- In progress. First scaffold attempt failed because `create-cloudflare@2.68.1` requires Node >=22 and the system Node is v20.18.0. Retried successfully with bundled Codex Node v24.14.0. Generated app was moved from `mustbeviral-app/` to the workspace root.

Remaining issues:
- Run `npm install`.
- Run `npm run build`.
- The template `wrangler.jsonc` is still vanilla and will be replaced in Phase 2.

## Milestone 2: Phase 1 Tooling And Strict Foundation

Files changed:
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.node.json`
- `eslint.config.js`
- `.prettierrc`
- `.prettierignore`
- `vitest.config.ts`
- `playwright.config.ts`
- `.env.example`
- `.dev.vars.example`
- `.node-version`
- `.husky/pre-commit`
- `tests/setup.ts`
- `tests/unit/scaffold.test.ts`
- `app/routes/home.tsx`
- `workers/app.ts`

Commands run:
- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Result:
- Pass. Lint, typecheck, Vitest, and build all passed after tightening TypeScript and adapting the template to `exactOptionalPropertyTypes`.

Remaining issues:
- `npm install` reports 15 dependency audit findings from the generated template dependency tree. Automatic `npm audit fix` was not run because it can force dependency churn.

## Milestone 3: Phase 2 Cloudflare Config And Env Types

Files changed:
- `wrangler.jsonc`
- `src/server/index.ts`
- `src/server/env.ts`
- `src/server/agents/MarketingAgent.ts`
- `src/server/mcp/MustBeViralMCP.ts`
- `src/server/workflows/*`
- `scripts/cf-bootstrap.ts`
- `docs/decisions/0002-cloudflare-config.md`
- `tsconfig.cloudflare.json`
- `README.md`

Commands run:
- `npm run bootstrap:cf -- --dry-run`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Result:
- Pass. Wrangler generated binding types for D1, R2, KV, AI, Browser, Durable Objects, Workflows, Queue, and Assets. Build passes with the new `src/server/index.ts` Worker entrypoint.

Remaining issues:
- D1/KV IDs are syntactically valid local placeholders, not deployable resource IDs. `scripts/cf-bootstrap.ts` must patch real IDs before staging/production.
- Browser Run remains feature-flagged off until the SSRF guard and scan service land.

## Milestone 4: Phase 3 Database Schema And Migrations

Files changed:
- `src/server/db/schema.ts`
- `src/server/db/client.ts`
- `src/server/db/migrations/0001_initial.sql`
- `src/server/db/seed.ts`
- `tests/unit/schema.test.ts`
- `package.json`

Commands run:
- `npm run db:migrate:local`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Result:
- Pass. Local D1 migration applied successfully with 75 SQL commands. Schema includes System DNA tables plus sessions, OAuth accounts, password credentials, invitations, webhooks inbox, and idempotency keys.

Remaining issues:
- SQL-first schema chosen for initial clarity; Drizzle can be added later if it improves query safety enough to justify the conversion.

## Milestone 5: Phase 4 Hono API Foundation

Files changed:
- `src/server/http/*`
- `src/server/middleware/*`
- `src/server/routes/health.ts`
- `src/server/routes/webhooks.ts`
- `src/server/index.ts`
- `tests/unit/envelope.test.ts`
- `package.json`
- `package-lock.json`

Commands run:
- `npm install --save-exact zod`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Result:
- Pass after fixing middleware typing. API now has request IDs, structured request logging, standard success/error envelopes, validation helper, auth/RBAC skeletons, `/api/health`, SPA fallback, and a raw-body Stripe webhook placeholder.

Remaining issues:
- Auth/RBAC are fail-closed skeletons. Phase 5 must implement real signup/login/session and tenant checks.

## Milestone 6: Local Dev Server Probe

Files changed:
- none

Commands run:
- `npm run dev -- --host 127.0.0.1`
- `Invoke-WebRequest http://127.0.0.1:5174/api/health`

Result:
- Pass. Port 5173 was already occupied by another local process, so the MustBeViral dev server started on `http://127.0.0.1:5174/`. The app health endpoint returned the standard success envelope.

Remaining issues:
- The installed local Workers runtime supports compatibility date `2025-11-25`, so local dev logs a fallback warning for the `2026-05-08` compatibility date. Build/typegen still pass with Wrangler 4.90.

## Milestone 7: Phases 5-18 MVP Core Slice

Files changed:
- `src/server/services/**`
- `src/server/routes/auth.ts`
- `src/server/routes/workspaces.ts`
- `src/server/routes/brands.ts`
- `src/server/routes/billing.ts`
- `src/server/routes/admin.ts`
- `src/server/routes/mcp.ts`
- `src/server/routes/webhooks.ts`
- `src/server/middleware/auth.ts`
- `src/server/middleware/rbac.ts`
- `src/server/agents/MarketingAgent.ts`
- `app/routes/home.tsx`
- `app/routes/shell.tsx`
- `app/routes.ts`
- `app/app.css`
- `tests/unit/auth-security.test.ts`
- `tests/unit/scheduler-model.test.ts`
- `tests/e2e/command-center.spec.ts`
- `wrangler.jsonc`

Commands run:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e:list`
- `npm run dev -- --host 127.0.0.1 --port 5176`
- Local API smoke against `http://127.0.0.1:5176/api`
- `wrangler whoami`
- `npm run bootstrap:cf -- --dry-run`
- Stripe connector read-only account/prices inspection

Result:
- Pass. Implemented D1-backed signup/login/logout/me, secure session cookies, workspace and brand CRUD, workspace/brand RBAC, audit logging, MarketingAgent callable state methods, mock onboarding, safe URL scan guard, prompt-injection sanitizer, brand intelligence report data, profile versioning, target market reports, 30-day content calendar generation, approvals, media/image mock generation through ModelRouter, manual export scheduler, DM rule drafting with approval required, weekly reports, growth opportunities, Stripe Checkout/portal skeletons, Stripe webhook signature verification, admin overview, and read-only MCP tools.
- Local API smoke passed: signup, workspace create, brand create with onboarding, command center, 30 generated posts, 30 pending approvals, post approval, and manual export.
- Cloudflare CLI is authenticated to account `d2897bdebfa128919bd89b265e6a712e` with Workers, D1, KV, routes, AI, queues, and browser write scopes.
- Stripe connector is available for account `acct_1Rc8eBFJY1VpuS66` (`ERLV INC`). Existing recurring prices were inspected read-only; no Stripe resources were created or changed.

Remaining issues:
- Production deploy is still gated. `wrangler.jsonc` contains production routes, but real D1/KV/R2 IDs and secrets must be provisioned/patched before `wrangler deploy --env production`.
- Stripe live charges remain disabled until live keys and price IDs are explicitly configured.
- Playwright E2E specs exist, but full browser execution still needs a managed dev-server command or a manually started local server.
- The local Workers runtime still warns that it falls back from compatibility date `2026-05-08` to `2025-11-25`.
