# Final Deployment Strategy

## Environments

- Development: local Wrangler, mock AI, mock scheduler, local D1/R2.
- Staging: real Cloudflare resources, sandbox Stripe, scheduler default `manual`.
- Production: real Cloudflare resources, real Stripe, manual scheduler until provider verified.

## Rules

- No production deploy in this task.
- No destructive Cloudflare commands.
- Secrets are documented in `.env.example` and provisioned with `wrangler secret put`, never committed.
- `cf-bootstrap` can create or report planned D1/R2/KV resources and patch placeholders only with explicit run mode.

## Launch Gate

Typecheck, lint, tests, build, E2E smoke, security checks, and staging runbook must be green before production consideration.
