# MustBeViral Deployment Runbook

Status: `shipped: pending`. This runbook is a readiness checklist, not permission to deploy.

## Hard Stops

Do not run these without explicit user confirmation:

- `wrangler deploy`
- `wrangler d1 migrations apply --remote`
- `wrangler secret put`
- Cloudflare resource creation or deletion
- Stripe resource creation, secret writes, or live activation
- git push or PR creation

## Local Validation Gate

Use Node 24. The repo has `.node-version` pinned to `24.14.0`; on this workstation the bundled runtime is:

```powershell
C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

Required local gate:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm audit --audit-level=high
npm run test:e2e:list
npm run test:e2e
git diff --check
```

If the default shell uses Node 20 and Wrangler warns about requiring Node 22+, rerun the type gate with the bundled Node 24 runtime:

```powershell
& "C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\wrangler\bin\wrangler.js" types
& "C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\@react-router\dev\bin.js" typegen
& "C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\typescript\bin\tsc" -b
```

## CI Gate

The local workflow at `.github/workflows/validate.yml` runs:

- install with Node from `.node-version`
- Playwright browser install
- typecheck
- lint
- unit and HTTP integration tests
- build
- high-severity npm audit
- e2e list
- e2e browser tests
- diff hygiene

The workflow does not deploy, write secrets, run remote migrations, or create Cloudflare/Stripe resources.

## Cloudflare Staging Readiness

Before staging can be used, read-only discovery must work through Cloudflare MCP or Wrangler CLI.

Current blocked state:

- Cloudflare API MCP returns auth error `10000`.
- `npm run cf:readiness` is read-only and uses the bundled Node runtime when available, but the current shell stops at `wrangler whoami` with `Not logged in`.
- Earlier Run 14 Wrangler inventory verified production D1/KV, but production R2 and staging resources still need a fresh readback after auth is restored.

Once auth is fixed and the user confirms staging resource work:

```powershell
npm run cf:readiness
wrangler d1 list
wrangler kv namespace list
wrangler r2 bucket list
```

Only after a separate confirmation, create or verify staging resources and patch `wrangler.jsonc` staging IDs. After any binding change:

```powershell
wrangler types
npm run typecheck
npm run lint
npm run test
npm run build
```

Remote migration command to prepare, but not run without separate confirmation:

```powershell
wrangler d1 migrations apply mustbeviral-staging --env staging --remote
```

## Stripe Readiness

Stripe remains disabled unless test-mode secrets and price IDs are intentionally configured.

Before any Stripe write:

- Confirm MustBeViral test products/prices should be created.
- Confirm where test secret values will be stored.
- Confirm webhook endpoint and signing secret.
- Confirm checkout/session URLs.

Local proof already required by the test suite:

- tampered webhook signature rejected
- replayed webhook handled idempotently
- plan caps enforced
- local subscription rows advance from checkout/subscription events
- plan caps revert after local cancellation events

Still required before paid launch:

- test-mode checkout session smoke
- real Stripe test-mode subscription row update proof
- plan caps reacting to real Stripe test-mode subscription state
- Stripe live go-live checklist review

## Production Smoke Checklist

Run only after explicit deploy approval and successful staging smoke:

- signup
- login
- `/api/auth/me`
- workspace create/list/detail
- brand create/detail
- onboarding start/idempotency
- profile/intelligence/target-market load
- content calendar generation
- approval-before-export denial before approval
- manual export success after approval
- DM rule draft/approve/activate without sending DMs
- weekly report generation
- growth opportunity generation and campaign draft
- billing disabled or test-mode checkout, depending on approved config
- admin denied for normal user
- MCP denied for normal user
- admin/MCP available only to admin

## Rollback Notes

Do not use destructive git or database operations as a shortcut. For Worker deploy rollback, use Cloudflare version rollback only after deployment has happened and the user approves the rollback action.
