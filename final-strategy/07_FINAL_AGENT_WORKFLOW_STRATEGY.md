# Final Agent Workflow Strategy

## Agent Model

Each brand maps to one `MarketingAgent` Durable Object by `idFromName(brandId)`.

The agent stores brand status, active workflow summary, profile snapshot, scores, target market snapshot, counts, recent errors, and activity. D1 remains the durable business source of truth.

## Workflow Model

Workflows do long-running, retryable work. Agents start workflows and receive progress callbacks. Every workflow writes `workflow_runs` and reports progress to the agent.

## Build Order

1. MarketingAgent shell with all callable method signatures and mocked returns.
2. BrandOnboardingWorkflow mock producing profile, scores, target market, calendar, posts, and approvals.
3. ContentCalendarWorkflow mock.
4. ImageGenerationWorkflow mock.
5. ApprovalSchedulingWorkflow with manual export.
6. WeeklyReportWorkflow, GrowthOpportunityWorkflow, DMAutomationSetupWorkflow.

Specialized "agents" are stateless service functions, not separate Durable Objects.
