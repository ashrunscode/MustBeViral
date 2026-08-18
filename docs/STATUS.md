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
| Blockers | Live GB-02 16/16 is not proven. Run f5fa333f was content_policy_violation on master-2 and master-3, stored as fal_webhook_failed. Extractor and visual-only supplement prompts are deployed on Worker 9fa5c96d. No same-day second pack. Evidence governance/evidence/WP-P0-001/fal-webhook-failed-f5fa333f.md.; Buyer last mile ZIP/copy/header/upload is live on web 87jj0310i and Worker 1d909c1f. Masters still consume packshots as visual prompt text, not as image_url references. Live Reject is already not offered. Evidence governance/evidence/WP-P0-001/packshot-upload-staging-walk.md.; Production-segment Web Vitals are unmeasured. usable-pack-landed-cost is still pending.; P0 exit is gated on people. Five-to-eight qualified evaluator sessions are PENDING. Operator self-sessions do not count. One paid pilot and an explicit go/no-go are still required. See governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md.; P1a charging must use the fully-landed margin guardrail (at most $1.82 per pack for 60% margin), not the looser $5 gate.; Staging migration HISTORY still diverges from repository filenames. It stays untouched for the rest of P0 per operator decision 2026-08-11. |
| Remote destructive action | `forbidden` |

## One next action

After 2026-08-19 00:00 UTC, check global and workspace-day remaining, then confirm one new GB-02 to prove visual-only supplement prompts. In parallel, reconcile landed cost from existing receipts and start evaluator screens. Do not reuse f5fa333f, 9b6e0619, a72b78e5, or 33f2e40e.
