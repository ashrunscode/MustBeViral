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
| Phase | P0 — Real Meta Campaign Launch Pack vertical slice and private MCP proof (blocked) |
| Active packet | `WP-P0-001` |
| Current step | `p0-008-p1a-successor-handoff` |
| Release target | `P0` |
| Pending decisions | None |
| Blockers | finish-requires-clean-commit — agent:finish requires a clean committed predecessor tree per governance policy. |
| Remote destructive action | `forbidden` |

## One next action

Operator must commit the finish-sprint tree, then run corepack pnpm agent:verify and corepack pnpm agent:finish --successor governance/evidence/WP-P0-001/successor-WP-P1A-001.yaml. Continue WP-P1A-001 with Resend auth SMTP wiring and production deploy evidence.
