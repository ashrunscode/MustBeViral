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
| Blockers | Real provider runs are blocked on the remaining operator-owned enable inputs in governance/evidence/WP-P0-001/environment-provisioning.md section 6 (fal key, webhook secret, and live price confirmations; Moonshot key with retention/DPA clearance; staging service-role Worker secret). The staging infrastructure targets are provisioned and verified; every provider route stays disabled and fail-closed until these inputs arrive. |
| Remote destructive action | `forbidden` |

## One next action

Execute real end-to-end launch-pack runs for the 20 golden briefs with enabled providers, immutable receipts, transactional cap enforcement, and first-reviewable latency measurement once the operator supplies the provisioning inputs.
