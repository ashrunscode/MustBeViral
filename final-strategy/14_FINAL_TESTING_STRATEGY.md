# Final Testing Strategy

## Test Layers

- Unit tests for pure services: auth hashing, SSRF guard, prompt sanitizer, model router, plans, scheduler adapters.
- Integration tests for Hono routes, D1 helpers, RBAC, idempotency, Stripe webhook fixtures, agent bridge, workflow mocks.
- E2E tests for signup -> workspace -> brand -> onboarding mock -> intelligence -> calendar -> approvals -> manual export.

## Required Scripts

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

## Non-Negotiable Tests

- Tenant isolation matrix.
- SSRF blocked-host matrix.
- Stripe signature and replay fixtures.
- Approval state machine.
- Prompt-injection wrapper.
- Manual export scheduling.
