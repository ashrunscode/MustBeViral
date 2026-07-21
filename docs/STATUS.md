---
doc_id: project-status
---

# Current status

DO NOT EDIT — generated from `PROJECT_STATE.yaml` and the active packet.

| Field | Value |
|---|---|
| Product | MustBeViral Studio |
| Engine | ViralGraph |
| Generation | `viralgraph-cleanroom-v2` |
| Launch customer | `dtc_ecommerce_marketing_teams` |
| Phase | P0 — Real Meta Campaign Launch Pack vertical slice and private MCP proof (in_progress) |
| Active packet | `WP-P0-001` |
| Current step | `p0-005-golden-launch-pack-runs` |
| Release target | `P0` |
| Pending decisions | None |
| Blockers | Quote persistence has no caller-reachable write path, and the closing design is operator-owned. public.quotes grants authenticated SELECT only, carries a SELECT-only RLS policy, and no create_quote function exists among the five hardened RPCs, so a quote cannot be persisted by a caller JWT. Closing this requires an accepted forward-only migration adding a hardened SECURITY DEFINER RPC that derives or validates the amount server-side from the pinned catalog version, because a caller must never be able to name its own price.; Real provider runs are blocked on the remaining operator-owned enable inputs in governance/evidence/WP-P0-001/environment-provisioning.md section 6 (fal key, webhook secret, and live price confirmations; Moonshot key with retention/DPA clearance). The staging infrastructure targets are provisioned and verified; every provider route stays disabled and fail-closed until these inputs arrive.; Staging quote issuance is blocked because the price catalog is unseeded. Live evidence shows price_catalog_versions, model_routes, model_route_prices, and provider_registrations all empty, no migration seeds them, and every launch route declares enableGates.priceConfirmed false. Refusing to quote is correct behavior under execution-providers-billing, which requires price drift to disable new quotes until reviewed, so the catalog may only be seeded from operator-confirmed prices and never from placeholder values. |
| Remote destructive action | `forbidden` |

## One next action

Execute real end-to-end launch-pack runs for the 20 golden briefs with enabled providers, immutable receipts, transactional cap enforcement, and first-reviewable latency measurement once the operator supplies the provisioning inputs.
