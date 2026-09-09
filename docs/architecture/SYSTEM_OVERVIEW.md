---
doc_id: system-overview
---

# System overview

## System boundary

MustBeViral Studio is a TypeScript monorepo with three durable authorities:

- **Supabase Postgres** owns identity-linked relational truth, tenant isolation, immutable revisions, run state, provider references, artifact metadata, lineage, quotes, reservations, ledger entries, audit events, and outbox events.
- **Private Cloudflare R2** owns canonical media bytes. Postgres owns their metadata and relationships.
- **Git** owns product, architecture, delivery, and generated-contract history for the software itself.

Ephemeral browser state, caches, collaboration drafts, and provider state are never promoted to a competing authority.

## Platform ownership

| Platform        | Owns                                                                                                                        | Does not own                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Vercel          | Next.js rendering, web routes, browser session integration, previews                                                        | execution truth, media authority, billing decisions          |
| Supabase        | Auth, Postgres, RLS, migrations, durable relational truth                                                                   | media bytes, provider execution, UI rendering                |
| Cloudflare Core | Hono API, JWT verification, command transport, fal/Stripe webhooks, outbox dispatch/reconciliation, signed media operations | user identity issuance, canonical relational truth           |
| R2              | private input/output/export bytes                                                                                           | tenant permissions, lineage, run state                       |
| fal             | first media execution transport                                                                                             | canonical artifacts, customer billing authority, graph truth |
| Stripe          | external subscription/payment settlement beginning P1a                                                                      | usage truth, provider cost attribution, internal ledger      |
| Resend          | Supabase Auth SMTP and transactional delivery                                                                               | notification preferences or application truth                |
| Sentry/OTel     | errors, traces, measurements, alerts                                                                                        | business state or audit authority                            |

The platform retains the existing web app, Core Worker, collaboration Worker and measured outbox/queue mechanisms. Their current environment enablement is owned by project state and deployment evidence. A new executor or render runtime requires an explicit architecture decision and measured operational need.

## Monorepo boundaries

```text
apps/web        Next.js App Router and browser adapters
apps/core       Hono Worker, HTTP/MCP adapters, provider webhooks, scheduled reconciliation
packages/contracts  Zod schemas, OpenAPI, command/query DTOs, error codes
packages/domain     entities, state machines, policies
packages/graph      DAG validation, canonicalization, hashing, patches, planning
packages/db         postgres.js repositories, units of work, generated Supabase types
packages/providers  transports, model drivers, model/price catalog readers
packages/billing    quotes, reservations, ledger, receipts
packages/artifacts  upload, signing, verification, lineage, export
packages/ai         constrained planning-agent adapter
packages/ui         approved design-system implementation
packages/config     typed environment schemas
packages/telemetry  logging, tracing, metrics, error reporting
supabase            local config, raw SQL migrations, seed data, database tests
```

Dependencies point inward: apps depend on packages; transport adapters depend on command/query handlers; domain and graph packages do not depend on Vercel, Cloudflare, Supabase clients, fal, or Stripe. `packages/contracts` contains wire shapes, not business decisions.

## Primary data flows

### Brief to revision

1. Web submits structured brief through a shared command.
2. Core verifies the Supabase JWT and request schema.
3. The planning adapter receives only permitted brief/brand context and returns a schema-validated graph patch.
4. User reviews and accepts the patch.
5. The command verifies `expected_revision_id`, validates/canonicalizes the DAG, hashes it, and stores one immutable revision.

### Quote to execution

1. Quote command validates the pinned revision, model routes, prices, spend caps, and current membership.
2. User explicitly confirms an unexpired quote with an idempotency key.
3. One barrier transaction creates the run, reservation, first ready attempts, and outbox event.
4. Post-commit dispatch submits safe attempts. A scheduled reconciler recovers abandoned outbox work.
5. Verified provider output is copied to private R2 before the artifact becomes available.
6. Normalized states update run progress; ledger capture/release follows verified acceptance and output evidence.

