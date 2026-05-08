# Final Architecture

## Runtime

- Cloudflare Worker hosts Hono API and React Router SPA fallback.
- D1 stores product records, auth, billing, workflow logs, audit logs, and usage.
- Durable Objects store one `MarketingAgent` per brand.
- Workflows run long-lived onboarding, calendar, image, scheduling, report, growth, and DM setup jobs.
- R2 stores media originals, generated assets, screenshots, exports, and reports.
- Workers AI and AI Gateway sit behind `ModelRouter`.

## Code Layout

```text
src/client/        React Router UI
src/server/        Hono routes, agents, workflows, services, db, middleware, mcp
src/shared/        Zod schemas, enums, typed API contracts
tests/             unit, integration, e2e
scripts/           Cloudflare bootstrap, seeds, smoke helpers
docs/              system DNA, ADRs, runbooks
final-strategy/    reconciled build strategy and logs
```

## Critical Path

Build a vertical slice first: signup -> workspace -> brand -> mocked onboarding -> intelligence -> calendar -> approval -> manual export. Broaden only after this is typechecked, tested, and built.
