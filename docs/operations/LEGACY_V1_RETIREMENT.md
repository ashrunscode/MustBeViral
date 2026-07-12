---
doc_id: legacy-v1-retirement
---

# Legacy V1 retirement

This temporary runbook is the only active-tree location permitted to name old MustBeViral resources. It authorizes inventory, not deletion. The domain/zone `mustbeviral.com` remains.

## Known inventory requiring exact ID verification

| Provider         | Known resources                                                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Pages | `mustbeviral`                                                                                                                                                                                                     |
| Cloudflare D1    | `mustbeviral-production`, `mustbeviral-staging`, `must-be-viral-db`                                                                                                                                               |
| Cloudflare KV    | `mustbeviral-production-cache`, `mustbeviral-staging-cache`                                                                                                                                                       |
| Cloudflare R2    | `mustbeviral-production-media`, `mustbeviral-staging-media`, `mustbeviral-media`, `mustbeviral-assets`, `must-be-viral-assets`, `must-be-viral-media`, `must-be-viral-backups`, `must-be-viral-analytics-exports` |
| Vercel           | `must-be-viral`, `mustbeviral`                                                                                                                                                                                    |
| Unverified       | old Workers/routes, Workflows, Durable Object namespaces, webhooks, and Stripe objects                                                                                                                            |

The currently known Cloudflare access cannot enumerate every Worker route, Workflow, or Durable Object namespace. Destructive remote action is forbidden until temporary read access produces a machine-readable inventory with exact account, zone/project, resource ID, binding, route, owner, traffic, and dependency evidence.

Never touch unrelated Supabase projects, the CoinOp Hyperdrive configuration, or any resource that cannot be proven to belong solely to legacy MustBeViral.

## Retirement gates and sequence

1. Inventory exact IDs, bindings, routes, owners, data counts, webhooks, secrets references, dependencies, and 30-day traffic.
2. Export old data outside the active repository to encrypted quarantine; record checksums and restore verification. Old application data is not migrated into V2.
3. Delete only allowlisted non-production/unused resources with a per-resource rollback note.
4. Keep the legacy production route until V2 staging and production smoke tests pass.
5. Cut DNS/routes to V2 with an observed rollback command and named operator.
6. Observe 72 continuous hours of zero legacy traffic while checking DNS, Worker/Page routes, webhooks, scheduled execution, and customer errors.
7. Delete remaining allowlisted legacy Cloudflare/Vercel resources and disable old Stripe webhook/catalog objects.
8. Retain encrypted exports for 30 days, restrict access, then purge and verify deletion.
9. Remove this runbook and its legacy-fingerprint exceptions after inventory and purge evidence is committed.

Every mutation records provider, account, exact resource ID, before/after evidence, timestamp, operator, approval, result, and rollback outcome. A name match alone is never sufficient authorization.
