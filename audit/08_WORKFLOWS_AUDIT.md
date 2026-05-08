# 08_WORKFLOWS_AUDIT.md

## Workflow Inventory

| Workflow | Exists (config) | Implemented | Steps spec'd | Steps stubbed | Retry safe | Idempotent | Problems |
|---|---:|---:|---:|---:|---:|---:|---|
| `BrandOnboardingWorkflow` | ✅ | stub only | 23 | 2 | n/a | n/a | All real steps unimplemented; no retry config; no agent progress callback |
| `ContentCalendarWorkflow` | ✅ | stub only | (paragraph) | 1 | n/a | n/a | No step decomposition spec'd beyond inputs/outputs |
| `ImageGenerationWorkflow` | ✅ | stub only | 8 | 1 | n/a | n/a | Model identifier risk (FLUX.2 may not exist) |
| `ApprovalSchedulingWorkflow` | ✅ | stub only | 6 | 1 | n/a | n/a | Provider adapter interface undefined |
| `WeeklyReportWorkflow` | ✅ | stub only | 9 | 1 | n/a | n/a | PDF library not chosen |
| `GrowthOpportunityWorkflow` | ✅ | stub only | 8 | 1 | n/a | n/a | Dedup key undefined |
| `DMAutomationSetupWorkflow` | ✅ | stub only | 7 | 1 | n/a | n/a | "Push to provider" assumes Vista API capability |

## Required Workflow Implementation Order

Execute in this order so each workflow's outputs feed the next:

1. **`BrandOnboardingWorkflow`** — biggest single piece of value; produces brand profile, scores, target market, calendar seed.
2. **`ContentCalendarWorkflow`** — invoked by onboarding, also re-invocable.
3. **`ImageGenerationWorkflow`** — needed to complete content packs.
4. **`ApprovalSchedulingWorkflow`** — gates publishing; required for any real customer use.
5. **`WeeklyReportWorkflow`** — retention loop; can mock initially.
6. **`GrowthOpportunityWorkflow`** — depends on analytics; can mock initially.
7. **`DMAutomationSetupWorkflow`** — last; provider risk highest.

## Workflow Runtime Risks

1. **Workflow event payload size limits.** Cloudflare Workflows have payload size limits per step result (currently 1MB). Long scan outputs (HTML, screenshots base64) **must not be returned from `step.do`** — store in R2 inside the step and return an R2 key.
2. **`step.do` runs at most once on success but retries on failure.** Implementations must therefore be idempotent. For example, `create-brand-profile` should `INSERT ... ON CONFLICT(brand_id, version) DO NOTHING` or check first.
3. **External API calls without retries** will often fail intermittently. Each external call must be wrapped in `step.do` with `retry` configured.
4. **Approval-wait pattern** — for steps that "wait for human approval", use `step.waitForEvent` (Workflows support sleeping for events). Specs don't show this; needed for the publishing path.
5. **Workflow cost** — every retry replays steps. Make expensive steps (LLM calls, image gen) idempotent with cached results to avoid re-billing.
6. **Cancellation.** No spec for "cancel a running workflow if user pauses agent". Add a check between steps.
7. **Time bounds.** A workflow can run for days, but the user-visible UI assumes minutes. Surface workflow age and expected duration; long-running workflows should write progress every step.

## Human Approval / Wait State Requirements

These must be implemented with `step.waitForEvent`:

- `BrandOnboardingWorkflow`: optional manual-intervention step if website is unscannable.
- `ApprovalSchedulingWorkflow`: requires the *user* to have already approved posts before kickoff; if any post becomes unapproved mid-flow, the workflow must skip it.
- `DMAutomationSetupWorkflow`: explicit "wait for compliance approval" step for sensitive DM rules.
- `WeeklyReportWorkflow`: no human approval needed; runs on schedule.

## Spec Refinements

`WORKFLOWS_SPEC.md` is good as a high-level list but does not specify:

| Missing | Required for impl |
|---|---|
| Per-step retry counts and backoff | Spec says "retry: fetch 3, browser 2, image 2" but this is global; need per-step `retry: { limit, delay, backoff }` configs in code |
| Step result schemas (Zod) | Each step result should be Zod-validated for safety on retry |
| Failure transitions on workflow_runs | "error_json" shape undefined; pick `{ message, step, code, raw? }` |
| Progress reporting cadence | After each step, write `workflow_runs.progress_json = { stepIndex, total, message }` and call `agent.onWorkflowProgress` |
| How a workflow looks up its agent | `idFromName(brandId)` is the convention; document it once in shared utility |
| What "manual intervention" looks like | Need a `manual_interventions` table (or use `audit_logs` with action=`manual_intervention_needed`) |

## Cost / Volume Considerations

The onboarding workflow is the most expensive single user action (one website scan + multiple social scans + competitor scan + many model calls + 30 calendar posts × N variants + initial image generations). At cheap defaults:

- 4–6 LLM calls × $0.01/call ≈ $0.04
- 1 Browser Run minute × $0.50/hr ≈ $0.008
- 30 image generations at FLUX Klein ≈ $0.30 (if FLUX.2 Klein 9B is cheap; FLUX.2 dev is far more expensive)

≈ $0.35 per onboarded brand at lowest model tier. Starter $49/mo with 1 brand → onboarding cost is fine; but if `regenerateContentCalendar` is unbounded, monthly cost can balloon. Enforce per-brand monthly image cap at the workflow entry point.

## Required Tests

Per workflow:
- `vitest` unit test on each step's pure logic (extracted from the workflow into pure functions).
- `vitest` integration test on the workflow class via Miniflare workflow harness.
- Failure-path tests: each external dependency mocked to fail and verified the workflow either retries within `step.do` or surfaces a graceful failure to D1 + agent.
- Idempotency test: run a workflow twice with the same input and assert no duplicate D1 rows.
