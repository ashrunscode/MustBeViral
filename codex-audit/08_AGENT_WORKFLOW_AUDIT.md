# 08 — Agent / Workflow Audit

## MarketingAgent (Durable Object)

File: `src/server/agents/MarketingAgent.ts` (128 lines)

```ts
export class MarketingAgent extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> { … }
}
```

State shape (`MarketingAgentState`):

```ts
{
  brandId?: string;
  workspaceId?: string;
  status: "idle" | "onboarding" | "generating" | "waiting_approval" |
          "scheduling" | "reporting" | "paused" | "error";
  paused: boolean;
  pendingApprovalsCount: number;
  scheduledThisWeekCount: number;
  lastRunAt?: string;
  errors: Array<{ at, message, severity: "info"|"warning"|"error" }>;  // capped at 20
  activity: Array<{ at, action, status: "started"|"complete"|"failed" }>;  // capped at 50
}
```

Routes implemented inside `fetch`:

| Path | Method | Behaviour |
|---|---|---|
| `…/state`, `…/command-center` | GET | Returns persisted state |
| `…/pause` | POST | Sets `status="paused"`, `paused=true`; appends activity |
| `…/resume` | POST | Sets `status="idle"`, `paused=false`; appends activity |
| `…/activity` | GET | Returns `activity[]` |
| `…/onboarding/start` | POST | Patches state to `status="onboarding"`, sets `brandId`/`workspaceId` from body, appends activity |
| Anything else | * | **Returns 501 `MarketingAgent callable bridge is not implemented yet.`** |

Storage: single key `"state"` in `ctx.storage`. Read-modify-write via `updateState`. ✅ DO request serialisation guarantees consistency.

## Spec method coverage

`docs/system-dna/AGENT_SPEC.md` requires 20 callable methods. Map:

