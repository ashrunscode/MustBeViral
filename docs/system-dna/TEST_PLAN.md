# TEST_PLAN.md

## Unit Tests

- model-router
- scheduler adapters
- compliance service
- cost tracking
- brand profile validation
- content generation schemas
- approval status transitions
- media variant generation
- route validators

## Integration Tests

- signup -> workspace -> brand
- brand onboarding workflow with mocked services
- image workflow with mocked Workers AI
- approval scheduling workflow with manual adapter
- weekly report workflow
- Stripe webhook
- MCP read-only tools

## E2E Tests

1. User signs up.
2. User creates workspace.
3. User creates brand.
4. User starts onboarding.
5. Scan progress appears.
6. Brand intelligence report appears.
7. User edits brand profile.
8. User generates calendar.
9. User approves post.
10. User schedules via manual adapter.
11. User generates weekly report.
12. Admin retries failed workflow.

## Accessibility Tests

- keyboard navigation
- focus states
- dialogs
- tabs
- command bar
- approval queue
- color contrast

## Build Gates

Every milestone must pass:
- npm run typecheck
- npm run test
- npm run build