### Media access

1. User requests upload/download through an authenticated command.
2. Core verifies workspace membership, purpose, MIME type, size, and policy.
3. Core issues a short-lived signed operation for an exact key.
4. Post-upload verification records immutable metadata and hash. Downloads never expose the bucket publicly.

## Deployment environments

| Environment | Web                             | API                           | Supabase                           | Cloudflare resources                  |
| ----------- | ------------------------------- | ----------------------------- | ---------------------------------- | ------------------------------------- |
| Staging     | `staging.mustbeviral.com`       | `api-staging.mustbeviral.com` | `mustbeviral-staging`, `us-east-1` | `mustbeviral-v2-staging-{purpose}`    |
| Production  | `mustbeviral.com` and `/studio` | `api.mustbeviral.com`         | `mustbeviral-prod`, `us-east-1`    | `mustbeviral-v2-production-{purpose}` |

Secrets, buckets, database projects, signing keys, webhooks, and telemetry environments are never shared. Preview deployments use non-production data and cannot call production providers or Stripe live mode.

## Cross-cutting invariants

- Every state-changing command is authenticated, authorized, validated, idempotent, auditable, and traceable by request ID.
- Money uses integer USD micros. Media is private. Tenant identity is checked at the database boundary.
- A provider success response alone cannot mark a run complete or create a customer charge.
- Queue publication, when introduced, occurs after the Postgres transaction; the outbox bridges the atomicity boundary.
- Public API, browser, MCP, and CLI adapters call the same command/query handlers.
- Operational additions require measured evidence and an accepted decision, not anticipated scale.

## Full-platform domain boundaries

| Domain                      | Authoritative records and behaviors                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Identity and portfolio      | Studios, workspace grants, members, roles, brand/location scopes, invitations, offboarding.                        |
| Brand knowledge             | Sources, observations, assertions, approved versions, voice/visual rules, offerings, audiences, offers.            |
| Assets and rights           | Originals, derivatives, collections, source references, consent/rights grants, usage and expiry.                   |
| Campaigns and content       | Campaign versions, plans, tasks, content revisions, scenes, channel variants, experiment hypotheses.               |
| Creative execution          | Existing graph/run machinery, generation requests, compositor/render jobs, checks, receipts.                       |
| Approvals                   | Policies, review requests, decisions, comments, immutable approved revision hashes.                                |
| Connections and publication | External accounts, encrypted credentials, capability snapshots, schedules, attempts, external IDs, reconciliation. |
| Creators and partnerships   | Profiles, evidence, lists, relationships, agreements, deliverables, selected sharing grants.                       |
| Engagement                  | Conversations, messages, assignments, reply intents, permitted identity links.                                     |
| Measurement                 | Metric observations, first-party events, definitions, attribution records, aggregate reporting.                    |
| Commercial and operations   | Workspace ledgers, entitlements, budgets, subscription state, notification policies, operational incidents.        |

Use typed command/query handlers and generated transport contracts. The web, REST, CLI, and MCP clients call the same permissions, approvals, and idempotency logic. A chat or agent tool never creates a privileged alternate path.

## Background processing and rendering

Use the existing durable outbox/queue mechanisms after validating their current topology. Extend them for ingestion, analysis, rendering, scheduled publication, metric collection, notifications, and reconciliation. Queue adoption is already represented in the inspected composition; do not rebuild it under a second uncoordinated scheduler.

Separate job classes by latency and cost. Interactive metadata reads should not wait behind video rendering. Apply per-workspace concurrency limits, fairness, provider budgets, cancellation, deadlines, and dead-letter repair. Persist job state and progress so reloads do not lose work.

A Worker request is not a general-purpose long-running video renderer. Benchmark a supported render execution target for the required codecs, fonts, duration, and memory. Add a dedicated render runtime only through an explicit architecture decision with cost, failure, security, and deployment evidence. Keep orchestration and authoritative job state in the existing application.
