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

P0 contains one web app and one Core Worker. A collaboration Worker, queues, durable workflows, and a separate executor are prohibited until their named evidence gate passes.

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
