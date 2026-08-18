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
| Blockers | Live GB-02 master hardening is not proven. Run f5fa333f-df35-4ce8-99f2-90ee9a78b7c7 partial_succeeded 8/16 (master-2 and master-3 failed with fal_webhook_failed). Residual 0. No same-day second pack. Evidence governance/evidence/WP-P0-001/self-sessions/2026-08-18-GB-02-01.md.; Buyer last mile is incomplete. Packshot upload signing throws, ZIP bytes are not minted through customer_download, some copy descriptions still trail into spec sections, the header still says Campaign, and Reject is local-only. Successor packet WP-P0-002 owns that work after the GB-02 run. Evidence governance/evidence/WP-P0-001/composed-review-staging-walk.md and governance/evidence/WP-P0-001/operator-decisions-2026-08-17.md.; Production-segment Web Vitals are unmeasured. usable-pack-landed-cost is still pending.; P0 exit is gated on people. Five-to-eight qualified evaluator sessions are PENDING. Operator self-sessions do not count. One paid pilot and an explicit go/no-go are still required. See governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md.; P1a charging must use the fully-landed margin guardrail (at most $1.82 per pack for 60% margin), not the looser $5 gate.; Staging migration HISTORY still diverges from repository filenames. It stays untouched for the rest of P0 per operator decision 2026-08-11. |
| Remote destructive action | `forbidden` |

## One next action

Do not start another pack on 2026-08-18. Diagnose fal_webhook_failed on GB-02 run f5fa333f without a new confirm. Then deploy last-mile Worker/web and walk GB-04 receipt.
