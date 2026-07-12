---
doc_id: adr-0002-platform-boundaries
---

# ADR-0002: Separate web, durable truth, and execution/media

## Status

Accepted on 2026-07-12.

## Decision

Use Vercel/Next.js for the web application, Supabase Auth/Postgres/RLS for identity and durable relational truth, and one Cloudflare Core Worker plus private R2 for execution ingress and canonical media. Start with one Worker; add collaboration, durable workflow, queue, or executor services only after their explicit evidence gates pass.

## Rationale

Each platform receives the workload it handles best while the system preserves one relational authority. The added cross-cloud path is controlled by short barrier transactions and early latency testing rather than duplicated hot-state authorities.

## Consequences

- Supabase projects are pinned to `us-east-1`; database-heavy Worker requests are placed accordingly.
- The default user path preserves Supabase JWT/RLS context. Hyperdrive user transactions require the security and performance spike.
- R2 stores private bytes; Postgres stores metadata, permissions, lineage, and money.
- Platform additions require measurements and a superseding decision.
