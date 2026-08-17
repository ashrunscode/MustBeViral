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
| Blockers | Live GB-02 master-2 hardening is not yet proven. One pack is authorized after the 2026-08-18 UTC day reset on Worker 37897d13 and web jgifx4c95. Do not reuse 9b6e0619, a72b78e5, or 33f2e40e. Evidence of the prior partial is governance/evidence/WP-P0-001/self-sessions/2026-08-17-GB-02-02.md.; Buyer last mile is incomplete. Packshot upload signing throws, ZIP bytes are not minted through customer_download, some copy descriptions still trail into spec sections, the header still says Campaign, and Reject is local-only. Successor packet WP-P0-002 owns that work after the GB-02 run. Evidence governance/evidence/WP-P0-001/composed-review-staging-walk.md and governance/evidence/WP-P0-001/operator-decisions-2026-08-17.md.; Production-segment Web Vitals are unmeasured. usable-pack-landed-cost is still pending.; P0 exit is gated on people. Five-to-eight qualified evaluator sessions are PENDING. Operator self-sessions do not count. One paid pilot and an explicit go/no-go are still required. See governance/evidence/WP-P0-001/operator-decisions-2026-08-11.md.; P1a charging must use the fully-landed margin guardrail (at most $1.82 per pack for 60% margin), not the looser $5 gate.; Staging migration HISTORY still diverges from repository filenames. It stays untouched for the rest of P0 per operator decision 2026-08-11. |
| Remote destructive action | `forbidden` |

## One next action

After the 2026-08-18 UTC day reset, run one GB-02 on Worker 37897d13 and web jgifx4c95 to prove live master-2 hardening. Do not reuse run 9b6e0619, a72b78e5, or 33f2e40e, and do not start another pack on 2026-08-17. Then open WP-P0-002 for buyer last mile.