| Spec method | DO endpoint | Status |
|---|---|---|
| getCommandCenter | `/state`/`/command-center` | ✅ Real |
| startOnboardingScan | `/onboarding/start` | ✅ Real (state-only; doesn't actually scan) |
| getBrandProfile | — | ❌ 501 (handled by route in `routes/brands.ts:116-141`) |
| updateBrandProfile | — | ❌ 501 (handled by route in `routes/brands.ts:143-182`) |
| lockBrandField | — | ❌ 501 (lockedFields is part of profile patch only) |
| regenerateBrandField | — | ❌ Missing entirely |
| generateContentCalendar | — | ❌ 501 (route in `routes/brands.ts:211-220` calls `generateMockContentCalendar` directly) |
| generatePost | — | ❌ Missing |
| regeneratePost | — | ❌ 501 (approval `regenerate` action sets `status='draft'`) |
| approvePost | — | ❌ 501 (route in `routes/brands.ts:262-297`) |
| rejectPost | — | ❌ 501 (same route) |
| scheduleApprovedPosts | — | ❌ 501 (route in `routes/brands.ts:337-401`) |
| generateWeeklyReport | — | ❌ 501 (route in `routes/brands.ts:454-462`) |
| getGrowthOpportunities | — | ❌ 501 (route in `routes/brands.ts:488-499`) |
| createCampaignFromOpportunity | — | ❌ Missing |
| createDMRule | — | ❌ 501 (route in `routes/brands.ts:417-452`) |
| pauseAgent | `/pause` | ✅ But no outer API route invokes this |
| resumeAgent | `/resume` | ✅ Same |
| getAgentActivity | `/activity` | ✅ Same |
| getWorkflowStatus | — | ❌ Missing |

**Coverage: 4 of 20 spec methods are actually exposed via the agent and reachable from the API.** The remaining 16 either return 501 from the DO (and are handled by route helpers that bypass the DO) or are missing entirely.

## Why this matters

The spec's design intent was that "each brand owns a persistent MarketingAgent" — a Durable Object instance whose state is the source of truth for brand activity, with serialised request handling and durable progress tracking. What was shipped is a thin DO that holds a small status record nobody updates after onboarding/start, plus a pile of HTTP routes that read/write D1 directly. This is not a meaningful Agent SDK pattern; it's an over-stated layer.

## Workflows (Cloudflare Workflows)

7 classes, all under `src/server/workflows/`:

```
ApprovalSchedulingWorkflow.ts
BrandOnboardingWorkflow.ts
ContentCalendarWorkflow.ts
DMAutomationSetupWorkflow.ts
GrowthOpportunityWorkflow.ts
ImageGenerationWorkflow.ts
WeeklyReportWorkflow.ts
base.ts
```

Each workflow file is ≤14 lines and looks like:

```ts
// BrandOnboardingWorkflow.ts
export class BrandOnboardingWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
  override async run(event, step): Promise<unknown> {
    return runWorkflowStub("BrandOnboardingWorkflow", event, step);
  }
}

// base.ts
export async function runWorkflowStub(workflow, event, step) {
  return step.do(`${workflow}:stub`, () =>
    Promise.resolve({
      workflow,
      status: "stubbed",
      instanceId: event.instanceId,
      receivedAt: event.timestamp.toISOString(),
      payload: event.payload,
    }),
  );
}
```

**No workflow does any real work.** Each is a single `step.do()` returning a static JSON object.

`grep -r "WORKFLOW.create" src/server/` returns zero matches. **None of the 7 workflows is ever invoked.**

The visible "workflow runs" stored in `workflow_runs` table are inserted directly from `services/brand-operations.ts` mock generators (e.g. `'BrandOnboardingWorkflow', 'complete', 100`), bypassing the actual Cloudflare Workflow runtime entirely. The `workflow_runs.external_workflow_id` column is never populated.

## Spec workflow coverage

`docs/system-dna/WORKFLOWS_SPEC.md` defines multi-step pipelines per workflow. None are implemented:

| Workflow | Spec steps (high-level) | Code |
|---|---|---|
| BrandOnboardingWorkflow | 23 steps: scan → score → profile → target → first calendar → first images → first approvals | runWorkflowStub |
| ContentCalendarWorkflow | Generate per-day posts via ModelRouter | runWorkflowStub |
| ImageGenerationWorkflow | Probe FLUX capabilities, generate, store to R2, link to post | runWorkflowStub |
| ApprovalSchedulingWorkflow | After approval, schedule via SchedulerProvider | runWorkflowStub |
| WeeklyReportWorkflow | Aggregate analytics, generate PDF, store to R2 | runWorkflowStub |
| GrowthOpportunityWorkflow | Generate suggestions from analytics | runWorkflowStub |
| DMAutomationSetupWorkflow | Validate rules, configure provider | runWorkflowStub |

## Agent / Workflow feature matrix

| Feature | Spec | Code | Status | Evidence |
|---|---|---|---|---|
| One agent per brand | DO instance | `MARKETING_AGENT.idFromName(\`brand:${brandId}\`)` | ✅ | `routes/brands.ts:537-549` |
| Agent state persisted | Yes | `ctx.storage.put("state", …)` | ✅ | `MarketingAgent.ts:125` |
| Agent pause/resume | Yes | DO endpoints implemented | ⚠️ DO supports, no outer API route | — |
| Agent action log | Yes | `state.activity[]` capped at 50 | ✅ | `MarketingAgent.ts:123` |
| Agent error log | Yes | `state.errors[]` capped at 20 | ✅ | `MarketingAgent.ts:122` |
| Agent serialisation/safety | DO request queue | inherent | ✅ | — |
| Real workflows | Yes | All stubs | ❌ | All 7 workflow files |
| Workflow progress tracking | `workflow_runs.progress` | Inserted as `100, 'complete'` from mock generator | ⚠️ Misleading | `brand-operations.ts:200-210, 320-332` |
| Workflow retry | Cloudflare WorkflowEntrypoint inherent | Stubs use single `step.do` | ⚠️ No retryable steps | — |
| Workflow_runs.external_workflow_id | Track Cloudflare workflow IDs | Always NULL | ❌ | — |
| Cross-DO communication | Brand DO ↔ workspace events | Not present | ❌ | — |
| Pause/resume across workflow restarts | Cloudflare native | Not exercised | ❌ | — |

## Required fixes

| ID | Fix | Severity |
|---|---|---|
| AGW-1 | Wire `BrandOnboardingWorkflow.run` to real `step.do(...)` orchestration: scan, score, profile, target_market. Use ModelRouter from inside steps. Update `workflow_runs.status` and `progress` from steps. Store `external_workflow_id` | **Critical** |
| AGW-2 | Routes that currently call `createMockOnboardingArtifacts` etc. should call `env.BRAND_ONBOARDING_WORKFLOW.create({…})` instead and return the workflow instance ID | **Critical** |
| AGW-3 | Implement remaining 16 MarketingAgent methods, OR revise the spec to accept the route-helper pattern. Recommendation: accept route-helper pattern but expose pause/resume/activity through outer API routes | **High** |
| AGW-4 | Drop `MUSTBEVIRAL_MCP` DO binding (it's unused) — write a new DO migration tag (`v2`) that removes the SQLite class | Medium |
| AGW-5 | Add tests for DO state machine transitions (idle → onboarding → generating → waiting_approval → scheduling → reporting; pause/resume from each) | Medium |
| AGW-6 | Add a getWorkflowStatus(workflowId) endpoint that reads `workflow_runs` by id | Medium |
| AGW-7 | Wire `regenerateBrandField` and `generatePost` and `createCampaignFromOpportunity` | Medium |
| AGW-8 | Wire ContentCalendarWorkflow / ImageGenerationWorkflow to call real ModelRouter / R2 | High |
| AGW-9 | Wire WeeklyReportWorkflow to compute real metrics and (optionally) generate a PDF in R2 | Medium |
| AGW-10 | Wire DMAutomationSetupWorkflow to validate rule + (Phase 2) configure provider | Low |

## Verdict

The Cloudflare Agents/Workflows architecture is **scaffolded but inert**. Bindings exist, classes exist, the DO has a state shape and serialisation, but:

* Only 4 of 20 spec methods are reachable on the agent.
* Zero of 7 workflows is actually invoked.
* The visible "workflow_runs" rows are direct INSERTs from mock generators, not real Workflow runtime entries.

Production deployments rely entirely on synchronous route → mock generator paths. There is no async orchestration of any AI/scheduler/report task today.
