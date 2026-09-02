# mustbeviral-staging inspection — 2026-09-01

Work packet: WP-P3-002, step `p3b-001-execute-or-keep-deferred`  
Branch: `codex/viralgraph-cleanroom`  
Project: `mustbeviral-staging` only (Supabase `us-east-1`, healthy)  
Cloudflare: inspect-only. No remote mutation.

## Binding hygiene

- Plugin Supabase tools were scoped to `mustbeviral-staging` by project name.
- The personal `user-supabase` MCP binding points at a different product and was
  not used for reads or writes.
- No other product's database was queried for this packet.

## Aggregate corpus versus plan minimums

Counts are aggregates only. No tenant UUIDs, JWTs, or connection strings.

| Rel                   | Staging count | Plan minimum                       |
| --------------------- | ------------: | ---------------------------------- |
| workspaces            |           156 | 250                                |
| canvases              |           168 | 1,000                              |
| canvas_revisions      |           339 | 10 per canvas (1,000 × 10)         |
| artifacts             |           384 | 24 per completed run               |
| ledger_transactions   |           892 | 100 per workspace (250 × 100)      |
| runs                  |            33 | completed runs with 24 artifacts   |
| workspace_memberships |           156 | two disjoint synthetic tenants A/B |

Existing operational volume (quotes, idempotency, audit) is already large. This
packet did not add load on top of it.

## Fixture-tag probe

The accepted rollback rule is: delete only synthetic A/B rows tagged as
benchmark fixtures. Inspection of `workspaces`, `canvases`, `canvas_revisions`,
`artifacts`, `runs`, and `ledger_transactions` found no `tag`, `fixture`,
`synthetic`, `benchmark`, or `seed` column. Zero workspaces have a name or slug
containing `synthetic`, `fixture`, or `benchmark`.

There is therefore no accepted, queryable tag that can isolate a new A/B corpus
from the 156 existing staging workspaces.

## Hyperdrive (inspect-only)

- `apps/core/wrangler.jsonc` `env.staging` (`mustbeviral-v2-staging-core`) has no
  `hyperdrive` binding. The file states the binding is intentionally absent
  until G1–G6 pass.
- Account Hyperdrive configs contain no MustBeViral staging binding.
- Staging Worker `mustbeviral-v2-staging-core` remains the existing Core Worker.
  Instant queue rollback remains `QUEUES_ENABLED=false`.

## Seed-execution decision

The accepted procedure
(`governance/evidence/WP-P3-001/benchmarks/hyperdrive-fixture-seed-procedure-2026-09-01.md`)
names the corpus minimums and rollback. It does not name an executor, auth-user
provisioning, graph snapshot bytes, randomization key, revision IDs, or a
schema-backed fixture tag.

Executing the seed on this staging project would require inventing those
shapes, inventing tenant identities, and writing tens of thousands of rows
that cannot be rolled back by the accepted tag rule. That is forbidden.
`fixture-manifest.json` is therefore not created.

G1–G6 stays deferred for this packet. User-scoped barriers stay on Data API/RPC.
