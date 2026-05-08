# RESEARCHED_PLATFORM_NOTES.md

## Repo Context

Existing repo inspected: `ernijsansons/mustbeviral`.

The old repo contains strong product DNA but should not be patched as-is. It has useful ideas around AI content generation, influencer marketplace, strategy planning, trend analysis, boost/reputation dashboard, gamification, earnings, subscriptions, and Cloudflare-oriented architecture. The rebuild should preserve the ideas, not the broken architecture.

## Verified Cloudflare Anchors

Use these as build assumptions, but re-check exact API syntax before implementation.

### Cloudflare Agents SDK
Cloudflare Agents are stateful TypeScript classes backed by Durable Objects. Each agent can have persistent state, SQL storage, WebSockets, scheduling, tools, MCP support, browser access, sub-agents, email, voice, and workflow orchestration.

Architecture implication for MustBeViral:
- One durable `MarketingAgent` per brand.
- Agent owns brand memory, status, schedules, workflow tracking, and real-time dashboard updates.
- Use callable methods for UI actions.

### Cloudflare Workflows
Workflows are for durable multi-step processes with retries, persistent state, waiting for external events/approvals, and long-running jobs.

Architecture implication:
- Do not run onboarding scans, content-calendar generation, image batches, scheduler retries, or weekly reports only inside normal request handlers.
- Use Workflows for any task that can exceed 30 seconds, needs retry/backoff, waits for approval, or needs durable progress.

### Agents + Workflows
Cloudflare supports AgentWorkflow patterns where workflows can report progress to an originating Agent, update agent state, wait for approval, and be tracked.

Architecture implication:
- MarketingAgent starts workflows.
- Workflows update MarketingAgent state and broadcast progress to connected dashboard clients.

### Browser Run / Browser Rendering
Cloudflare Browser Run gives agents Chrome DevTools Protocol access for DOM inspection, screenshots, rendered-page analysis, scraping structured content, and debugging.

Architecture implication:
- Use Browser Run for website scans, competitor scans, screenshots, visual/style extraction.
- Do not use it to bypass login, scrape private data, or automate unsafe social/DM actions.

### MCP
Cloudflare supports `McpAgent` for stateful MCP servers backed by Durable Objects and SQL.

Architecture implication:
- Build `MustBeViralMCP` as an internal read-only MCP server for Claude Code/Codex/project inspection.
- No destructive MCP tools by default.

### Workers AI / FLUX
Workers AI supports Black Forest Labs FLUX.2 image models:
- FLUX.2 [dev]: high-fidelity, slower, supports multi-reference images and JSON prompting.
- FLUX.2 [klein] 4B: fast, cost-effective, fixed 4-step inference, up to 4 image inputs.
- FLUX.2 [klein] 9B: better quality than 4B while remaining fast/cost-effective.

Architecture implication:
- Use `flux-2-klein-9b` as default production image model.
- Use `flux-2-klein-4b` for rapid drafts/variants.
- Use `flux-2-dev` for premium/final creative.

### Cloudflare Images
Cloudflare Images supports scalable image pipelines, edge resizing, optimization, manipulation, hosted images, and transformations from storage such as R2.

Architecture implication:
- Store originals in R2.
- Use Images for social variants/previews.

### AI Gateway
AI Gateway supports observability, analytics, logging, caching, rate limiting, retries, model fallback, and multiple providers including Workers AI, OpenAI, Anthropic, Google, Replicate, and more.

Architecture implication:
- Route Kimi/OpenAI/Claude/Workers AI through model adapter and AI Gateway when possible.
- Track provider/model cost per brand/workspace.

### Cloudflare Templates
The official Cloudflare templates repository encourages modifying/extending templates. The `react-router-hono-fullstack-template` is the best base because it combines Workers, Hono APIs, React Router, ShadCN UI, Tailwind, and Vite. The `agents-starter` is the best reference for Agents SDK, AI chat, tools, approval tools, scheduling, WebSockets, and persistent messages.

## Template Decision

Primary base:
- `cloudflare/templates/react-router-hono-fullstack-template`

Agent reference:
- `cloudflare/agents-starter`

Copy/adapt:
- `saas-admin-template` if available for admin layout
- `text-to-image-template` for image generation
- `r2-explorer-template` for media library
- `workflows-starter-template` for workflows
- `d1-template` and `d1-starter-sessions-api-template` for database/session patterns
- `chanfana-openapi-template` for API docs if compatible
- `openauth-template` if auth is chosen over custom auth

Ignore in MVP:
- containers-template
- microfrontend-template
- mysql/postgres hyperdrive templates
- workers-for-platforms-template unless white-label pages are pulled forward
- worker-publisher-template unless dynamic Worker deployment becomes necessary

## Strategic Rebuild Decision

Do not repair old code blindly. The old repo should be mined for product concepts, then rebuilt cleanly.

Preserve:
- AI content generation
- strategy planner
- trend engine
- boost/reputation idea
- influencer marketplace concept
- earnings/commission concept for later
- AI usage tiers
- Cloudflare-first direction

Replace:
- overbuilt microservices/Docker/Redis/ELK complexity
- weak generic dashboard
- mock marketplace as core product
- single-user/single-brand assumptions
- broken type patterns
- generic “viral” UX

Build:
A Cloudflare-native multi-brand AI marketing autopilot.
