# ARCHITECTURE.md

## Final Architecture Decision

Build MustBeViral as a Cloudflare-native multi-brand AI agent platform.

Base:
- React Router + Hono + Vite + Tailwind + ShadCN-style UI
- Cloudflare Workers
- Cloudflare Agents SDK
- D1
- Durable Objects
- R2
- Cloudflare Images
- Workers AI
- AI Gateway
- Workflows
- Queues
- Browser Run
- Stripe
- Vista Social/Buffer/manual scheduler adapters

## High-Level Diagram

User Browser
  -> React Router SPA
  -> Hono API on Cloudflare Worker
  -> D1 global relational data
  -> R2 media storage
  -> Cloudflare Images variants
  -> MarketingAgent Durable Object per brand
  -> Workflows for long-running execution
  -> AI Gateway / Model Router
  -> Workers AI / Kimi / OpenAI / Claude / FLUX
  -> Vista Social / Buffer / Manual Export
  -> Analytics / Reports / Admin

## Data Ownership

D1:
- users
- workspaces
- brands
- posts
- approvals
- billing
- reports
- asset metadata
- analytics snapshots
- audit logs

MarketingAgent Durable Object:
- current brand state
- workflow tracking
- agent memory
- active operation status
- connected WebSocket clients
- scheduled internal tasks
- fast local SQL memory

R2:
- original logos/photos/docs
- generated images
- screenshots
- PDF reports
- exports

Cloudflare Images:
- transformations
- thumbnails
- social variants

Vectorize:
- optional semantic memory/search
- brand docs retrieval
- post similarity
- creator/brand matching later

## Request Flow

1. User opens dashboard.
2. React app calls Hono API.
3. API validates auth and RBAC.
4. API calls D1 or MarketingAgent stub.
5. Agent returns state or starts workflow.
6. Workflow does long-running work.
7. Workflow reports progress to Agent.
8. Agent broadcasts UI updates.
9. D1 stores durable business records.

## Onboarding Flow

POST /api/brands
  -> create brand row
  -> create MarketingAgent named instance
  -> start BrandOnboardingWorkflow
  -> return workflow id

BrandOnboardingWorkflow:
  -> scan website
  -> scan socials where allowed
  -> scan competitors
  -> create brand profile
  -> create target market report
  -> generate scores
  -> generate content calendar
  -> generate images
  -> create approvals
  -> mark brand onboarding complete

## Publishing Flow

User approves post
  -> approval row
  -> post status approved

User clicks schedule approved
  -> ApprovalSchedulingWorkflow
  -> SchedulerAdapter.schedulePost()
  -> scheduled_posts row
  -> post status scheduled/published/failed

## Image Flow

User/agent requests image
  -> ImageGenerationWorkflow
  -> choose FLUX model
  -> generate
  -> store original in R2
  -> create Cloudflare Images variants
  -> generated_creatives row
  -> attach to post
  -> approval queue

## DM Automation Flow

User creates/approves DM rules
  -> DMAutomationSetupWorkflow
  -> compliance check
  -> send to Vista Social adapter where available
  -> store rules
  -> ingest events later

No browser-bot DM automation.

## Weekly Report Flow

Scheduled weekly task on MarketingAgent
  -> starts WeeklyReportWorkflow
  -> reads posts/analytics/DMs
  -> model interprets
  -> report JSON and PDF
  -> update improve-next-week memory
  -> show in dashboard

## Failure Recovery

All workflows:
- idempotent steps
- retries with backoff
- error row in workflow_runs
- agent broadcasts failure
- admin manual intervention queue
- retry endpoint

## Deployment Environments

development:
- local Wrangler
- mocked scheduler
- mocked image optional
- test D1/R2

staging:
- real Cloudflare bindings
- sandbox Stripe
- scheduler disabled/manual by default

production:
- real Cloudflare bindings
- real Stripe
- scheduler adapter enabled
- strict rate/cost limits
