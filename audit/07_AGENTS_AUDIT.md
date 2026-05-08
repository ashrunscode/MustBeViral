# 07_AGENTS_AUDIT.md

## Agent Architecture Verdict

The intended architecture is correct: **one `MarketingAgent` Durable Object per brand, ID-derived from `brandId`, holding state, scheduling, and brokering Workflows.** This matches the Cloudflare Agents SDK patterns and matches multi-brand product needs.

The implementation maturity is **stub-only**. The skeleton in `setup.py` shows the right SDK imports (`Agent`, `callable`, `McpAgent`) but covers ~3 of the ~20 callable methods specified in `AGENT_SPEC.md`.

## MarketingAgent Status

| Concern | Status |
|---|---|
| Class declared | ✅ Stub in `setup.py` |
| Bound in `wrangler.jsonc` (`MARKETING_AGENT`) | ✅ |
| `new_sqlite_classes` migration | ✅ |
| Exported from Worker entrypoint | ✅ Stub `export { MarketingAgent }` exists |
| State shape declared | ⚠️ Stub state covers 4 fields; spec lists 11 |
| Callable methods | 🔴 Stub: 3 of ~20 |
| Workflow callbacks | ⚠️ Stub: `onWorkflowProgress`/`onWorkflowComplete`/`onWorkflowError` (good); not wired to actual workflow updates |
| `broadcast()` for live UI | ⚠️ Stub uses it for workflow events; no message schema documented |
| Approval guardrails | 🔴 Not implemented |
| Untrusted-content guard | 🔴 Not implemented |
| Cost/usage logging | 🔴 Not implemented |
| Sub-agent role separation | 🔴 Not implemented (spec lists 13 specialized roles, none scaffolded) |
| Pause/resume | ✅ Stub exists |
| Admin inspection | 🔴 No admin endpoint to read DO state |
| ID convention (`idFromName(brandId)`) | 🔴 Not documented |

## Missing Callable Methods

Per `AGENT_SPEC.md`, methods missing from the stub:

```ts
startOnboardingScan(input)                          // P0
getBrandProfile()                                   // P0
updateBrandProfile(patch)                           // P0
lockBrandField(fieldPath)                           // P1
regenerateBrandField(fieldPath)                     // P1
generateContentCalendar(input)                      // P0
generatePost(input)                                 // P1
regeneratePost(postId)                              // P1
approvePost(postId, userId)                         // P0
rejectPost(postId, userId, reason)                  // P0
scheduleApprovedPosts(input)                        // P0
generateWeeklyReport(input)                         // P1
getGrowthOpportunities()                            // P1
createCampaignFromOpportunity(opportunityId)        // P2
createDMRule(input)                                 // P2
getAgentActivity()                                  // P1
getWorkflowStatus(workflowId)                       // P0
```

Each should:
1. Validate caller has access to this brand (via injected user/workspace context — see "Broken State Assumptions" below).
2. Mutate state via `this.setState({ ... })`, not direct mutation.
3. Insert an `agent_runs` row (D1) with input/output/cost.
4. Optionally `this.broadcast(...)` an event to connected clients.
5. Return a typed response (Zod-validated where input is involved).

## Broken State Assumptions

1. **Agent has no notion of "who is calling".** `callable()` methods on the SDK don't carry a per-call user identity by default. The Hono route must validate auth, then pass `{ userId, workspaceId }` into each call. Document this in the agent module.
2. **Agent must verify `brandId` matches its own DO id.** Use `idFromName(brandId)` in the route → DO mapping, and on first method call, `this.state.brandId` must be set or asserted.
3. **State persistence on restart.** `Agent` SDK persists state across DO hibernation, but stub uses `this.setState` correctly only inside `pauseAgent`/`resumeAgent`. Other methods need to persist mutations too.
4. **WebSocket message schema undefined.** The stub broadcasts JSON-stringified objects with ad-hoc `type` keys. Define a Zod schema for outbound messages so the client has type safety.
5. **`errors` array grows unboundedly.** Cap at, e.g., 20 entries; or move to D1.

## Workflow Integration Gaps

- The Worker should pass the originating agent's stub into each Workflow start call (pattern: include `agentBrandId` in workflow params; the workflow looks up the DO via `env.MARKETING_AGENT.idFromName(brandId)` and calls `agent.onWorkflowProgress(...)`). Stub doesn't show this, but spec implies it.
- Workflows must keep updating `workflow_runs` D1 rows as they progress; agents read those for `getWorkflowStatus`.
- Workflows must handle "agent has been deleted/paused" gracefully (idempotent, no side effects past pause).

