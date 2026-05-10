# TEST_PLAN.md

Status reflects the local repo after the 2026-05-09 Run 14 continuation pass.

## Local Gate

Every meaningful patch must pass:

- `npm run typecheck`
- bundled Node 24 `wrangler types`, `react-router typegen`, and `tsc -b` when local Node is below Wrangler's floor
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=high`
- `npm run test:e2e:list`
- `npm run test:e2e`
- `git diff --check`

## CI Gate

`.github/workflows/validate.yml` mirrors the local no-deploy gate:

- Node from `.node-version`
- dependency install
- Playwright browser install
- typecheck
- lint
- unit and HTTP integration tests
- build
- high-severity audit
- e2e list
- e2e browser tests
- diff hygiene

The CI workflow must not deploy, push, write secrets, run remote migrations, or create Cloudflare/Stripe resources.

## Unit Coverage

Current unit coverage includes:

- auth password/session security helpers
- API envelope contracts
- entitlements and plan caps
- model router, AI Gateway, and image routing fallbacks
- scheduler/manual export model
- schema/table coverage
- Stripe event handling
- workflow policy and workflow routing
- SSRF/security helpers

## HTTP Integration Coverage

`tests/integration/api-flow.test.ts` covers:

- signup -> login -> me -> logout
- user A/B workspace isolation
- user A/B brand isolation
- normal-user admin denial
- normal-user MCP denial
- SSRF blocking
- rate limiting
- approval-before-export denial before approval
- manual export success after approval
- plan caps
- Stripe webhook tamper rejection
- Stripe webhook replay idempotency
- Stripe checkout/subscription events updating local subscription state
- plan caps reverting after subscription cancellation
- DM rule draft -> approve -> activate lifecycle without real DMs
- all H-1 MarketingAgent/API methods
- cross-site cookie-backed mutation rejection

## Browser E2E Coverage

`tests/e2e/command-center.spec.ts` covers:

- signed-out command-center shell
- mobile login route
- authenticated desktop route matrix
- authenticated mobile route matrix
- workspace, brand, onboarding, approvals, media, billing, and admin-denial surfaces
- failed form input retention
- safe action availability without fake dashboard filler

## Required Before Staging

- local gate green
- CI gate green or manually reproduced
- Cloudflare read-only discovery green through MCP or Wrangler fallback
- staging D1/KV/R2 resource names and IDs verified
- no remote migration until separately confirmed

## Required Before Paid Launch

- local and staging gates green
- Stripe test-mode products/prices verified or created with approval
- webhook secret configured through approved secret flow
- checkout session test-mode smoke
- subscription row update proof against real Stripe test-mode events
- plan caps react to real Stripe test-mode subscription state
- Stripe live checklist reviewed

## Deferred Test Items

- real external AI provider smoke in staging
- real scheduler provider smoke in staging
- upload MIME/size/malware policy tests before customer uploads
- admin action audit expansion as admin mutators are added
- production smoke after explicit deploy approval
