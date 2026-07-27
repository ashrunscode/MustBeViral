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
| Blockers | Real provider generation is blocked on the operator-owned enable inputs in governance/evidence/WP-P0-001/environment-provisioning.md section 6 (fal key, webhook secret, and live price confirmations; Moonshot key with retention/DPA clearance). The staging infrastructure, seeded price catalog, and server-authoritative create_quote are provisioned and proven (20/20 real staging quotes at $4.55, pricing recorded in governance/evidence/WP-P0-001/pricing-decision.md); every provider route stays disabled and fail-closed until these inputs arrive. The P1a charging model must enforce the fully-landed margin guardrail (at most $1.82 per pack for 60% margin), not the looser $5 gate. |
| Remote destructive action | `forbidden` |

## One next action

Enable real provider generation for the 20 golden briefs (wire start_run to the start_run_barrier RPC plus provider dispatch, private-R2 artifact copy, and immutable receipts) once the operator supplies the fal and Moonshot enable inputs; the quote path is already proven 20/20 on staging at 4,550,000 micros.