## Tooling Gaps

`AGENT_SPEC.md` lists agent tools (`readBrandProfile`, `writeBrandProfile`, `createContentPost`, etc.). These are *internal callables* the agent uses, not LLM tools. They should be defined as a typed service module (`src/server/services/agent-tools.ts`), exposing typed functions; the `MarketingAgent` calls them directly. **Do not bind them as MCP tools or LLM tools by default** — that loosens the guardrail.

Compliance/safety tools missing entirely:
- `compliance.review(content) → { allow, reasons[] }`
- `untrustedScanContent.sanitize(text) → string`  (strips/escapes anything that looks like an instruction)
- `cost.guard(workspaceId, kind, units) → { allow, reason }`
- `audit.write(action, before, after, actor)`

## Guardrail Gaps

`AGENT_SPEC.md` lists guardrails but no implementation:

| Guardrail | Implementation needed |
|---|---|
| Treat website/social scan text as untrusted | A `sanitize()` pass before any LLM prompt; never put raw scraped text in a system prompt; use a delimiter and clear "untrusted content" instruction |
| Never publish without approval (unless autonomy ≥ 90) | A check inside `scheduleApprovedPosts` that re-reads `content_posts.status === 'approved'` AND brand autonomy threshold |
| Forbidden phrases / unsupported claims | `compliance.review()` against a hard-coded list + LLM verifier |
| No browser-bot DMs | Provider check: only push to whitelisted scheduler providers; reject if `dm_rules.platform` requires unsupported integration |
| Sensitive DM rules need approval | `dm_rules.requires_approval` defaults to 1; never auto-enable |
| Evidence stored | Every recommendation must populate an `evidence_json` referencing scan ids / post ids / metric snapshots |

## Required Agent Refactor Plan

(Plan, not patch — implementation comes after the audit.)

1. **Create `src/server/agents/MarketingAgent.ts`** with full state shape from `AGENT_SPEC.md`.
2. **Define `WSMessage` Zod schema** for outbound broadcasts.
3. **Implement all ~20 callable methods**, each:
   - Takes `{ actor: { userId, workspaceId }, ...payload }`.
   - Calls auth/RBAC re-check via injected `db` helper.
   - Mutates `this.state` via `setState`.
   - Writes `agent_runs` with full input/output/cost.
   - Returns a Zod-validated response.
4. **Implement workflow callback adapters** (`onWorkflowProgress` / `onWorkflowComplete` / `onWorkflowError`) that update both DO state and D1 `workflow_runs`.
5. **Implement scheduling primitive** (`this.schedule()` from SDK) for weekly reports — `MarketingAgent.schedule({ cron: "0 9 * * MON" }, "generateWeeklyReport")`.
6. **Implement `MustBeViralMCP` properly** with read-only D1 tools (list brands in workspace, get post, get scan summary). Deny anything mutating.
7. **Mount MCP via Worker route**: `app.all("/mcp/*", (c) => env.MUSTBEVIRAL_MCP.get(env.MUSTBEVIRAL_MCP.idFromName("default")).fetch(c.req.raw))` — auth-gated to admin only.
8. **Tests**:
   - Unit: state transitions for `pauseAgent` / `resumeAgent`, approve/reject state machine.
   - Integration (miniflare + DO): full onboarding round-trip with mocked workflows.
   - Security: caller without workspace membership cannot call brand methods.

## Sub-agent Reality Check

`AGENT_SPEC.md` lists 13 "specialized agent roles" (BusinessIntakeAgent, WebsiteResearchAgent, ...). **Do not implement these as separate Durable Objects.** Implement them as **stateless prompt-template + service-function pairs** invoked from inside Workflows or the `MarketingAgent`. Spinning up 13 DOs per brand is overkill, expensive, and adds latency.

```
src/server/agents/roles/
  BusinessIntakeAgent.ts    (just exports a runIntake() function)
  WebsiteResearchAgent.ts
  SocialResearchAgent.ts
  CompetitorResearchAgent.ts
  BrandStrategistAgent.ts
  ContentStrategistAgent.ts
  CreativeDirectorAgent.ts
  CaptionHookAgent.ts
  SchedulerAgent.ts
  DMAutomationAgent.ts
  AnalyticsAgent.ts
  PerformanceOptimizerAgent.ts
  ComplianceApprovalAgent.ts
```

Each is a function that takes typed input, calls the model router, returns Zod-validated output. The `MarketingAgent` orchestrates calls to these; Workflows call them too.
