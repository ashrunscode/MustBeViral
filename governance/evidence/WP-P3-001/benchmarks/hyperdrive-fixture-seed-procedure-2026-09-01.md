# Hyperdrive G1–G6 fixture-seed procedure — accepted 2026-09-01

Work packet: WP-P3-001  
Authority: `docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md`  
Project: `mustbeviral-staging` only  
This file accepts the benchmark plan as the written seed procedure. It does not invent
row counts, tenant names, or rollback. It does not seed data or add a Hyperdrive binding
in this packet.

## Named corpus (from the accepted plan)

| Item                            | Required value                             |
| ------------------------------- | ------------------------------------------ |
| Staging project                 | `mustbeviral-staging`                      |
| Tenant A                        | Synthetic workspace set A, disjoint from B |
| Tenant B                        | Synthetic workspace set B, disjoint from A |
| Workspaces                      | at least 250                               |
| Canvases                        | at least 1,000                             |
| Revisions per canvas            | 10                                         |
| Nodes per current graph         | 12                                         |
| Artifacts per completed run     | 24                                         |
| Ledger transactions / workspace | 100                                        |
| Production or customer data     | forbidden                                  |

Before any timed run, commit `governance/evidence/WP-P3-001/benchmarks/fixture-manifest.json`
with encoded request/response byte counts, row counts, graph hashes, revision IDs, expected
balances, and the seeded randomization key. Both Data API/RPC and Hyperdrive paths must use
that frozen manifest.

## Tenants A and B

- Two authenticated synthetic tenants only.
- Disjoint workspaces, graphs, artifacts, and ledger rows.
- Opaque canary rows for G3 reuse probes.
- Never record raw tenant IDs, JWTs, or connection strings in evidence.

## Rollback

1. Keep the Data API/RPC baseline. Do not enable a user-scoped Hyperdrive path.
2. Delete only the synthetic A/B corpus rows created by this procedure (workspaces and
   descendants tagged as synthetic benchmark fixtures). Do not delete other staging data.
3. Remove a Hyperdrive binding only after recording its binding ID and operator acceptance.
4. Local `postgres` superuser Hyperdrive success does not prove G1.

## This packet's decision

WP-P3-001 **accepts this procedure as written** and **defers execution**. Seeding 250
workspaces and running the full G1–G6 matrix is a later packet. User-scoped barriers stay
on Data API/RPC. That is the plan's safe default, not a failed release outcome.
