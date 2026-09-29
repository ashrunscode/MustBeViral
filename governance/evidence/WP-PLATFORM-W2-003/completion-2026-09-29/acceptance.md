# W2-003 acceptance

Tested source: **d6de38f3103e4306b4f76abcebb56dd3bbdf27aa**, tree **1057f52a9e054ae40aad55a049677e1a893d9e2b**. Base: **1834368d618418162f578f709881d828b0ea1752**.
Specification 3, acceptance, effect permissions and earlier receipts are preserved.

| Criterion             | Behavior and proof                                                                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change detection      | Approved/current values and source evidence compare without rewriting approvals. Missing claims request review. SQL00048/52/53 and both-brand journeys cover duplicate bytes, separate origins, backward clock changes and stale-review refusal.                     |
| Expiry                | New approvals/pins reject expired offers. Exact-hash review renews or withdraws them, while historical pins remain immutable. SQL00049 and connected lifecycle journeys cover both brands.                                                                           |
| Contradiction/catalog | Explicit review resolves conflicts. Private CSV import enforces 40 records and 32768 code units, retains blank keyed values and provenance, and denies forged scopes/unsupported input. Domain/Core/contracts, SQL00049/50/51/53 and browser boundary journeys pass. |
| Two-brand journeys    | All 34 connected tests pass: 17 desktop and 17 mobile. They use synthetic WashBodega/UnPile data, real local Core/Postgres commands and private local R2. Independent source review is PASS.                                                                         |

The clean-clone receipt records actual exits for preflight, agent:verify (database, governance, design and full verify), fixture/connected probes and diff-scope. Node 24.18.0 and pnpm 11.12.0 use frozen dependencies. Database coverage: 61 files / 1180 assertions. Review history and failed/superseded attempts are retained.

Draft hashes bind available capture evidence. A cached B-to-C recapture invalidates a review even when no extraction runs and the assertion revision is unchanged. Source sequence metadata preserves all permission controls; historical receipts and snapshots are not rewritten.

This is local packet acceptance. Website egress uses explicit-host fixtures. No public crawl, Drive sync, social post, provider generation, email, charge, remote database write or deployment occurred. Additional external-service spending: zero. Prior cumulative reserved review valuations remain $41.443313 of the $100 ceiling; that reservation is not a proven cash invoice.

Visual inspection covered desktop conflict controls for WashBodega, lifecycle and expiry for UnPile, mobile conflict controls for UnPile, and mobile lifecycle and expiry for WashBodega. Labels, fields and actions were readable in the approved Lightfield layout, with no observed overlap. Automated connected checks include horizontal overflow, keyboard behavior, zoom and reduced motion. The attached axe reports contain zero violations in their tested states; these bounded checks do not establish full accessibility certification or real-operator acceptance. All 12 lifecycle captures are preserved with hashes.

The browser harness preserved its synthetic test users because cleanup was blocked. No destructive cleanup or shared database reset was attempted.

Rollback retains additive data/security guards and the actor-aware W2-002 machine caller. Recheck W1/W2 capture, review, approval and pins; do not delete data or weaken RLS.

Prepared successor WP-PLATFORM-W3-001 requires real-media rights, measured runtime/cost evidence, hosted permission where required, human fidelity acceptance and a reviewed architecture decision. No Wave 2/3 exit or public completion is claimed.
